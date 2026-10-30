import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeThresholdStatus, SENSOR_THRESHOLDS } from '@bin-tracker/types';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the sensorDevice/sensorReading/userFacility/settings/platformSetting
// calls the tenant sensor service makes. It HONOURS `select`, and its fixtures
// carry hardware/debug fields (externalId, rssi, rawPayload, …): a query that
// forgot to `select` only the tenant-safe columns would leak them and fail here.

interface FakeDevice {
  id: string;
  organizationId: string | null;
  facilityId: string | null;
  externalId: string;
  label: string;
  state: 'UNASSIGNED' | 'ACTIVE' | 'DEACTIVATED';
  assignedAt: Date | null;
  lastSeenAt: Date | null;
  zone: { id: string; slug: string; name: string } | null;
  facility: { id: string; name: string } | null;
}

interface FakeReading {
  id: string;
  deviceId: string;
  organizationId: string | null;
  timestamp: Date;
  tempC: number | null;
  humidityPct: number | null;
  nh3Ppm: number | null;
  rssi: number;
  snr: number;
  filteredRssi: number;
  errorCode: number | null;
  errorMessage: string | null;
  rawPayload: unknown;
}

const store = vi.hoisted(() => ({
  devices: [] as FakeDevice[],
  readings: [] as FakeReading[],
  userFacilities: [] as Array<{ userId: string; facilityId: string }>,
  platformSettings: new Map<string, unknown>(),
}));

type Select = Record<string, true | { select: Select }>;

function project(row: Record<string, unknown> | null, select?: Select): Record<string, unknown> | null {
  if (!row) return null;
  if (!select) return row;
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(select)) {
    out[key] = spec === true ? row[key] : project(row[key] as Record<string, unknown> | null, spec.select);
  }
  return out;
}

