import { prisma } from '@bin-tracker/db';
import { TRPCError } from '@trpc/server';
import { computeThresholdStatus } from '@bin-tracker/types';

// Up to 7 rows per 5-min window in bursts means a 7d range is unbounded
// without a cap and could hang the chart on a chatty device. Starting cap —
// tune once real deployed-device density is known.
const READINGS_TAKE_LIMIT = 2000;

/**
 * Devices visible to every organization, bypassing the org/facility scoping
 * below entirely — an explicit, opt-in exception, not a weakening of it.
 *
 * Product decision: until each customer has their own physical EcoSafeSense
 * sensor, every org's Wet Aging tab shows this one shared device's real
 * readings. Every OTHER device — including any future per-customer sensor —
 * stays strictly org-scoped exactly as before; this allowlist is additive.
 * A device's internal `id` must be added here deliberately
 * (SHARED_SENSOR_DEVICE_IDS env var, comma-separated), so nothing becomes
 * cross-org visible by default,
 * and the tenant-isolation guarantee Action Item 5 built stays intact for
 * every device not explicitly listed.
 *
 * ponytail: env-var allowlist, no schema change — fine while there's a
 * handful of shared devices. Move to a `SensorDevice.isShared` column (or
 * per-org opt-in table) if this ever needs more than a couple of entries.
 */
const SHARED_DEVICE_IDS = new Set(
  (process.env['SHARED_SENSOR_DEVICE_IDS'] ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
);

interface ReadingLike {
  tempC: number;
  humidityPct: number;
  nh3Ppm: number | null;
  tvoc: number | null;
  eco2Ppm: number | null;
  aqhiPlus: number | null;
  ozonePpb: number | null;
  pressure: number | null;
  pm25: number | null;
}

// Generic so the return type keeps every field of the caller's device shape
// (id, organizationId, ...) — a fixed `{ readings }` parameter type would
// erase everything else through the `...device` spread below.
function withStatus<T extends { readings: ReadingLike[] }>(device: T) {
  const latest = device.readings[0];
  return {
    ...device,
    latestStatus: latest
      ? computeThresholdStatus({
          tempC: latest.tempC,
          humidityPct: latest.humidityPct,
          nh3Ppm: latest.nh3Ppm,
          tvoc: latest.tvoc,
          eco2Ppm: latest.eco2Ppm,
          aqhiPlus: latest.aqhiPlus,
          ozonePpb: latest.ozonePpb,
          pressure: latest.pressure,
          pm25: latest.pm25,
        })
      : ('UNKNOWN' as const),
  };
}

export const sensorService = {
  async listDevicesForOrg(organizationId: string, facilityIds: string[]) {
    const [ownDevices, sharedDevices, settings] = await Promise.all([
      prisma.sensorDevice.findMany({
        where: { organizationId, facilityId: { in: facilityIds } },
        include: { readings: { orderBy: { timestamp: 'desc' }, take: 1 } },
      }),
      SHARED_DEVICE_IDS.size > 0
        ? prisma.sensorDevice.findMany({
            where: { id: { in: [...SHARED_DEVICE_IDS] } },
            include: { readings: { orderBy: { timestamp: 'desc' }, take: 1 } },
          })
        : Promise.resolve([]),
      prisma.settings.findUnique({ where: { organizationId }, select: { companyTimezone: true } }),
    ]);

    // De-duped by id — an org that happens to own a device also listed as
    // shared (its own org) would otherwise see it rendered twice.
    const byId = new Map([...ownDevices, ...sharedDevices].map((d) => [d.id, d]));

    return {
      companyTimezone: settings?.companyTimezone ?? 'America/Toronto',
      devices: [...byId.values()].map(withStatus),
    };
  },

  async getDeviceHistory(
    organizationId: string,
    deviceId: string,
    range: '24h' | '7d',
    userId: string,
    orgRole: string,
  ) {
    // Critical line in the whole feature — must throw before any reading
    // is touched. Keep this inlined here, not exposed as a separately
    // callable step a future caller might skip. The shared-device allowlist
    // is the one deliberate bypass of the org check; every other id still
    // requires an exact organizationId match.
    const isShared = SHARED_DEVICE_IDS.has(deviceId);
    const device = isShared
      ? await prisma.sensorDevice.findUnique({ where: { id: deviceId } })
      : await prisma.sensorDevice.findFirst({ where: { id: deviceId, organizationId } });
    if (!device) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });

    // Facility check — org match alone isn't enough for a multi-facility org;
    // listDevicesForOrg already intersects the caller's facility access, but
    // this by-id lookup has no equivalent unless it's added explicitly.
    // Skipped for shared devices, which are deliberately visible regardless
    // of facility, same as regardless of org.
    if (!isShared && orgRole !== 'ADMIN') {
      const hasAccess = await prisma.userFacility.findUnique({
        where: { userId_facilityId: { userId, facilityId: device.facilityId } },
      });
      if (!hasAccess) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });
    }

    const since =
      range === '24h'
        ? new Date(Date.now() - 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Cap at the NEWEST rows, not the oldest — orderBy desc + take + reverse.
    // orderBy asc + take would silently return the start of the window and
    // drop everything recent, which is backwards for a live-monitoring chart.
    const rows = await prisma.sensorReading.findMany({
      where: { deviceId, timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: READINGS_TAKE_LIMIT,
    });
    return rows.reverse();
  },
};
