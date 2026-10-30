import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the calls sensor-fleet-read.service.ts makes. getEnabledModules
// is the real implementation. The tenant service is mocked: view-as-tenant must
// DELEGATE to it (that is what makes the admin's view identical to the tenant's).

interface Rel {
  id: string;
  name: string;
}

interface FakeDevice {
  id: string;
  externalId: string;
  label: string;
  state: 'UNASSIGNED' | 'ACTIVE' | 'DEACTIVATED';
  organizationId: string | null;
  facilityId: string | null;
  zoneId: string | null;
  assignedAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  organization: Rel | null;
  facility: Rel | null;
  zone: Rel | null;
}

interface FakeReading {
  id: string;
  deviceId: string;
  organizationId: string | null;
  timestamp: Date;
  tempC: number | null;
  humidityPct: number | null;
  nh3Ppm: number | null;
  rssi: number | null;
  snr: number | null;
  filteredRssi: number | null;
  errorCode: number | null;
  errorMessage: string | null;
  rawPayload: unknown;
}

const store = vi.hoisted(() => ({
  devices: [] as FakeDevice[],
  readings: [] as FakeReading[],
  audit: [] as Array<{ deviceId: string; actorId: string; action: string; oldValue: unknown; newValue: unknown; createdAt: Date }>,
  orgs: [] as Array<{ id: string; name: string }>,
  facilities: [] as Array<{ id: string; name: string; organizationId: string; deletedAt: Date | null; zones: Array<{ id: string; name: string; slug: string; sortOrder: number; devices?: Array<{ id: string; label: string }> }> }>,
  modules: [] as Array<{ orgId: string; module: string; enabled: boolean }>,
  settings: new Map<string, unknown>(),
}));

const tenantService = vi.hoisted(() => ({
  listDevicesForOrg: vi.fn(),
  getDeviceHistory: vi.fn(),
}));
vi.mock('./sensor.service.js', () => ({ sensorService: tenantService }));

vi.mock('@bin-tracker/db', async () => {
  const { getEnabledModules } = await import('../../../../packages/db/src/module-service.js');

  const matches = (d: FakeDevice, where: Record<string, unknown>): boolean => {
    for (const key of ['state', 'organizationId', 'facilityId', 'zoneId'] as const) {
      if (where[key] !== undefined && d[key] !== where[key]) return false;
    }
    const or = where['OR'] as Array<Record<string, { contains: string }>> | undefined;
    if (or) {
      const hit = or.some((clause) => {
        const [field, cond] = Object.entries(clause)[0]!;
        return String((d as unknown as Record<string, unknown>)[field]).toLowerCase().includes(cond.contains.toLowerCase());
      });
      if (!hit) return false;
    }
    return true;
  };

  const prisma = {
    sensorDevice: {
      findMany: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(store.devices.filter((d) => matches(d, where ?? {}))),
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(store.devices.find((d) => d.id === where.id) ?? null),
    },
    sensorReading: {
      findMany: ({
        where,
        take,
      }: {
        where: { deviceId: string; timestamp?: { gte: Date }; errorCode?: { notIn: number[] } };
        take: number;
      }) =>
        Promise.resolve(
          store.readings
            .filter((r) => r.deviceId === where.deviceId)
            .filter((r) => !where.timestamp || r.timestamp >= where.timestamp.gte)
            .filter((r) => !where.errorCode || (r.errorCode !== null && !where.errorCode.notIn.includes(r.errorCode)))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, take),
        ),
      count: ({ where }: { where: { timestamp: { gte: Date } } }) =>
        Promise.resolve(store.readings.filter((r) => r.timestamp >= where.timestamp.gte).length),
    },
    // Tagged-template call: (strings, deviceIds). Returns the newest reading per device.
    $queryRaw: (_strings: TemplateStringsArray, deviceIds: string[]) =>
      Promise.resolve(
        deviceIds.flatMap((id) => {
          const newest = store.readings
            .filter((r) => r.deviceId === id)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
          return newest ? [newest] : [];
        }),
      ),
    sensorDeviceAuditLog: {
      findMany: ({ where, take }: { where: { deviceId: string }; take: number }) =>
        Promise.resolve(
          store.audit
            .filter((a) => a.deviceId === where.deviceId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, take),
        ),
    },
    organization: {
      findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(store.orgs.find((o) => o.id === where.id) ?? null),
    },
    facility: {
      findMany: ({ where }: { where: { organizationId: string; deletedAt: null } }) =>
        Promise.resolve(store.facilities.filter((f) => f.organizationId === where.organizationId && f.deletedAt === null)),
    },
    organizationModule: {
      findMany: ({ where }: { where: { orgId: string; enabled: boolean } }) =>
        Promise.resolve(store.modules.filter((m) => m.orgId === where.orgId && m.enabled === where.enabled)),
    },
    platformSetting: {
      findUnique: ({ where }: { where: { key: string } }) =>
        Promise.resolve(store.settings.has(where.key) ? { key: where.key, value: store.settings.get(where.key) } : null),
    },
  };

  return { prisma, getEnabledModules };
});