vi.mock('@bin-tracker/db', () => {
  const sensorDevice = {
    findFirst: ({
      where,
      select,
    }: {
      where: { id: string; organizationId: string; state?: string };
      select?: Select;
    }) =>
      Promise.resolve(
        project(
          (store.devices.find(
            (d) =>
              d.id === where.id &&
              d.organizationId === where.organizationId &&
              (where.state === undefined || d.state === where.state),
          ) ?? null) as unknown as Record<string, unknown> | null,
          select,
        ),
      ),
    findMany: ({
      where,
      select,
    }: {
      where: { organizationId: string; state: string; facilityId: { in: string[] } };
      select?: Select;
    }) =>
      Promise.resolve(
        store.devices
          .filter((d) => d.organizationId === where.organizationId && d.state === where.state)
          .filter((d) => d.facilityId !== null && where.facilityId.in.includes(d.facilityId))
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((d) => project(d as unknown as Record<string, unknown>, select)),
      ),
  };
  const sensorReading = {
    findFirst: ({
      where,
      select,
    }: {
      where: { deviceId: string; organizationId: string; timestamp: { gte: Date } };
      select?: Select;
    }) => {
      const rows = store.readings
        .filter(
          (r) =>
            r.deviceId === where.deviceId &&
            r.organizationId === where.organizationId &&
            r.timestamp >= where.timestamp.gte,
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return Promise.resolve(project((rows[0] ?? null) as unknown as Record<string, unknown> | null, select));
    },
    findMany: ({
      where,
      take,
      select,
    }: {
      where: { deviceId: string; organizationId: string; timestamp: { gte: Date } };
      take: number;
      select?: Select;
    }) => {
      const rows = store.readings
        .filter(
          (r) =>
            r.deviceId === where.deviceId &&
            r.organizationId === where.organizationId &&
            r.timestamp >= where.timestamp.gte,
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, take);
      return Promise.resolve(rows.map((r) => project(r as unknown as Record<string, unknown>, select)));
    },
  };
  const settings = {
    findUnique: () => Promise.resolve(null),
  };
  const platformSetting = {
    findUnique: ({ where }: { where: { key: string } }) =>
      Promise.resolve(store.platformSettings.has(where.key) ? { key: where.key, value: store.platformSettings.get(where.key) } : null),
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

  return { prisma: { sensorDevice, sensorReading, settings, platformSetting, userFacility } };
});

const { sensorService } = await import('./sensor.service.js');

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const T0 = new Date('2026-10-30T08:00:00.000Z'); // assignedAt
const MIN = 60_000;

function device(over: Partial<FakeDevice> & { id: string }): FakeDevice {
  return {
    organizationId: ORG_A,
    facilityId: 'fac-a',
    externalId: `ext-${over.id}`,
    label: `Device ${over.id}`,
    state: 'ACTIVE',
    assignedAt: T0,
    lastSeenAt: null,
    zone: { id: 'zone-wa', slug: 'wetaging', name: 'Wet Aging' },
    facility: { id: 'fac-a', name: 'Alpha Plant' },
    ...over,
  };
}

function reading(over: Partial<FakeReading> & { id: string; deviceId: string }): FakeReading {
  return {
    organizationId: ORG_A,
    timestamp: new Date(T0.getTime() + 10 * MIN),
    tempC: 5,
    humidityPct: 80,
    nh3Ppm: null,
    rssi: -70,
    snr: 8,
    filteredRssi: -69,
    errorCode: 0,
    errorMessage: 'none',
    rawPayload: { battery_mv: 3700 },
    ...over,
  };
}

beforeEach(() => {
  store.devices = [];
  store.readings = [];
  store.userFacilities = [];
  store.platformSettings = new Map();
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

describe('computeThresholdStatus — fault-only readings (null temp/humidity)', () => {
  it('is UNKNOWN when nothing measurable is present', () => {
    expect(computeThresholdStatus({ tempC: null, humidityPct: null, nh3Ppm: null })).toBe('UNKNOWN');
  });

  it('judges on the metrics that are present, ignoring a null one', () => {
    expect(computeThresholdStatus({ tempC: 5, humidityPct: null, nh3Ppm: null })).toBe('OK');
    expect(
      computeThresholdStatus({ tempC: SENSOR_THRESHOLDS.temp.alertHigh + 1, humidityPct: null, nh3Ppm: null }),
    ).toBe('ALERT');
  });

  it('still escalates on nh3 when temp and humidity are both missing', () => {
    expect(
      computeThresholdStatus({ tempC: null, humidityPct: null, nh3Ppm: SENSOR_THRESHOLDS.nh3.alertPpm + 1 }),
    ).toBe('ALERT');
  });
});

describe('sensorService.listDevicesForOrg — who is listed', () => {
  it('never lists UNASSIGNED or DEACTIVATED devices', async () => {
    store.devices = [
      device({ id: 'live' }),
      device({ id: 'unassigned', state: 'UNASSIGNED', organizationId: null, facilityId: null, assignedAt: null, zone: null, facility: null }),
      device({ id: 'off', state: 'DEACTIVATED' }),
    ];

    const result = await sensorService.listDevicesForOrg(ORG_A, ['fac-a']);

    expect(result.devices.map((d) => d.id)).toEqual(['live']);
  });

  it("never lists another org's device", async () => {
    store.devices = [device({ id: 'mine' }), device({ id: 'theirs', organizationId: ORG_B })];

    const result = await sensorService.listDevicesForOrg(ORG_A, ['fac-a']);

    expect(result.devices.map((d) => d.id)).toEqual(['mine']);
  });

  it("only lists devices in the caller's own facilities", async () => {
    store.devices = [
      device({ id: 'a' }),
      device({ id: 'b', facilityId: 'fac-b', facility: { id: 'fac-b', name: 'Beta Plant' } }),
    ];

    const result = await sensorService.listDevicesForOrg(ORG_A, ['fac-b']);

    expect(result.devices.map((d) => d.id)).toEqual(['b']);
  });

  it('returns the device name, zone and facility', async () => {
    store.devices = [device({ id: 'a', label: 'Cooler 1' })];

    const [d] = (await sensorService.listDevicesForOrg(ORG_A, ['fac-a'])).devices;

    expect(d).toMatchObject({
      name: 'Cooler 1',
      zone: { id: 'zone-wa', slug: 'wetaging', name: 'Wet Aging' },
      facility: { id: 'fac-a', name: 'Alpha Plant' },
    });
  });
});

describe('sensorService.listDevicesForOrg — what a tenant may see of the readings', () => {
  it('excludes readings timestamped before assignedAt', async () => {
    store.devices = [device({ id: 'a', lastSeenAt: new Date(T0.getTime() + 30 * MIN) })];
    store.readings = [
      reading({ id: 'old', deviceId: 'a', timestamp: new Date(T0.getTime() - 5 * MIN), tempC: 99 }),
      reading({ id: 'new', deviceId: 'a', timestamp: new Date(T0.getTime() + 5 * MIN), tempC: 4 }),
    ];

    const [d] = (await sensorService.listDevicesForOrg(ORG_A, ['fac-a'])).devices;

    expect(d!.latest).toMatchObject({ tempC: 4 });
  });

  it('shows no latest reading when every reading predates assignedAt', async () => {
    store.devices = [device({ id: 'a' })];
    store.readings = [reading({ id: 'old', deviceId: 'a', timestamp: new Date(T0.getTime() - MIN) })];

    const [d] = (await sensorService.listDevicesForOrg(ORG_A, ['fac-a'])).devices;

    expect(d!.latest).toBeNull();
    expect(d!.latestStatus).toBe('UNKNOWN');
  });

  it('excludes readings stamped with a previous org after reassignment', async () => {
    store.devices = [device({ id: 'a' })];
    store.readings = [
      reading({ id: 'prev-tenant', deviceId: 'a', organizationId: ORG_B, tempC: 99, timestamp: new Date(T0.getTime() + 20 * MIN) }),
      reading({ id: 'mine', deviceId: 'a', tempC: 4, timestamp: new Date(T0.getTime() + 10 * MIN) }),
    ];

    const [d] = (await sensorService.listDevicesForOrg(ORG_A, ['fac-a'])).devices;

    expect(d!.latest).toMatchObject({ tempC: 4 });
  });

  it('hides a pre-assignment lastSeenAt (the device reported before this tenant owned it)', async () => {
    store.devices = [device({ id: 'a', lastSeenAt: new Date(T0.getTime() - 60 * MIN) })];

    const [d] = (await sensorService.listDevicesForOrg(ORG_A, ['fac-a'])).devices;

    expect(d!.lastSeenAt).toBeNull();
  });

  it('keeps lastSeenAt once the device has reported since assignment', async () => {
    const seen = new Date(T0.getTime() + 5 * MIN);
    store.devices = [device({ id: 'a', lastSeenAt: seen })];

    const [d] = (await sensorService.listDevicesForOrg(ORG_A, ['fac-a'])).devices;

    expect(d!.lastSeenAt).toEqual(seen);
  });

  it('derives latestStatus from the latest tenant-visible reading', async () => {
    store.devices = [device({ id: 'a' })];
    store.readings = [reading({ id: 'hot', deviceId: 'a', tempC: SENSOR_THRESHOLDS.temp.alertHigh + 1 })];

    const [d] = (await sensorService.listDevicesForOrg(ORG_A, ['fac-a'])).devices;

    expect(d!.latestStatus).toBe('ALERT');
  });
});

describe('sensorService — tenant responses carry no hardware or debug fields', () => {
  const FORBIDDEN = ['rawPayload', 'rssi', 'snr', 'filteredRssi', 'errorCode', 'errorMessage', 'externalId'];

  function keysDeep(value: unknown, found = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach((v) => keysDeep(v, found));
    else if (value && typeof value === 'object' && !(value instanceof Date)) {
      for (const [k, v] of Object.entries(value)) {
        found.add(k);
        keysDeep(v, found);
      }
    }
    return found;
  }

  it('listDevicesForOrg and getDeviceHistory never expose them', async () => {
    store.devices = [device({ id: 'a', lastSeenAt: new Date(T0.getTime() + 10 * MIN) })];
    store.readings = [reading({ id: 'r1', deviceId: 'a' }), reading({ id: 'r2', deviceId: 'a', timestamp: new Date(T0.getTime() + 20 * MIN) })];

    const list = await sensorService.listDevicesForOrg(ORG_A, ['fac-a']);
    const history = await sensorService.getDeviceHistory(ORG_A, 'a', '24h', 'user-1', 'ADMIN');

    for (const result of [list, history]) {
      const keys = keysDeep(result);
      for (const forbidden of FORBIDDEN) expect(keys.has(forbidden)).toBe(false);
    }
    expect(history).toHaveLength(2);
    expect(Object.keys(history[0]!).sort()).toEqual(['humidityPct', 'tempC', 'timestamp']);
  });
});

describe('sensorService.listDevicesForOrg — offline threshold', () => {
  it('defaults offlineAfterMinutes to 20 when no platform setting exists', async () => {
    const result = await sensorService.listDevicesForOrg(ORG_A, []);
    expect(result.offlineAfterMinutes).toBe(20);
  });

  it('returns the platform setting when one is stored', async () => {
    store.platformSettings.set('sensor.offlineAfterMinutes', 5);
    const result = await sensorService.listDevicesForOrg(ORG_A, []);
    expect(result.offlineAfterMinutes).toBe(5);
  });
});

describe('sensorService.getDeviceHistory — who may read', () => {
  it('rejects UNASSIGNED, DEACTIVATED and foreign-org devices with NOT_FOUND', async () => {
    store.devices = [
      device({ id: 'off', state: 'DEACTIVATED' }),
      device({ id: 'theirs', organizationId: ORG_B }),
    ];
    for (const id of ['off', 'theirs', 'missing']) {
      await expect(sensorService.getDeviceHistory(ORG_A, id, '24h', 'user-1', 'ADMIN')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    }
  });

  it('rejects a non-ADMIN caller with no UserFacility row for the device — same org, wrong facility', async () => {
    store.devices = [device({ id: 'dev-1', facilityId: 'fac-b' })];
    store.userFacilities.push({ userId: 'user-1', facilityId: 'fac-a' });

    await expect(sensorService.getDeviceHistory(ORG_A, 'dev-1', '24h', 'user-1', 'WORKER')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it("resolves for a non-ADMIN caller assigned to the device's own facility", async () => {
    store.devices = [device({ id: 'dev-1' })];
    store.userFacilities.push({ userId: 'user-1', facilityId: 'fac-a' });
    store.readings = [reading({ id: 'r-1', deviceId: 'dev-1' })];

    const result = await sensorService.getDeviceHistory(ORG_A, 'dev-1', '24h', 'user-1', 'WORKER');

    expect(result).toHaveLength(1);
  });
});

describe('sensorService.getDeviceHistory — visibility window', () => {
  it('excludes readings timestamped before assignedAt', async () => {
    store.devices = [device({ id: 'a' })];
    store.readings = [
      reading({ id: 'old', deviceId: 'a', timestamp: new Date(T0.getTime() - MIN) }),
      reading({ id: 'new', deviceId: 'a', timestamp: new Date(T0.getTime() + MIN), tempC: 6 }),
    ];

    const result = await sensorService.getDeviceHistory(ORG_A, 'a', '24h', 'user-1', 'ADMIN');

    expect(result.map((r) => r.tempC)).toEqual([6]);
  });

  it('excludes readings stamped with a previous org', async () => {
    store.devices = [device({ id: 'a' })];
    store.readings = [
      reading({ id: 'prev', deviceId: 'a', organizationId: ORG_B, tempC: 99 }),
      reading({ id: 'mine', deviceId: 'a', tempC: 6, timestamp: new Date(T0.getTime() + 20 * MIN) }),
    ];

    const result = await sensorService.getDeviceHistory(ORG_A, 'a', '24h', 'user-1', 'ADMIN');

    expect(result.map((r) => r.tempC)).toEqual([6]);
  });

  it('caps the result and keeps the most recent rows, not the oldest', async () => {
    store.devices = [device({ id: 'dev-1', assignedAt: new Date(Date.now() - 6 * 24 * 60 * MIN) })];
    const READINGS_TAKE_LIMIT = 2000;
    const now = Date.now();
    for (let i = 0; i < READINGS_TAKE_LIMIT + 50; i += 1) {
      store.readings.push(
        reading({
          id: `r-${i}`,
          deviceId: 'dev-1',
          // Oldest first: i=0 is the oldest reading, i=max is the newest.
          timestamp: new Date(now - (READINGS_TAKE_LIMIT + 50 - i) * MIN),
          tempC: i,
        }),
      );
    }

    const result = await sensorService.getDeviceHistory(ORG_A, 'dev-1', '7d', 'user-1', 'ADMIN');

    expect(result).toHaveLength(READINGS_TAKE_LIMIT);
    // Retained rows are the newest ones, still in ascending order for the chart.
    expect(result[0]!.tempC).toBe(50);
    expect(result[result.length - 1]!.tempC).toBe(READINGS_TAKE_LIMIT + 49);
    expect(result[0]!.timestamp.getTime()).toBeLessThan(result[result.length - 1]!.timestamp.getTime());
  });
});

// Regression guard: an env-var allowlist used to make named devices visible to
// every org, skipping the org and facility checks. It was removed — tenant
// isolation is now unconditional — so setting the old variable must change
// nothing. (Module-level state in the old design is why these re-import fresh.)
describe('tenant isolation is unconditional (legacy SHARED_SENSOR_DEVICE_IDS is ignored)', () => {
  const FOREIGN_ID = 'dev-foreign';

  beforeEach(() => {
    store.devices = [device({ id: FOREIGN_ID, organizationId: 'org-owner', facilityId: 'fac-owner' })];
    vi.resetModules();
    process.env['SHARED_SENSOR_DEVICE_IDS'] = FOREIGN_ID;
  });

  afterEach(() => {
    delete process.env['SHARED_SENSOR_DEVICE_IDS'];
  });

  it("listDevicesForOrg does not list another org's device even if named in the old env var", async () => {
    const { sensorService: freshSensorService } = await import('./sensor.service.js');

    const result = await freshSensorService.listDevicesForOrg('org-that-owns-nothing', []);

    expect(result.devices).toEqual([]);
  });

  it("getDeviceHistory rejects another org's device with NOT_FOUND even if named in the old env var", async () => {
    const { sensorService: freshSensorService } = await import('./sensor.service.js');

    await expect(
      freshSensorService.getDeviceHistory('org-that-owns-nothing', FOREIGN_ID, '24h', 'user-1', 'WORKER'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
