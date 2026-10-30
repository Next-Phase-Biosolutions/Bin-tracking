import { TRPCError } from '@trpc/server';
import type { SensorReading } from '@prisma/client';
import { getEnabledModules, prisma } from '@bin-tracker/db';
import { adminDeviceStatus, isDeviceOnline, type AdminDeviceStatus } from '@bin-tracker/types';
import type { FleetListInput } from '@bin-tracker/validators';
import { BUCKET_MS, downsampleReadings, type AdminSeriesPoint } from '../lib/downsample.js';
import { platformSettings } from './platform-settings.service.js';
import { sensorService, type TenantDeviceList } from './sensor.service.js';

/** Platform-admin view of a reading: every column, including hardware and fault detail. Never sent to tenants. */
export type AdminReading = SensorReading;

type Named = { id: string; name: string };

export interface FleetDeviceRow {
  id: string;
  /** The hardware id the firmware sends as `p_device_id`. Admin screens only. */
  externalId: string;
  /** The tenant-facing name. */
  name: string;
  state: 'UNASSIGNED' | 'ACTIVE' | 'DEACTIVATED';
  organization: Named | null;
  facility: Named | null;
  zone: Named | null;
  assignedAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  latest: AdminReading | null;
  status: AdminDeviceStatus;
}

const DEVICE_INCLUDE = {
  organization: { select: { id: true, name: true } },
  facility: { select: { id: true, name: true } },
  zone: { select: { id: true, name: true } },
} as const;

