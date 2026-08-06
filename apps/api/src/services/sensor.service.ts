import { prisma } from '@bin-tracker/db';
import { TRPCError } from '@trpc/server';
import { computeThresholdStatus } from '@bin-tracker/types';

// Up to 7 rows per 5-min window in bursts means a 7d range is unbounded
// without a cap and could hang the chart on a chatty device. Starting cap —
// tune once real deployed-device density is known.
const READINGS_TAKE_LIMIT = 2000;

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
            devices: devices.map((d) => ({
                ...d,
                latestStatus: d.readings[0]
                    ? computeThresholdStatus({
                          tempC: d.readings[0].tempC,
                          humidityPct: d.readings[0].humidityPct,
                          nh3Ppm: d.readings[0].nh3Ppm,
                          tvoc: d.readings[0].tvoc,
                          eco2Ppm: d.readings[0].eco2Ppm,
                          aqhiPlus: d.readings[0].aqhiPlus,
                          ozonePpb: d.readings[0].ozonePpb,
                          pressure: d.readings[0].pressure,
                          pm25: d.readings[0].pm25,
                      })
                    : ('UNKNOWN' as const),
            })),
        };
    },

    async getDeviceHistory(organizationId: string, deviceId: string, range: '24h' | '7d') {
        // Critical line in the whole feature — must throw before any reading
        // is touched. Keep this inlined here, not exposed as a separately
        // callable step a future caller might skip.
        const device = await prisma.sensorDevice.findFirst({ where: { id: deviceId, organizationId } });
        if (!device) throw new TRPCError({ code: 'NOT_FOUND', message: 'Device not found' });

        const since =
            range === '24h' ? new Date(Date.now() - 24 * 60 * 60 * 1000) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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
