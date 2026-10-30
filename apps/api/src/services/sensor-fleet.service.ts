import { TRPCError } from '@trpc/server';
import {
  assertSensorDeviceOrgConsistency,
  getEnabledModules,
  prisma,
  setModuleOverride,
  type Prisma,
} from '@bin-tracker/db';
import { nameIsHardwareId, sensorDeviceIdProblem } from '@bin-tracker/types';
import type { AssignSensorDeviceInput, ReassignSensorDeviceInput } from '@bin-tracker/validators';
import { handlePrismaError } from '../lib/errors.js';
import { writeSensorAudit, type SensorAuditAction } from './sensor-audit.js';
import { unknownDeviceLog } from './unknown-device-log.service.js';

export interface AddDevicesResult {
  added: string[];
  duplicates: string[];
  invalid: Array<{ externalId: string; reason: string }>;
}

interface Placement {
  state: string;
  organizationId: string | null;
  facilityId: string | null;
  zoneId: string | null;
  name: string;
}

/** What the audit log records about a device's placement. */
function placementOf(device: {
  state: string;
  organizationId: string | null;
  facilityId: string | null;
  zoneId: string | null;
  label: string;
}): Placement {
  return {
    state: device.state,
    organizationId: device.organizationId,
    facilityId: device.facilityId,
    zoneId: device.zoneId,
    name: device.label,
  };
}

async function requireDevice(deviceId: string) {
  const device = await prisma.sensorDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });
  return device;
}

/** The name is what tenants see; it must not be the hardware id (which an unnamed device's label defaults to). */
function assertTenantFacingName(name: string, externalId: string): void {
  if (nameIsHardwareId(name, externalId)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: "Give the device a name that is not its hardware id — tenants see this name" });
  }
}

/** The org must exist, the facility must be live and the org's own, and the zone must belong to that facility. */
async function validateTarget(target: { organizationId: string; facilityId: string; zoneId: string }): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: target.organizationId } });
  if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });

  const facility = await prisma.facility.findFirst({ where: { id: target.facilityId, deletedAt: null } });
  if (!facility) throw new TRPCError({ code: 'NOT_FOUND', message: 'Facility not found' });
  try {
    assertSensorDeviceOrgConsistency({ organizationId: org.id }, facility);
  } catch {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'That facility does not belong to that organization' });
  }

  const zone = await prisma.zone.findUnique({ where: { id: target.zoneId } });
  if (!zone || zone.facilityId !== facility.id) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'That zone does not belong to that facility' });
  }
}

/** True when the org can see its sensors; optionally switches ENVIRONMENT_MONITORING on (a manual override that survives plan changes). */
async function ensureMonitoringModule(
  tx: Prisma.TransactionClient,
  orgId: string,
  enable: boolean,
  actorId: string,
): Promise<boolean> {
  const modules = await getEnabledModules(tx, orgId);
  if (modules.includes('ENVIRONMENT_MONITORING')) return true;
  if (!enable) return false;
  await setModuleOverride(tx, { orgId, module: 'ENVIRONMENT_MONITORING', enabled: true, updatedBy: actorId });
  return true;
}

