import { prisma } from '@bin-tracker/db';
import { TRPCError } from '@trpc/server';
import { computeThresholdStatus } from '@bin-tracker/types';

// Up to 7 rows per 5-min window in bursts means a 7d range is unbounded
// without a cap and could hang the chart on a chatty device. Starting cap —
// tune once real deployed-device density is known.
const READINGS_TAKE_LIMIT = 2000;

interface ReadingLike {
  tempC: number | null;
  humidityPct: number | null;
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
    const [devices, settings] = await Promise.all([
      prisma.sensorDevice.findMany({
        where: { organizationId, facilityId: { in: facilityIds } },
        include: { readings: { orderBy: { timestamp: 'desc' }, take: 1 } },
      }),
      prisma.settings.findUnique({ where: { organizationId }, select: { companyTimezone: true } }),
    ]);

    return {
      companyTimezone: settings?.companyTimezone ?? 'America/Toronto',
      devices: devices.map(withStatus),
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
    // callable step a future caller might skip. Always an exact
    // organizationId match: there is no cross-org visibility.
    const device = await prisma.sensorDevice.findFirst({ where: { id: deviceId, organizationId } });
    if (!device) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });

    // Facility check — org match alone isn't enough for a multi-facility org;
    // listDevicesForOrg already intersects the caller's facility access, but
    // this by-id lookup has no equivalent unless it's added explicitly.
    if (orgRole !== 'ADMIN') {
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
