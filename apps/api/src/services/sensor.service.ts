import { prisma } from '@bin-tracker/db';
import { TRPCError } from '@trpc/server';
import { computeThresholdStatus, type ThresholdStatus } from '@bin-tracker/types';
import { platformSettings } from './platform-settings.service.js';

// Up to 7 rows per 5-min window in bursts means a 7d range is unbounded
// without a cap and could hang the chart on a chatty device. Starting cap —
// tune once real deployed-device density is known.
const READINGS_TAKE_LIMIT = 2000;

/** The only reading fields a tenant ever receives. */
export interface TenantReading {
  timestamp: Date;
  tempC: number | null;
  humidityPct: number | null;
}

export interface TenantDevice {
  id: string;
  /** The device's tenant-facing name — never its hardware id. */
  name: string;
  zone: { id: string; slug: string; name: string } | null;
  facility: { id: string; name: string };
  /** Null until the device has reported since it was assigned to this tenant. */
  lastSeenAt: Date | null;
  latestStatus: ThresholdStatus;
  latest: TenantReading | null;
}

export interface TenantDeviceList {
  companyTimezone: string;
  offlineAfterMinutes: number;
  devices: TenantDevice[];
}

export const sensorService = {
  /**
   * The caller's own ACTIVE devices. Everything here is `select`ed explicitly:
   * tenants must never receive hardware ids, signal values, fault detail or raw
   * payloads, and a whole-row query would hand them all of it.
   */
  async listDevicesForOrg(organizationId: string, facilityIds: string[]): Promise<TenantDeviceList> {
    const [devices, settings, offlineAfterMinutes] = await Promise.all([
      prisma.sensorDevice.findMany({
        where: { organizationId, state: 'ACTIVE', facilityId: { in: facilityIds } },
        select: {
          id: true,
          label: true,
          assignedAt: true,
          lastSeenAt: true,
          zone: { select: { id: true, slug: true, name: true } },
          facility: { select: { id: true, name: true } },
        },
        orderBy: { label: 'asc' },
      }),
      prisma.settings.findUnique({ where: { organizationId }, select: { companyTimezone: true } }),
      platformSettings.getOfflineAfterMinutes(),
    ]);

    // ACTIVE devices always have a facility and assignedAt (DB CHECK); this narrows the nullable types.
    const assigned = devices.flatMap((device) =>
      device.facility && device.assignedAt ? [{ ...device, facility: device.facility, assignedAt: device.assignedAt }] : [],
    );

    const tenantDevices = await Promise.all(
      assigned.map(
        async (device): Promise<TenantDevice> => {
          // A tenant only sees what happened after the device became theirs, and only
          // readings stamped with their own org (a previous tenant's stay out).
          const latest = await prisma.sensorReading.findFirst({
            where: { deviceId: device.id, organizationId, timestamp: { gte: device.assignedAt } },
            orderBy: { timestamp: 'desc' },
            select: { timestamp: true, tempC: true, humidityPct: true, nh3Ppm: true },
          });
          return {
            id: device.id,
            name: device.label,
            zone: device.zone,
            facility: device.facility,
            lastSeenAt: device.lastSeenAt && device.lastSeenAt >= device.assignedAt ? device.lastSeenAt : null,
            latestStatus: latest
              ? computeThresholdStatus({ tempC: latest.tempC, humidityPct: latest.humidityPct, nh3Ppm: latest.nh3Ppm })
              : 'UNKNOWN',
            latest: latest ? { timestamp: latest.timestamp, tempC: latest.tempC, humidityPct: latest.humidityPct } : null,
          };
        },
      ),
    );

    return {
      companyTimezone: settings?.companyTimezone ?? 'America/Toronto',
      offlineAfterMinutes,
      devices: tenantDevices,
    };
  },

  async getDeviceHistory(
    organizationId: string,
    deviceId: string,
    range: '24h' | '7d',
    userId: string,
    orgRole: string,
  ): Promise<TenantReading[]> {
    // Critical line in the whole feature — must throw before any reading
    // is touched. Keep this inlined here, not exposed as a separately
    // callable step a future caller might skip. Always an exact organizationId
    // match, and only ACTIVE devices: unassigned and deactivated ones are not the tenant's to see.
    const device = await prisma.sensorDevice.findFirst({
      where: { id: deviceId, organizationId, state: 'ACTIVE' },
      select: { facilityId: true, assignedAt: true },
    });
    if (!device || !device.assignedAt) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });

    // Facility check — org match alone isn't enough for a multi-facility org;
    // listDevicesForOrg already intersects the caller's facility access, but
    // this by-id lookup has no equivalent unless it's added explicitly.
    if (orgRole !== 'ADMIN') {
      // An unassigned device has no facility, so no non-admin can have access to it.
      const hasAccess = device.facilityId
        ? await prisma.userFacility.findUnique({
            where: { userId_facilityId: { userId, facilityId: device.facilityId } },
          })
        : null;
      if (!hasAccess) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });
    }

    const rangeStart = new Date(Date.now() - (range === '24h' ? 1 : 7) * 24 * 60 * 60 * 1000);
    // Never earlier than assignment: history from before this tenant owned the device is not theirs.
    const since = rangeStart > device.assignedAt ? rangeStart : device.assignedAt;

    // Cap at the NEWEST rows, not the oldest — orderBy desc + take + reverse.
    // orderBy asc + take would silently return the start of the window and
    // drop everything recent, which is backwards for a live-monitoring chart.
    const rows = await prisma.sensorReading.findMany({
      where: { deviceId, organizationId, timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: READINGS_TAKE_LIMIT,
      select: { timestamp: true, tempC: true, humidityPct: true },
    });
    return rows.reverse();
  },
};
