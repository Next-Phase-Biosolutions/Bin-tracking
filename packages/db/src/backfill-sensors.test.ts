import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedSensorReading } from './ecosafesense.client.js';

interface FakeReading {
    id: string;
    deviceId: string;
    timestamp: Date;
}

const store = vi.hoisted(() => ({
    device: { id: 'device-1', externalId: 'ext-1', organizationId: 'org-1', facilityId: 'fac-1', lastSeenAt: null as Date | null },
    readings: [] as FakeReading[],
    nextId: 1,
}));

vi.mock('./client.js', () => {
    const prisma = {
        sensorDevice: {
            findUniqueOrThrow: ({ where }: { where: { id: string } }) => {
                if (where.id !== store.device.id) throw new Error('not found');
                return Promise.resolve({ ...store.device });
            },
            update: ({ where, data }: { where: { id: string }; data: { lastSeenAt: Date | null } }) => {
                if (where.id !== store.device.id) throw new Error('not found');
                store.device.lastSeenAt = data.lastSeenAt;
                return Promise.resolve({ ...store.device });
            },
        },
        sensorReading: {
            findFirst: ({ where }: { where: { deviceId: string } }) => {
                const rows = store.readings.filter((r) => r.deviceId === where.deviceId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                return Promise.resolve(rows[0] ?? null);
            },
            createMany: ({ data, skipDuplicates }: { data: Array<{ deviceId: string; timestamp: Date }>; skipDuplicates: boolean }) => {
                let inserted = 0;
                for (const row of data) {
                    const isDup =
                        skipDuplicates &&
                        store.readings.some((r) => r.deviceId === row.deviceId && r.timestamp.getTime() === row.timestamp.getTime());
                    if (isDup) continue;
                    store.readings.push({ id: `r${store.nextId++}`, deviceId: row.deviceId, timestamp: row.timestamp });
                    inserted++;
                }
                return Promise.resolve({ count: inserted });
            },
        },
    };
    return { prisma };
});

const { runCycle } = await import('./backfill-sensors.js');

function reading(timestamp: string, tempC = 4): ParsedSensorReading {
    return {
        timestamp: new Date(timestamp),
        tempC,
        humidityPct: 50,
        nh3Ppm: null,
        tvoc: null,
        eco2Ppm: null,
        aqhiPlus: null,
        ozonePpb: null,
        pressure: null,
        pm25: null,
    };
}

const baseConfig = {
    baseUrl: 'https://vendor.example',
    clientId: 'id',
    clientSecret: 'secret',
    deviceExternalId: 'ext-1',
    deviceLabel: 'Test Device',
    orgSlug: 'default',
    facilityId: 'fac-1',
    backfillLookbackDays: 30,
};

describe('runCycle', () => {
    beforeEach(() => {
        store.device = { id: 'device-1', externalId: 'ext-1', organizationId: 'org-1', facilityId: 'fac-1', lastSeenAt: null };
        store.readings = [];
        store.nextId = 1;
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('advances lastSeenAt when new readings arrive (test case 4)', async () => {
        const fetchReadings = vi.fn().mockResolvedValue({ readings: [reading('2026-08-05T10:00:00Z')], fieldsUsed: [] });
        await runCycle({ fetchReadings }, 'device-1', baseConfig);
        expect(store.device.lastSeenAt).toEqual(new Date('2026-08-05T10:00:00Z'));
    });

    it('leaves lastSeenAt unchanged (not reset/nulled) on a zero-new-row cycle (test case 4)', async () => {
        store.device.lastSeenAt = new Date('2026-08-05T09:00:00Z');
        const fetchReadings = vi.fn().mockResolvedValue({ readings: [], fieldsUsed: [] });
        await runCycle({ fetchReadings }, 'device-1', baseConfig);
        expect(store.device.lastSeenAt).toEqual(new Date('2026-08-05T09:00:00Z'));
    });

    it('uses an inclusive `from` and dedups a boundary-cluster via skipDuplicates, losing no rows and no unbounded growth (test case 3)', async () => {
        // First poll lands a 3-row cluster sharing the boundary timestamp
        // (e.g. the vendor-confirmed Wi-Fi-setup-period junk). Only one
        // survives the unique constraint — Action Item 1's confirmed,
        // intentional collapse-of-junk behavior, not data loss.
        const clusterTs = '2026-08-05T10:00:00Z';
        const firstFetch = vi
            .fn()
            .mockResolvedValue({ readings: [reading(clusterTs, 1), reading(clusterTs, 2), reading(clusterTs, 3)], fieldsUsed: [] });
        await runCycle({ fetchReadings: firstFetch }, 'device-1', baseConfig);
        expect(store.readings).toHaveLength(1);

        // Second poll's `from` must be the cluster timestamp itself (inclusive),
        // not one millisecond later.
        const secondFetch = vi.fn().mockResolvedValue({ readings: [], fieldsUsed: [] });
        await runCycle({ fetchReadings: secondFetch }, 'device-1', baseConfig);
        const passedFrom = secondFetch.mock.calls[0]![1] as Date;
        expect(passedFrom.toISOString()).toBe(new Date(clusterTs).toISOString());

        // Vendor re-sends the same cluster (legitimate re-poll overlap from the
        // inclusive `from`) plus one genuinely new row.
        const thirdFetch = vi.fn().mockResolvedValue({
            readings: [reading(clusterTs, 1), reading(clusterTs, 2), reading(clusterTs, 3), reading('2026-08-05T10:05:00Z')],
            fieldsUsed: [],
        });
        await runCycle({ fetchReadings: thirdFetch }, 'device-1', baseConfig);

        // Re-polling the same cluster adds nothing (no unbounded duplicate
        // growth), and the new 10:05 row is not lost at the boundary.
        expect(store.readings).toHaveLength(2);
        expect(store.readings.some((r) => r.timestamp.toISOString() === new Date('2026-08-05T10:05:00Z').toISOString())).toBe(true);
    });
});