const { sensorFleetReadService } = await import('./sensor-fleet-read.service.js');

const NOW = new Date('2026-10-30T12:00:00.000Z');
const MIN = 60_000;
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * MIN);

function device(over: Partial<FakeDevice> & { id: string }): FakeDevice {
  return {
    externalId: `ext-${over.id}`,
    label: `Device ${over.id}`,
    state: 'ACTIVE',
    organizationId: 'org-a',
    facilityId: 'fac-a',
    zoneId: 'zone-a1',
    assignedAt: minutesAgo(600),
    lastSeenAt: minutesAgo(1),
    createdAt: minutesAgo(1000),
    organization: { id: 'org-a', name: 'Alpha Co' },
    facility: { id: 'fac-a', name: 'Alpha Plant' },
    zone: { id: 'zone-a1', name: 'Wet Aging' },
    ...over,
  };
}

function reading(over: Partial<FakeReading> & { id: string; deviceId: string }): FakeReading {
  return {
    organizationId: 'org-a',
    timestamp: minutesAgo(1),
    tempC: 5,
    humidityPct: 50,
    nh3Ppm: null,
    rssi: -70,
    snr: 8,
    filteredRssi: -69,
    errorCode: null,
    errorMessage: null,
    rawPayload: { battery_mv: 3700 },
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  store.devices = [];
  store.readings = [];
  store.audit = [];
  store.orgs = [{ id: 'org-a', name: 'Alpha Co' }];
  store.facilities = [];
  store.modules = [];
  store.settings = new Map();
  tenantService.listDevicesForOrg.mockReset();
  tenantService.getDeviceHistory.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

const input = (over: Record<string, unknown> = {}) => ({ page: 1, pageSize: 25, ...over });

describe('listFleetDevices', () => {
  it('returns hardware fields to admins: external id, signal, fault detail and the raw payload', async () => {
    store.devices = [device({ id: 'a' })];
    store.readings = [reading({ id: 'r1', deviceId: 'a', errorCode: 100, errorMessage: 'timeout' })];

    const { rows } = await sensorFleetReadService.listFleetDevices(input());

    expect(rows[0]).toMatchObject({
      externalId: 'ext-a',
      name: 'Device a',
      organization: { name: 'Alpha Co' },
      latest: { rssi: -70, snr: 8, filteredRssi: -69, errorCode: 100, errorMessage: 'timeout', rawPayload: { battery_mv: 3700 } },
    });
  });

  it('computes a status per device: WAITING, OFFLINE, FAULT, OK', async () => {
    store.devices = [
      device({ id: 'wait', lastSeenAt: null }),
      device({ id: 'off', lastSeenAt: minutesAgo(90) }),
      device({ id: 'fault' }),
      device({ id: 'ok' }),
    ];
    store.readings = [
      reading({ id: 'r-off', deviceId: 'off', timestamp: minutesAgo(90) }),
      reading({ id: 'r-fault', deviceId: 'fault', errorCode: 100 }),
      reading({ id: 'r-ok', deviceId: 'ok' }),
    ];

    const { rows } = await sensorFleetReadService.listFleetDevices(input());
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.status]));

    expect(byId).toEqual({ wait: 'WAITING', off: 'OFFLINE', fault: 'FAULT', ok: 'OK' });
  });

  it('filters by state, organization and search (id or name, case-insensitive)', async () => {
    store.devices = [
      device({ id: 'a', externalId: 'MT-0001', label: 'Cooler 1' }),
      device({ id: 'b', externalId: 'XX-9', state: 'UNASSIGNED', organizationId: null, organization: null }),
      device({ id: 'c', organizationId: 'org-b', organization: { id: 'org-b', name: 'Beta Co' } }),
    ];

    expect((await sensorFleetReadService.listFleetDevices(input({ state: 'UNASSIGNED' }))).rows.map((r) => r.id)).toEqual(['b']);
    expect((await sensorFleetReadService.listFleetDevices(input({ organizationId: 'org-b' }))).rows.map((r) => r.id)).toEqual(['c']);
    expect((await sensorFleetReadService.listFleetDevices(input({ search: 'mt-00' }))).rows.map((r) => r.id)).toEqual(['a']);
    expect((await sensorFleetReadService.listFleetDevices(input({ search: 'COOLER' }))).rows.map((r) => r.id)).toEqual(['a']);
  });

  it('filters by health=fault and paginates AFTER filtering', async () => {
    store.devices = Array.from({ length: 7 }, (_, i) => device({ id: `d${i}`, label: `D${i}` }));
    // d0, d2, d4, d6 fault; the rest are fine.
    store.readings = store.devices.map((d, i) => reading({ id: `r${i}`, deviceId: d.id, errorCode: i % 2 === 0 ? 100 : null }));

    const page1 = await sensorFleetReadService.listFleetDevices(input({ health: 'fault', pageSize: 3 }));
    const page2 = await sensorFleetReadService.listFleetDevices(input({ health: 'fault', pageSize: 3, page: 2 }));

    expect(page1.total).toBe(4);
    expect(page1.rows).toHaveLength(3);
    expect(page2.rows).toHaveLength(1);
    expect([...page1.rows, ...page2.rows].every((r) => r.status === 'FAULT')).toBe(true);
  });

  it('health=online excludes waiting and offline devices', async () => {
    store.devices = [device({ id: 'wait', lastSeenAt: null }), device({ id: 'off', lastSeenAt: minutesAgo(90) }), device({ id: 'ok' })];
    store.readings = [reading({ id: 'r1', deviceId: 'off', timestamp: minutesAgo(90) }), reading({ id: 'r2', deviceId: 'ok' })];

    const { rows } = await sensorFleetReadService.listFleetDevices(input({ health: 'online' }));

    expect(rows.map((r) => r.id)).toEqual(['ok']);
  });
});