const RANGE_MS = { '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 } as const;
/** Upper bound on rows read for one chart; downsampling then keeps the payload small. */
const READINGS_READ_LIMIT = 100_000;
const DETAIL_RECENT = 100;
const DETAIL_FAULTS = 50;
const DETAIL_AUDIT = 50;
const SUMMARY_ALERT_LIMIT = 50;
const ENVIRONMENT_MONITORING = 'ENVIRONMENT_MONITORING';

type DeviceWithRelations = Awaited<ReturnType<typeof findDevices>>[number];

function findDevices(where: object) {
  return prisma.sensorDevice.findMany({ where, include: DEVICE_INCLUDE, orderBy: [{ state: 'asc' }, { label: 'asc' }] });
}

/** One query for the newest reading of every device (served by the (deviceId, timestamp) unique index). */
async function latestReadingsByDevice(deviceIds: string[]): Promise<Map<string, AdminReading>> {
  if (deviceIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<AdminReading[]>`
    SELECT DISTINCT ON ("deviceId") *
    FROM "sensor_readings"
    WHERE "deviceId" = ANY(${deviceIds})
    ORDER BY "deviceId", "timestamp" DESC`;
  return new Map(rows.map((row) => [row.deviceId, row]));
}

function toRow(device: DeviceWithRelations, latest: AdminReading | null, now: Date, offlineAfterMinutes: number): FleetDeviceRow {
  return {
    id: device.id,
    externalId: device.externalId,
    name: device.label,
    state: device.state,
    organization: device.organization,
    facility: device.facility,
    zone: device.zone,
    assignedAt: device.assignedAt,
    lastSeenAt: device.lastSeenAt,
    createdAt: device.createdAt,
    latest,
    status: adminDeviceStatus({ lastSeenAt: device.lastSeenAt, latest, now, offlineAfterMinutes }),
  };
}

async function buildRows(devices: DeviceWithRelations[], now: Date): Promise<{ rows: FleetDeviceRow[]; offlineAfterMinutes: number }> {
  const [latestById, offlineAfterMinutes] = await Promise.all([
    latestReadingsByDevice(devices.map((d) => d.id)),
    platformSettings.getOfflineAfterMinutes(),
  ]);
  return { rows: devices.map((d) => toRow(d, latestById.get(d.id) ?? null, now, offlineAfterMinutes)), offlineAfterMinutes };
}

const HEALTH_MATCH: Record<NonNullable<FleetListInput['health']>, (status: AdminDeviceStatus) => boolean> = {
  online: (s) => s !== 'WAITING' && s !== 'OFFLINE',
  offline: (s) => s === 'OFFLINE',
  fault: (s) => s === 'FAULT',
  waiting: (s) => s === 'WAITING',
};

async function requireOrganization(organizationId: string): Promise<Named> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
  if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
  return org;
}

export const sensorFleetReadService = {
  async listFleetDevices(input: FleetListInput): Promise<{ rows: FleetDeviceRow[]; total: number; page: number; pageSize: number }> {
    const where = {
      ...(input.state && { state: input.state }),
      ...(input.organizationId && { organizationId: input.organizationId }),
      ...(input.facilityId && { facilityId: input.facilityId }),
      ...(input.zoneId && { zoneId: input.zoneId }),
      ...(input.search && {
        OR: [
          { externalId: { contains: input.search, mode: 'insensitive' as const } },
          { label: { contains: input.search, mode: 'insensitive' as const } },
        ],
      }),
    };
    const { rows } = await buildRows(await findDevices(where), new Date());

    // ponytail: health is derived from the latest reading, so it is filtered and paginated in memory.
    // Fine for a fleet of a few thousand devices; move to SQL if it grows past that.
    const matching = input.health ? rows.filter((row) => HEALTH_MATCH[input.health!](row.status)) : rows;
    const start = (input.page - 1) * input.pageSize;
    return { rows: matching.slice(start, start + input.pageSize), total: matching.length, page: input.page, pageSize: input.pageSize };
  },

  async fleetSummary() {
    const now = new Date();
    const devices = await findDevices({});
    const { rows, offlineAfterMinutes } = await buildRows(devices, now);
    const readingsLastHour = await prisma.sensorReading.count({ where: { timestamp: { gte: new Date(now.getTime() - 3_600_000) } } });

    const byState = { UNASSIGNED: 0, ACTIVE: 0, DEACTIVATED: 0 };
    for (const row of rows) byState[row.state] += 1;

    const active = rows.filter((row) => row.state === 'ACTIVE');
    const online = active.filter((row) => isDeviceOnline(row.lastSeenAt, now, offlineAfterMinutes)).length;
    const alerts = active
      .filter((row) => row.status === 'FAULT' || row.status === 'ALERT' || row.status === 'OFFLINE')
      .sort((a, b) => (b.lastSeenAt?.getTime() ?? -Infinity) - (a.lastSeenAt?.getTime() ?? -Infinity))
      .slice(0, SUMMARY_ALERT_LIMIT);

    return {
      byState,
      online,
      offline: active.length - online,
      inFault: active.filter((row) => row.status === 'FAULT').length,
      readingsLastHour,
      offlineAfterMinutes,
      alerts,
    };
  },

  async deviceDetail(deviceId: string) {
    const device = await prisma.sensorDevice.findUnique({ where: { id: deviceId }, include: DEVICE_INCLUDE });
    if (!device) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });

    const [recent, faults, audit, offlineAfterMinutes] = await Promise.all([
      prisma.sensorReading.findMany({ where: { deviceId }, orderBy: { timestamp: 'desc' }, take: DETAIL_RECENT }),
      // notIn [0] drops both nominal (0) and null codes: only real faults.
      prisma.sensorReading.findMany({
        where: { deviceId, errorCode: { notIn: [0] } },
        orderBy: { timestamp: 'desc' },
        take: DETAIL_FAULTS,
      }),
      prisma.sensorDeviceAuditLog.findMany({ where: { deviceId }, orderBy: { createdAt: 'desc' }, take: DETAIL_AUDIT }),
      platformSettings.getOfflineAfterMinutes(),
    ]);

    const latest = recent[0] ?? null;
    return {
      device: toRow(device, latest, new Date(), offlineAfterMinutes),
      latest,
      recent,
      faults,
      audit,
    };
  },

  async deviceReadings(deviceId: string, range: '24h' | '7d' | '30d'): Promise<AdminSeriesPoint[]> {
    const device = await prisma.sensorDevice.findUnique({ where: { id: deviceId }, select: { id: true } });
    if (!device) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });

    // Newest rows first so the cap keeps recent data, then back to ascending for the chart.
    const rows = await prisma.sensorReading.findMany({
      where: { deviceId, timestamp: { gte: new Date(Date.now() - RANGE_MS[range]) } },
      orderBy: { timestamp: 'desc' },
      take: READINGS_READ_LIMIT,
      select: { timestamp: true, tempC: true, humidityPct: true, rssi: true, snr: true, filteredRssi: true, errorCode: true },
    });
    return downsampleReadings(rows.reverse(), BUCKET_MS[range]);
  },

  /** Exactly the list the org's own admin would get: the tenant service, over all of the org's live facilities. */
  async viewAsTenant(organizationId: string): Promise<TenantDeviceList & { organization: Named }> {
    const organization = await requireOrganization(organizationId);
    const facilities = await prisma.facility.findMany({
      where: { organizationId: organization.id, deletedAt: null },
      select: { id: true },
    });
    const list = await sensorService.listDevicesForOrg(organization.id, facilities.map((f) => f.id));
    return { ...list, organization };
  },

  viewAsTenantReadings(organizationId: string, deviceId: string, range: '24h' | '7d', actorId: string) {
    return sensorService.getDeviceHistory(organizationId, deviceId, range, actorId, 'ADMIN');
  },

  async listOrgAssignmentOptions(organizationId: string) {
    const organization = await requireOrganization(organizationId);
    const [facilities, modules] = await Promise.all([
      prisma.facility.findMany({
        where: { organizationId: organization.id, deletedAt: null },
        select: { id: true, name: true, zones: { select: { id: true, name: true, slug: true, sortOrder: true } } },
        orderBy: { name: 'asc' },
      }),
      getEnabledModules(prisma, organization.id),
    ]);

    return {
      moduleEnabled: modules.includes(ENVIRONMENT_MONITORING),
      facilities: facilities.map((facility) => ({
        id: facility.id,
        name: facility.name,
        zones: [...facility.zones]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(({ id, name, slug }) => ({ id, name, slug })),
      })),
    };
  },
};