export const sensorFleetService = {
  /**
   * Registers ids as UNASSIGNED devices. Bad ids and ids that already exist are
   * reported, never fatal, so one typo in a pasted list does not lose the rest.
   */
  async addDevices(externalIds: string[], actorId: string): Promise<AddDevicesResult> {
    const unique = [...new Set(externalIds.map((id) => id.trim()))];
    const invalid: AddDevicesResult['invalid'] = [];
    const candidates: string[] = [];
    for (const id of unique) {
      const reason = sensorDeviceIdProblem(id);
      if (reason) invalid.push({ externalId: id, reason });
      else candidates.push(id);
    }

    const existing =
      candidates.length === 0
        ? []
        : await prisma.sensorDevice.findMany({ where: { externalId: { in: candidates } }, select: { externalId: true } });
    const taken = new Set(existing.map((d) => d.externalId));
    const duplicates = candidates.filter((id) => taken.has(id));
    const added = candidates.filter((id) => !taken.has(id));

    if (added.length > 0) {
      try {
        await prisma.$transaction(async (tx) => {
          for (const externalId of added) {
            const device = await tx.sensorDevice.create({ data: { externalId, label: externalId } });
            await writeSensorAudit(tx, { deviceId: device.id, actorId, action: 'device.add', newValue: { externalId } });
          }
        });
      } catch (error) {
        // A concurrent admin adding the same id surfaces as a unique violation.
        handlePrismaError(error);
      }
      // They are known now; stop listing them as unknown typos.
      await unknownDeviceLog.forget(added);
    }

    return { added, duplicates, invalid };
  },

  async assignDevice(input: AssignSensorDeviceInput, actorId: string): Promise<{ deviceId: string; moduleEnabled: boolean }> {
    const device = await requireDevice(input.deviceId);
    if (device.state !== 'UNASSIGNED') {
      throw new TRPCError({ code: 'CONFLICT', message: 'Only an unassigned device can be assigned — use reassign' });
    }
    assertTenantFacingName(input.name, device.externalId);
    await validateTarget(input);
    const before = placementOf(device);

    const moduleEnabled = await prisma.$transaction(async (tx) => {
      const updated = await tx.sensorDevice.update({
        where: { id: device.id },
        data: {
          state: 'ACTIVE',
          organizationId: input.organizationId,
          facilityId: input.facilityId,
          zoneId: input.zoneId,
          label: input.name,
          assignedAt: new Date(),
        },
      });
      await writeSensorAudit(tx, {
        deviceId: device.id,
        actorId,
        action: 'device.assign',
        oldValue: before,
        newValue: placementOf(updated),
      });
      return ensureMonitoringModule(tx, input.organizationId, input.enableModule, actorId);
    });

    return { deviceId: device.id, moduleEnabled };
  },

  /**
   * Moves an ACTIVE device. History stays where it was recorded (every reading
   * is stamped with the org that owned the device at ingest), and the new
   * tenant's visibility window restarts only when the ORGANIZATION changes — a
   * zone or facility move within one org keeps that tenant's history.
   */
  async reassignDevice(input: ReassignSensorDeviceInput, actorId: string): Promise<{ deviceId: string; moduleEnabled: boolean }> {
    const device = await requireDevice(input.deviceId);
    if (device.state !== 'ACTIVE') {
      throw new TRPCError({ code: 'CONFLICT', message: 'Only an active device can be reassigned' });
    }
    assertTenantFacingName(input.name, device.externalId);
    await validateTarget(input);

    const before = placementOf(device);
    const organizationChanged = device.organizationId !== input.organizationId;
    const action: SensorAuditAction = device.facilityId === input.facilityId ? 'device.zone_change' : 'device.reassign';

    const moduleEnabled = await prisma.$transaction(async (tx) => {
      const updated = await tx.sensorDevice.update({
        where: { id: device.id },
        data: {
          organizationId: input.organizationId,
          facilityId: input.facilityId,
          zoneId: input.zoneId,
          label: input.name,
          assignedAt: organizationChanged ? new Date() : undefined,
        },
      });
      await writeSensorAudit(tx, {
        deviceId: device.id,
        actorId,
        action,
        oldValue: before,
        newValue: placementOf(updated),
      });
      return ensureMonitoringModule(tx, input.organizationId, input.enableModule, actorId);
    });

    return { deviceId: device.id, moduleEnabled };
  },

  /** Stops accepting readings from the device and hides it from its tenant; placement and history are kept. */
  async deactivateDevice(deviceId: string, actorId: string): Promise<void> {
    const device = await requireDevice(deviceId);
    if (device.state === 'DEACTIVATED') {
      throw new TRPCError({ code: 'CONFLICT', message: 'Device is already deactivated' });
    }
    const before = placementOf(device);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.sensorDevice.update({ where: { id: device.id }, data: { state: 'DEACTIVATED' } });
      await writeSensorAudit(tx, {
        deviceId: device.id,
        actorId,
        action: 'device.deactivate',
        oldValue: before,
        newValue: placementOf(updated),
      });
    });
  },

  /** Back to ACTIVE if it still belongs to a tenant, otherwise back to UNASSIGNED. assignedAt is untouched. */
  async reactivateDevice(deviceId: string, actorId: string): Promise<void> {
    const device = await requireDevice(deviceId);
    if (device.state !== 'DEACTIVATED') {
      throw new TRPCError({ code: 'CONFLICT', message: 'Only a deactivated device can be reactivated' });
    }
    const before = placementOf(device);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.sensorDevice.update({
        where: { id: device.id },
        data: { state: device.organizationId ? 'ACTIVE' : 'UNASSIGNED' },
      });
      await writeSensorAudit(tx, {
        deviceId: device.id,
        actorId,
        action: 'device.reactivate',
        oldValue: before,
        newValue: placementOf(updated),
      });
    });
  },
};