describe('fleetSummary', () => {
  it('counts devices by state and ACTIVE devices as online, offline and in fault; counts readings in the last hour', async () => {
    store.devices = [
      device({ id: 'ok' }),
      device({ id: 'fault' }),
      device({ id: 'off', lastSeenAt: minutesAgo(90) }),
      device({ id: 'wait', lastSeenAt: null }),
      device({ id: 'un', state: 'UNASSIGNED', organizationId: null, organization: null }),
      device({ id: 'dead', state: 'DEACTIVATED' }),
    ];
    store.readings = [
      reading({ id: 'r1', deviceId: 'ok' }),
      reading({ id: 'r2', deviceId: 'fault', errorCode: 100, timestamp: minutesAgo(30) }),
      reading({ id: 'r3', deviceId: 'off', timestamp: minutesAgo(90) }),
    ];

    const summary = await sensorFleetReadService.fleetSummary();

    expect(summary.byState).toEqual({ UNASSIGNED: 1, ACTIVE: 4, DEACTIVATED: 1 });
    expect(summary.online).toBe(2); // ok + fault
    expect(summary.offline).toBe(1); // off only: the Offline tile must match the OFFLINE filter
    expect(summary.waiting).toBe(1); // wait: registered and assigned but never reported
    expect(summary.inFault).toBe(1);
    expect(summary.readingsLastHour).toBe(2); // r1 and r2; r3 is 90 min old
    expect(summary.offlineAfterMinutes).toBe(20);
  });

  it('lists FAULT, ALERT and OFFLINE active devices as alerts, newest-seen first, never WAITING or healthy ones', async () => {
    store.devices = [
      device({ id: 'fault', lastSeenAt: minutesAgo(2) }),
      device({ id: 'off', lastSeenAt: minutesAgo(90) }),
      device({ id: 'hot', lastSeenAt: minutesAgo(5) }),
      device({ id: 'ok' }),
      device({ id: 'wait', lastSeenAt: null }),
    ];
    store.readings = [
      reading({ id: 'r1', deviceId: 'fault', errorCode: 100, timestamp: minutesAgo(2) }),
      reading({ id: 'r2', deviceId: 'off', timestamp: minutesAgo(90) }),
      reading({ id: 'r3', deviceId: 'hot', tempC: 99, timestamp: minutesAgo(5) }),
      reading({ id: 'r4', deviceId: 'ok' }),
    ];

    const { alerts } = await sensorFleetReadService.fleetSummary();

    expect(alerts.map((a) => a.id)).toEqual(['fault', 'hot', 'off']);
  });

  it('uses the platform offline threshold when set', async () => {
    store.settings.set('sensor.offlineAfterMinutes', 5);
    store.devices = [device({ id: 'a', lastSeenAt: minutesAgo(10) })];
    store.readings = [reading({ id: 'r1', deviceId: 'a', timestamp: minutesAgo(10) })];

    const summary = await sensorFleetReadService.fleetSummary();

    expect(summary.offlineAfterMinutes).toBe(5);
    expect(summary.offline).toBe(1);
  });
});

