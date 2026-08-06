import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
        organization: {
            findUniqueOrThrow: () => Promise.resolve({ id: 'org-1', slug: 'default' }),
        },
        facility: {
            findUniqueOrThrow: () => Promise.resolve({ id: 'fac-1', organizationId: 'org-1' }),
        },
        sensorDevice: {
            upsert: () => Promise.resolve({ ...store.device }),
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

// Hoisted so the EcoSafeSenseClient mock below can reach it — each test swaps
// in the fetchReadings behaviour it needs before calling main().
const vendor = vi.hoisted(() => ({
    fetchReadings: vi.fn(),
    listDevices: vi.fn(),
}));

vi.mock('./ecosafesense.client.js', () => ({
    EcoSafeSenseClient: class {
        fetchReadings = vendor.fetchReadings;
        listDevices = vendor.listDevices;
    },
}));

const { runCycle, main } = await import('./backfill-sensors.js');

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

// Action Item 10: the initial (pre-setInterval) cycle must catch and continue,
// not propagate to main().catch() -> process.exit(1). Under `restart:
// unless-stopped` an unprotected throw turns a transient vendor hiccup into a
// full container restart instead of one logged, skipped cycle.
describe('main — first-cycle failure resilience', () => {
    beforeEach(() => {
        store.device = { id: 'device-1', externalId: 'ext-1', organizationId: 'org-1', facilityId: 'fac-1', lastSeenAt: null };
        store.readings = [];
        store.nextId = 1;
        vi.useFakeTimers(); // main() ends in setInterval; fake timers stop it holding the test open.
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vendor.listDevices.mockResolvedValue([]);
        process.env['ECOSAFESENSE_BASE_URL'] = 'https://vendor.example';
        process.env['ECOSAFESENSE_CLIENT_ID'] = 'id';
        process.env['ECOSAFESENSE_CLIENT_SECRET'] = 'secret';
        process.env['ECOSAFESENSE_DEVICE_ID'] = 'ext-1';
        process.env['SENSOR_FACILITY_ID'] = 'fac-1';
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        for (const k of [
            'ECOSAFESENSE_BASE_URL',
            'ECOSAFESENSE_CLIENT_ID',
            'ECOSAFESENSE_CLIENT_SECRET',
            'ECOSAFESENSE_DEVICE_ID',
            'SENSOR_FACILITY_ID',
        ]) {
            delete process.env[k];
        }
    });

    it('does not reject when the very first cycle throws — it logs and reaches the poll loop', async () => {
        vendor.fetchReadings.mockRejectedValueOnce(new Error('401 from vendor on first cycle'));

        // The assertion that matters: main() resolves rather than rejecting.
        // A rejection here is exactly what would hit process.exit(1) in prod.
        await expect(main()).resolves.toBeUndefined();

        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('initial cycle failed, continuing to poll loop anyway'),
            expect.any(Error),
        );
        // Reached the poll loop despite the failure.
        expect(vi.getTimerCount()).toBe(1);
    });

    it('still reaches the poll loop on a clean first cycle', async () => {
        vendor.fetchReadings.mockResolvedValue({ readings: [], fieldsUsed: [] });

        await expect(main()).resolves.toBeUndefined();

        expect(console.error).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(1);
    });
});

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
