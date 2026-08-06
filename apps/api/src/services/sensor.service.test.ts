import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeThresholdStatus, SENSOR_THRESHOLDS } from '@bin-tracker/types';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the sensorDevice/sensorReading queries sensor.service.ts uses.

interface FakeDevice {
    id: string;
    organizationId: string;
}

interface FakeReading {
    id: string;
    deviceId: string;
    timestamp: Date;
    tempC: number;
    humidityPct: number;
    nh3Ppm: number | null;
}

const store = vi.hoisted(() => {
    return { devices: [] as FakeDevice[], readings: [] as FakeReading[] };
});

vi.mock('@bin-tracker/db', () => {
    const sensorDevice = {
        findFirst: ({ where }: { where: { id: string; organizationId: string } }) =>
            Promise.resolve(store.devices.find((d) => d.id === where.id && d.organizationId === where.organizationId) ?? null),
    };
    const sensorReading = {
        findMany: ({
            where,
            take,
        }: {
            where: { deviceId: string; timestamp: { gte: Date } };
            take: number;
        }) => {
            const rows = store.readings
                .filter((r) => r.deviceId === where.deviceId && r.timestamp >= where.timestamp.gte)
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, take);
            return Promise.resolve(rows);
        },
    };

    return { prisma: { sensorDevice, sensorReading } };
});

const { sensorService } = await import('./sensor.service.js');

const ORG_A = 'org-a';

beforeEach(() => {
    store.devices = [];
    store.readings = [];
});

describe('computeThresholdStatus — boundaries', () => {
    it('is OK at the edge of the warn band (inclusive)', () => {
        expect(
            computeThresholdStatus({
                tempC: SENSOR_THRESHOLDS.temp.warnHigh,
                humidityPct: 50,
                nh3Ppm: SENSOR_THRESHOLDS.nh3.warnPpm,
            }),
        ).toBe('OK');
    });

    it('is WARN just past the warn boundary', () => {
        expect(
            computeThresholdStatus({
                tempC: SENSOR_THRESHOLDS.temp.warnHigh + 0.1,
                humidityPct: 50,
                nh3Ppm: 0,
            }),
        ).toBe('WARN');
    });

    it('is ALERT just past the alert boundary', () => {
        expect(
            computeThresholdStatus({
                tempC: SENSOR_THRESHOLDS.temp.alertHigh + 0.1,
                humidityPct: 50,
                nh3Ppm: 0,
            }),
        ).toBe('ALERT');
    });

    it('humidity WARN just below the low warn boundary', () => {
        expect(
            computeThresholdStatus({
                tempC: 5,
                humidityPct: SENSOR_THRESHOLDS.humidity.warnLow - 0.1,
                nh3Ppm: 0,
            }),
        ).toBe('WARN');
    });

    it('nh3 ALERT just past the alert boundary', () => {
        expect(
            computeThresholdStatus({
                tempC: 5,
                humidityPct: 50,
                nh3Ppm: SENSOR_THRESHOLDS.nh3.alertPpm + 0.1,
            }),
        ).toBe('ALERT');
    });

    it('overall is the worst of the three metrics', () => {
        expect(
            computeThresholdStatus({
                tempC: 5, // OK
                humidityPct: SENSOR_THRESHOLDS.humidity.warnHigh + 1, // WARN
                nh3Ppm: SENSOR_THRESHOLDS.nh3.alertPpm + 1, // ALERT
            }),
        ).toBe('ALERT');
    });
});

describe('sensorService.getDeviceHistory — take limit', () => {
    it('caps the result and keeps the most recent rows, not the oldest', async () => {
        store.devices.push({ id: 'dev-1', organizationId: ORG_A });

        const READINGS_TAKE_LIMIT = 2000;
        const now = Date.now();
        for (let i = 0; i < READINGS_TAKE_LIMIT + 50; i += 1) {
            store.readings.push({
                id: `r-${i}`,
                deviceId: 'dev-1',
                // Oldest first: i=0 is the oldest reading, i=max is the newest.
                timestamp: new Date(now - (READINGS_TAKE_LIMIT + 50 - i) * 60 * 1000),
                tempC: 5,
                humidityPct: 50,
                nh3Ppm: 0,
            });
        }

        const result = await sensorService.getDeviceHistory(ORG_A, 'dev-1', '7d');

        expect(result).toHaveLength(READINGS_TAKE_LIMIT);
        const oldestKept = result[0];
        const newestKept = result[result.length - 1];
        if (!oldestKept || !newestKept) throw new Error('expected at least two rows');
        // Retained rows are the newest ones, still in ascending order for the chart.
        expect(oldestKept.id).toBe('r-50');
        expect(newestKept.id).toBe(`r-${READINGS_TAKE_LIMIT + 49}`);
        expect(oldestKept.timestamp.getTime()).toBeLessThan(newestKept.timestamp.getTime());
    });
});