describe('deviceDetail', () => {
  it('rejects an unknown device with NOT_FOUND', async () => {
    await expect(sensorFleetReadService.deviceDetail('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns the latest reading, the 100 newest, only real faults, and the audit trail', async () => {
    store.devices = [device({ id: 'a' })];
    store.readings = Array.from({ length: 120 }, (_, i) =>
      reading({ id: `r${i}`, deviceId: 'a', timestamp: minutesAgo(120 - i), errorCode: i === 5 ? 100 : i === 6 ? 0 : null }),
    );
    store.audit = [{ deviceId: 'a', actorId: 'admin-1', action: 'device.assign', oldValue: null, newValue: { name: 'x' }, createdAt: minutesAgo(500) }];

    const detail = await sensorFleetReadService.deviceDetail('a');

    expect(detail.device).toMatchObject({ id: 'a', externalId: 'ext-a', createdAt: expect.any(Date) });
    expect(detail.latest!.id).toBe('r119');
    expect(detail.recent).toHaveLength(100);
    expect(detail.recent[0]!.id).toBe('r119');
    expect(detail.faults.map((f) => f.id)).toEqual(['r5']);
    expect(detail.audit.map((a) => a.action)).toEqual(['device.assign']);
  });

  it('has a null latest for a device that never reported', async () => {
    store.devices = [device({ id: 'a', lastSeenAt: null })];
    const detail = await sensorFleetReadService.deviceDetail('a');
    expect(detail.latest).toBeNull();
    expect(detail.device.status).toBe('WAITING');
  });
});

describe('deviceReadings', () => {
  it('downsamples to the range bucket and returns ascending points', async () => {
    store.devices = [device({ id: 'a' })];
    store.readings = [
      reading({ id: 'r1', deviceId: 'a', timestamp: new Date('2026-10-30T10:00:10Z'), tempC: 4 }),
      reading({ id: 'r2', deviceId: 'a', timestamp: new Date('2026-10-30T10:01:10Z'), tempC: 6 }),
      reading({ id: 'r3', deviceId: 'a', timestamp: new Date('2026-10-30T11:00:00Z'), tempC: 8 }),
    ];

    const points = await sensorFleetReadService.deviceReadings('a', '24h');

    expect(points.map((p) => p.tempC)).toEqual([5, 8]);
    expect(points[0]!.t).toBeLessThan(points[1]!.t);
  });

  it('only includes readings inside the requested range', async () => {
    store.devices = [device({ id: 'a' })];
    store.readings = [
      reading({ id: 'old', deviceId: 'a', timestamp: new Date(NOW.getTime() - 3 * 24 * 60 * MIN), tempC: 1 }),
      reading({ id: 'new', deviceId: 'a', timestamp: minutesAgo(10), tempC: 2 }),
    ];

    expect((await sensorFleetReadService.deviceReadings('a', '24h')).map((p) => p.tempC)).toEqual([2]);
    expect((await sensorFleetReadService.deviceReadings('a', '7d')).map((p) => p.tempC)).toEqual([1, 2]);
  });

  it('rejects an unknown device with NOT_FOUND', async () => {
    await expect(sensorFleetReadService.deviceReadings('nope', '24h')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('view as tenant', () => {
  it("returns exactly the tenant service's list for the org, over all of the org's live facilities", async () => {
    store.facilities = [
      { id: 'fac-a', name: 'A', organizationId: 'org-a', deletedAt: null, zones: [] },
      { id: 'fac-a2', name: 'A2', organizationId: 'org-a', deletedAt: null, zones: [] },
      { id: 'fac-gone', name: 'G', organizationId: 'org-a', deletedAt: new Date(), zones: [] },
    ];
    const tenantList = { companyTimezone: 'America/Toronto', offlineAfterMinutes: 20, devices: [{ id: 'x' }] };
    tenantService.listDevicesForOrg.mockResolvedValue(tenantList);

    const result = await sensorFleetReadService.viewAsTenant('org-a');

    expect(tenantService.listDevicesForOrg).toHaveBeenCalledWith('org-a', ['fac-a', 'fac-a2']);
    expect(result).toEqual({ ...tenantList, organization: { id: 'org-a', name: 'Alpha Co' } });
  });

  it('rejects an unknown organization with NOT_FOUND', async () => {
    await expect(sensorFleetReadService.viewAsTenant('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(tenantService.listDevicesForOrg).not.toHaveBeenCalled();
  });

  it('reads tenant history as an ADMIN of that org, so it is byte-for-byte what the tenant admin gets', async () => {
    tenantService.getDeviceHistory.mockResolvedValue([{ timestamp: NOW, tempC: 1, humidityPct: 2 }]);

    const result = await sensorFleetReadService.viewAsTenantReadings('org-a', 'dev-1', '7d', 'admin-1');

    expect(tenantService.getDeviceHistory).toHaveBeenCalledWith('org-a', 'dev-1', '7d', 'admin-1', 'ADMIN');
    expect(result).toEqual([{ timestamp: NOW, tempC: 1, humidityPct: 2 }]);
  });
});

describe('listOrgAssignmentOptions', () => {
  it("lists the org's live facilities with their zones in order, and whether the module is on", async () => {
    store.facilities = [
      {
        id: 'fac-a',
        name: 'Alpha Plant',
        organizationId: 'org-a',
        deletedAt: null,
        zones: [
          { id: 'z2', name: 'Wet Aging', slug: 'wetaging', sortOrder: 1 },
          { id: 'z1', name: 'Receiving', slug: 'receiving', sortOrder: 0 },
        ],
      },
      { id: 'fac-gone', name: 'Gone', organizationId: 'org-a', deletedAt: new Date(), zones: [] },
    ];

    const off = await sensorFleetReadService.listOrgAssignmentOptions('org-a');
    expect(off.moduleEnabled).toBe(false);
    expect(off.facilities).toEqual([
      {
        id: 'fac-a',
        name: 'Alpha Plant',
        zones: [
          { id: 'z1', name: 'Receiving', slug: 'receiving', devices: [] },
          { id: 'z2', name: 'Wet Aging', slug: 'wetaging', devices: [] },
        ],
      },
    ]);

    store.modules = [{ orgId: 'org-a', module: 'ENVIRONMENT_MONITORING', enabled: true }];
    expect((await sensorFleetReadService.listOrgAssignmentOptions('org-a')).moduleEnabled).toBe(true);
  });

  it('names the ACTIVE devices already in each zone, so the form can warn before a second one is added', async () => {
    store.facilities = [
      {
        id: 'fac-a',
        name: 'Alpha Plant',
        organizationId: 'org-a',
        deletedAt: null,
        zones: [{ id: 'z2', name: 'Wet Aging', slug: 'wetaging', sortOrder: 1, devices: [{ id: 'd1', label: 'Cooler A' }] }],
      },
    ];
    const { facilities } = await sensorFleetReadService.listOrgAssignmentOptions('org-a');
    expect(facilities[0]!.zones[0]!.devices).toEqual([{ id: 'd1', name: 'Cooler A' }]);
  });

  it('rejects an unknown organization with NOT_FOUND', async () => {
    await expect(sensorFleetReadService.listOrgAssignmentOptions('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
