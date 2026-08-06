import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeThresholdStatus, SENSOR_THRESHOLDS } from '@bin-tracker/types';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the sensorDevice/sensorReading queries sensor.service.ts uses.

interface FakeDevice {
  id: string;
  organizationId: string;
  facilityId?: string;
  label?: string;
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
  return {
    devices: [] as FakeDevice[],
    readings: [] as FakeReading[],
    userFacilities: [] as Array<{ userId: string; facilityId: string }>,
  };
});

vi.mock('@bin-tracker/db', () => {
  const sensorDevice = {
    findFirst: ({ where }: { where: { id: string; organizationId: string } }) =>
      Promise.resolve(
        store.devices.find((d) => d.id === where.id && d.organizationId === where.organizationId) ??
          null,
      ),
    findUnique: ({ where }: { where: { id: string } }) =>
      Promise.resolve(store.devices.find((d) => d.id === where.id) ?? null),
    findMany: ({
      where,
    }: {
      where: { organizationId?: string; facilityId?: { in: string[] }; id?: { in: string[] } };
    }) =>
      Promise.resolve(
        store.devices
          .filter(
            (d) => where.organizationId === undefined || d.organizationId === where.organizationId,
          )
          .filter(
            (d) =>
              where.facilityId === undefined ||
              (d.facilityId && where.facilityId.in.includes(d.facilityId)),
          )
          .filter((d) => where.id === undefined || where.id.in.includes(d.id))
          .map((d) => ({ ...d, readings: [] })),
      ),
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
  const settings = {
    findUnique: () => Promise.resolve(null),
  };
  const userFacility = {
    findUnique: ({ where }: { where: { userId_facilityId: { userId: string; facilityId: string } } }) =>
      Promise.resolve(
        store.userFacilities.some(
          (uf) =>
            uf.userId === where.userId_facilityId.userId &&
            uf.facilityId === where.userId_facilityId.facilityId,
        )
          ? where.userId_facilityId
          : null,
      ),
  };

  return { prisma: { sensorDevice, sensorReading, settings, userFacility } };
});

const { sensorService } = await import('./sensor.service.js');

const ORG_A = 'org-a';

beforeEach(() => {
  store.devices = [];
  store.readings = [];
  store.userFacilities = [];
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

describe('sensorService.getDeviceHistory — facility scoping', () => {
  it('rejects a non-ADMIN caller with no UserFacility row for the device — same org, wrong facility', async () => {
    store.devices.push({ id: 'dev-1', organizationId: ORG_A, facilityId: 'fac-b' });
    // Caller belongs to the org but is only assigned to a different facility.
    store.userFacilities.push({ userId: 'user-1', facilityId: 'fac-a' });

    await expect(
      sensorService.getDeviceHistory(ORG_A, 'dev-1', '24h', 'user-1', 'WORKER'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('resolves for a non-ADMIN caller assigned to the device\'s own facility', async () => {
    store.devices.push({ id: 'dev-1', organizationId: ORG_A, facilityId: 'fac-a' });
    store.userFacilities.push({ userId: 'user-1', facilityId: 'fac-a' });
    store.readings.push({ id: 'r-1', deviceId: 'dev-1', timestamp: new Date(), tempC: 5, humidityPct: 50, nh3Ppm: 0 });

    const result = await sensorService.getDeviceHistory(ORG_A, 'dev-1', '24h', 'user-1', 'WORKER');

    expect(result).toHaveLength(1);
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

    // ADMIN bypasses the facility check — this test is about the take limit, not facility scoping.
    const result = await sensorService.getDeviceHistory(ORG_A, 'dev-1', '7d', 'user-1', 'ADMIN');

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

describe('sensorService.listDevicesForOrg', () => {
  it("returns only the caller's own devices when no device is on the shared allowlist", async () => {
    store.devices.push({ id: 'dev-a', organizationId: ORG_A, facilityId: 'fac-a' });
    store.devices.push({ id: 'dev-b', organizationId: 'org-b', facilityId: 'fac-b' });

    const result = await sensorService.listDevicesForOrg(ORG_A, ['fac-a']);

    expect(result.devices.map((d) => d.id)).toEqual(['dev-a']);
  });
});

// Reads SHARED_SENSOR_DEVICE_IDS at module-load time (apps/api/src/services/
// sensor.service.ts), so these tests set the env var and re-import via
// resetModules — same pattern sensor.router.test.ts uses for its
// DISABLE_AUTH-dependent case — rather than mutating process.env after the
// module (and its already-frozen Set) is loaded.
describe('shared-device allowlist (SHARED_SENSOR_DEVICE_IDS)', () => {
  const SHARED_ID = 'dev-shared';

  beforeEach(() => {
    store.devices = [];
    store.readings = [];
    store.userFacilities = [];
    vi.resetModules();
    process.env['SHARED_SENSOR_DEVICE_IDS'] = SHARED_ID;
  });

  afterEach(() => {
    delete process.env['SHARED_SENSOR_DEVICE_IDS'];
  });

  it('listDevicesForOrg includes the shared device for an org that owns nothing', async () => {
    store.devices.push({ id: SHARED_ID, organizationId: 'org-owner', facilityId: 'fac-owner' });
    const { sensorService: freshSensorService } = await import('./sensor.service.js');

    const result = await freshSensorService.listDevicesForOrg('org-that-owns-nothing', []);

    expect(result.devices.map((d) => d.id)).toEqual([SHARED_ID]);
  });

  it('does not duplicate the shared device when the caller also owns it', async () => {
    store.devices.push({ id: SHARED_ID, organizationId: ORG_A, facilityId: 'fac-a' });
    const { sensorService: freshSensorService } = await import('./sensor.service.js');

    const result = await freshSensorService.listDevicesForOrg(ORG_A, ['fac-a']);

    expect(result.devices).toHaveLength(1);
  });

  it("a NON-shared device from a foreign org still does not leak — the allowlist doesn't widen the general check", async () => {
    store.devices.push({ id: SHARED_ID, organizationId: 'org-owner', facilityId: 'fac-owner' });
    store.devices.push({ id: 'dev-private', organizationId: 'org-owner', facilityId: 'fac-owner' });
    const { sensorService: freshSensorService } = await import('./sensor.service.js');

    const result = await freshSensorService.listDevicesForOrg('org-that-owns-nothing', []);

    expect(result.devices.map((d) => d.id)).toEqual([SHARED_ID]);
    expect(result.devices.some((d) => d.id === 'dev-private')).toBe(false);
  });

  it('getDeviceHistory resolves the shared device for any organizationId', async () => {
    store.devices.push({ id: SHARED_ID, organizationId: 'org-owner' });
    store.readings.push({
      id: 'r-1',
      deviceId: SHARED_ID,
      timestamp: new Date(),
      tempC: 30,
      humidityPct: 40,
      nh3Ppm: 0.05,
    });
    const { sensorService: freshSensorService } = await import('./sensor.service.js');

    // Non-ADMIN, no UserFacility row anywhere in the store — proves the shared
    // bypass skips the facility check too, not just the org check.
    const result = await freshSensorService.getDeviceHistory(
      'org-that-owns-nothing',
      SHARED_ID,
      '24h',
      'user-1',
      'WORKER',
    );

    expect(result).toHaveLength(1);
  });

  it('getDeviceHistory still rejects a NON-shared foreign-org device with NOT_FOUND', async () => {
    store.devices.push({ id: 'dev-private', organizationId: 'org-owner' });
    const { sensorService: freshSensorService } = await import('./sensor.service.js');

    await expect(
      freshSensorService.getDeviceHistory('org-that-owns-nothing', 'dev-private', '24h', 'user-1', 'WORKER'),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
