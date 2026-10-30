import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the calls sensor-fleet.service.ts makes. The module helpers
// (getEnabledModules / setModuleOverride) and the org-consistency assertion are
// the REAL implementations, so module and tenancy behaviour isn't mocked away.

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
}

const store = vi.hoisted(() => ({
  devices: [] as FakeDevice[],
  readings: [] as Array<{ id: string; deviceId: string; organizationId: string | null; timestamp: Date }>,
  audit: [] as Array<{ deviceId: string; actorId: string; action: string; oldValue: unknown; newValue: unknown; createdAt: Date }>,
  orgs: [] as Array<{ id: string; name: string }>,
  facilities: [] as Array<{ id: string; organizationId: string; deletedAt: Date | null }>,
  zones: [] as Array<{ id: string; facilityId: string }>,
  modules: [] as Array<{ orgId: string; module: string; enabled: boolean }>,
  nextId: 0,
}));

const forgetMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('./unknown-device-log.service.js', () => ({ unknownDeviceLog: { forget: forgetMock } }));

vi.mock('@bin-tracker/db', async () => {
  const { getEnabledModules, setModuleOverride } = await import('../../../../packages/db/src/module-service.js');
  const { assertSensorDeviceOrgConsistency } = await import('../../../../packages/db/src/assert-sensor-device-org.js');

  const prisma = {
    sensorDevice: {
      findUnique: ({ where }: { where: { id?: string; externalId?: string } }) =>
        Promise.resolve(
          store.devices.find((d) => (where.id ? d.id === where.id : d.externalId === where.externalId)) ?? null,
        ),
      findMany: ({ where }: { where: { externalId: { in: string[] } } }) =>
        Promise.resolve(store.devices.filter((d) => where.externalId.in.includes(d.externalId))),
      create: ({ data }: { data: Partial<FakeDevice> & { externalId: string; label: string } }) => {
        store.nextId += 1;
        const created: FakeDevice = {
          id: `dev-${store.nextId}`,
          state: 'UNASSIGNED',
          organizationId: null,
          facilityId: null,
          zoneId: null,
          assignedAt: null,
          lastSeenAt: null,
          ...data,
        };
        store.devices.push(created);
        return Promise.resolve(created);
      },
      update: ({ where, data }: { where: { id: string }; data: Partial<FakeDevice> }) => {
        const device = store.devices.find((d) => d.id === where.id)!;
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) (device as unknown as Record<string, unknown>)[key] = value;
        }
        return Promise.resolve(device);
      },
    },
    sensorDeviceAuditLog: {
      create: ({ data }: { data: { deviceId: string; actorId: string; action: string; oldValue?: unknown; newValue?: unknown } }) => {
        store.audit.push({ oldValue: undefined, newValue: undefined, ...data, createdAt: new Date() });
        return Promise.resolve({});
      },
    },
    organization: {
      findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(store.orgs.find((o) => o.id === where.id) ?? null),
    },
    facility: {
      findFirst: ({ where }: { where: { id: string; deletedAt: null } }) =>
        Promise.resolve(store.facilities.find((f) => f.id === where.id && f.deletedAt === null) ?? null),
    },
    zone: {
      findUnique: ({ where }: { where: { id: string } }) => Promise.resolve(store.zones.find((z) => z.id === where.id) ?? null),
    },
    organizationModule: {
      findMany: ({ where }: { where: { orgId: string; enabled: boolean } }) =>
        Promise.resolve(store.modules.filter((m) => m.orgId === where.orgId && m.enabled === where.enabled)),
      upsert: ({
        where,
        update,
        create,
      }: {
        where: { orgId_module: { orgId: string; module: string } };
        update: { enabled: boolean };
        create: { orgId: string; module: string; enabled: boolean };
      }) => {
        const existing = store.modules.find(
          (m) => m.orgId === where.orgId_module.orgId && m.module === where.orgId_module.module,
        );
        if (existing) existing.enabled = update.enabled;
        else store.modules.push({ orgId: create.orgId, module: create.module, enabled: create.enabled });
        return Promise.resolve({});
      },
    },
    $transaction: (cb: (tx: unknown) => unknown) => cb(prisma),
  };

  return { prisma, getEnabledModules, setModuleOverride, assertSensorDeviceOrgConsistency };
});

const { sensorFleetService } = await import('./sensor-fleet.service.js');

const ACTOR = 'admin-1';

function device(over: Partial<FakeDevice> & { id: string }): FakeDevice {
  return {
    externalId: `ext-${over.id}`,
    label: `ext-${over.id}`,
    state: 'UNASSIGNED',
    organizationId: null,
    facilityId: null,
    zoneId: null,
    assignedAt: null,
    lastSeenAt: null,
    ...over,
  };
}

const assignInput = (over: Record<string, unknown> = {}) => ({
  deviceId: 'dev-u',
  organizationId: 'org-a',
  facilityId: 'fac-a',
  zoneId: 'zone-a1',
  name: 'Cooler 1',
  enableModule: false,
  ...over,
});

beforeEach(() => {
  store.devices = [device({ id: 'dev-u' })];
  store.readings = [];
  store.audit = [];
  store.orgs = [
    { id: 'org-a', name: 'Alpha Co' },
    { id: 'org-b', name: 'Beta Co' },
  ];
  store.facilities = [
    { id: 'fac-a', organizationId: 'org-a', deletedAt: null },
    { id: 'fac-a2', organizationId: 'org-a', deletedAt: null },
    { id: 'fac-b', organizationId: 'org-b', deletedAt: null },
    { id: 'fac-gone', organizationId: 'org-a', deletedAt: new Date() },
  ];
  store.zones = [
    { id: 'zone-a1', facilityId: 'fac-a' },
    { id: 'zone-a2', facilityId: 'fac-a' },
    { id: 'zone-a21', facilityId: 'fac-a2' },
    { id: 'zone-b1', facilityId: 'fac-b' },
  ];
  store.modules = [];
  store.nextId = 0;
  forgetMock.mockClear();
});

describe('sensorFleetService.addDevices', () => {
  it('reports duplicates and invalid ids without failing the batch', async () => {
    store.devices = [device({ id: 'dev-x', externalId: 'EXISTING' })];

    const result = await sensorFleetService.addDevices(['MT-01', 'MT-01x', 'bad id', 'EXISTING'], ACTOR);

    expect(result.added).toEqual(['MT-01', 'MT-01x']);
    expect(result.duplicates).toEqual(['EXISTING']);
    expect(result.invalid).toEqual([{ externalId: 'bad id', reason: expect.any(String) }]);
    expect(store.devices.map((d) => d.externalId).sort()).toEqual(['EXISTING', 'MT-01', 'MT-01x']);
  });

  it('collapses repeats inside the batch and trims whitespace', async () => {
    const result = await sensorFleetService.addDevices(['  MT-01 ', 'MT-01', 'MT-02'], ACTOR);
    expect(result.added).toEqual(['MT-01', 'MT-02']);
    expect(store.devices).toHaveLength(2 + 1); // the fixture device plus two new ones
  });

  it('creates UNASSIGNED devices named after their id, writes one device.add audit per id and forgets them from the unknown log', async () => {
    await sensorFleetService.addDevices(['MT-01', 'MT-02'], ACTOR);

    const created = store.devices.filter((d) => d.externalId.startsWith('MT-'));
    expect(created.every((d) => d.state === 'UNASSIGNED' && d.organizationId === null && d.label === d.externalId)).toBe(true);
    expect(store.audit.map((a) => a.action)).toEqual(['device.add', 'device.add']);
    expect(forgetMock).toHaveBeenCalledWith(['MT-01', 'MT-02']);
  });

  it('does nothing and audits nothing for an all-invalid batch', async () => {
    const result = await sensorFleetService.addDevices(['a b', ''], ACTOR);
    expect(result.added).toEqual([]);
    expect(store.audit).toHaveLength(0);
  });
});

describe('sensorFleetService.assignDevice', () => {
  it('activates an UNASSIGNED device under the org/facility/zone with the given name and assignedAt', async () => {
    const before = Date.now();
    await sensorFleetService.assignDevice(assignInput(), ACTOR);

    const d = store.devices.find((x) => x.id === 'dev-u')!;
    expect(d).toMatchObject({ state: 'ACTIVE', organizationId: 'org-a', facilityId: 'fac-a', zoneId: 'zone-a1', label: 'Cooler 1' });
    expect(d.assignedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('rejects a facility from another org', async () => {
    await expect(sensorFleetService.assignDevice(assignInput({ facilityId: 'fac-b', zoneId: 'zone-b1' }), ACTOR)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(store.devices[0]!.state).toBe('UNASSIGNED');
  });

  it('rejects a deleted facility', async () => {
    await expect(sensorFleetService.assignDevice(assignInput({ facilityId: 'fac-gone' }), ACTOR)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a zone from another facility', async () => {
    await expect(sensorFleetService.assignDevice(assignInput({ zoneId: 'zone-a21' }), ACTOR)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(store.devices[0]!.state).toBe('UNASSIGNED');
  });

  it('rejects a device that is not UNASSIGNED', async () => {
    store.devices = [device({ id: 'dev-u', state: 'ACTIVE', organizationId: 'org-a', facilityId: 'fac-a', assignedAt: new Date() })];
    await expect(sensorFleetService.assignDevice(assignInput(), ACTOR)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects an unknown device', async () => {
    await expect(sensorFleetService.assignDevice(assignInput({ deviceId: 'nope' }), ACTOR)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('enables ENVIRONMENT_MONITORING only when asked', async () => {
    const without = await sensorFleetService.assignDevice(assignInput(), ACTOR);
    expect(without.moduleEnabled).toBe(false);
    expect(store.modules).toEqual([]);

    store.devices = [device({ id: 'dev-u' })];
    const withIt = await sensorFleetService.assignDevice(assignInput({ enableModule: true }), ACTOR);
    expect(withIt.moduleEnabled).toBe(true);
    expect(store.modules).toEqual([{ orgId: 'org-a', module: 'ENVIRONMENT_MONITORING', enabled: true }]);
  });

  it('reports moduleEnabled true without touching modules when the org already has it', async () => {
    store.modules = [{ orgId: 'org-a', module: 'ENVIRONMENT_MONITORING', enabled: true }];
    const result = await sensorFleetService.assignDevice(assignInput(), ACTOR);
    expect(result.moduleEnabled).toBe(true);
    expect(store.modules).toHaveLength(1);
  });
});

describe('sensorFleetService.reassignDevice', () => {
  const T0 = new Date('2026-10-01T00:00:00Z');
  const active = (over: Partial<FakeDevice> = {}) =>
    device({ id: 'dev-u', state: 'ACTIVE', organizationId: 'org-a', facilityId: 'fac-a', zoneId: 'zone-a1', label: 'Cooler 1', assignedAt: T0, ...over });

  it('moves a device to another org, resets assignedAt, and leaves old readings with the previous org', async () => {
    store.devices = [active()];
    store.readings = [{ id: 'r1', deviceId: 'dev-u', organizationId: 'org-a', timestamp: new Date('2026-10-02T00:00:00Z') }];

    await sensorFleetService.reassignDevice(
      assignInput({ organizationId: 'org-b', facilityId: 'fac-b', zoneId: 'zone-b1', name: 'Room 9' }),
      ACTOR,
    );

    expect(store.devices[0]).toMatchObject({ organizationId: 'org-b', facilityId: 'fac-b', zoneId: 'zone-b1', label: 'Room 9' });
    expect(store.devices[0]!.assignedAt!.getTime()).toBeGreaterThan(T0.getTime());
    expect(store.readings[0]!.organizationId).toBe('org-a');
    expect(store.audit.map((a) => a.action)).toEqual(['device.reassign']);
  });

  it('keeps assignedAt when only the zone changes inside the same facility, and audits a zone change', async () => {
    store.devices = [active()];

    await sensorFleetService.reassignDevice(assignInput({ zoneId: 'zone-a2', name: 'Cooler 1' }), ACTOR);

    expect(store.devices[0]).toMatchObject({ zoneId: 'zone-a2' });
    expect(store.devices[0]!.assignedAt).toEqual(T0);
    expect(store.audit.map((a) => a.action)).toEqual(['device.zone_change']);
  });

  it('keeps assignedAt when moving to another facility of the same org, audited as a reassign', async () => {
    store.devices = [active()];

    await sensorFleetService.reassignDevice(assignInput({ facilityId: 'fac-a2', zoneId: 'zone-a21' }), ACTOR);

    expect(store.devices[0]).toMatchObject({ facilityId: 'fac-a2' });
    expect(store.devices[0]!.assignedAt).toEqual(T0);
    expect(store.audit.map((a) => a.action)).toEqual(['device.reassign']);
  });

  it('records old and new placement in the audit entry', async () => {
    store.devices = [active()];
    await sensorFleetService.reassignDevice(assignInput({ zoneId: 'zone-a2', name: 'Renamed' }), ACTOR);
    expect(store.audit[0]).toMatchObject({
      oldValue: { organizationId: 'org-a', facilityId: 'fac-a', zoneId: 'zone-a1', name: 'Cooler 1' },
      newValue: { organizationId: 'org-a', facilityId: 'fac-a', zoneId: 'zone-a2', name: 'Renamed' },
    });
  });

  it('rejects a device that is not ACTIVE', async () => {
    await expect(sensorFleetService.reassignDevice(assignInput(), ACTOR)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects a mismatched facility/zone without changing the device', async () => {
    store.devices = [active()];
    await expect(sensorFleetService.reassignDevice(assignInput({ zoneId: 'zone-b1' }), ACTOR)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(store.devices[0]).toMatchObject({ zoneId: 'zone-a1' });
    expect(store.audit).toHaveLength(0);
  });
});

describe('sensorFleetService deactivate / reactivate', () => {
  const T0 = new Date('2026-10-01T00:00:00Z');

  it('deactivates an ACTIVE device but keeps its placement', async () => {
    store.devices = [device({ id: 'dev-u', state: 'ACTIVE', organizationId: 'org-a', facilityId: 'fac-a', zoneId: 'zone-a1', assignedAt: T0 })];
    await sensorFleetService.deactivateDevice('dev-u', ACTOR);
    expect(store.devices[0]).toMatchObject({ state: 'DEACTIVATED', organizationId: 'org-a', facilityId: 'fac-a', zoneId: 'zone-a1' });
  });

  it('reactivates an assigned device to ACTIVE without touching assignedAt', async () => {
    store.devices = [device({ id: 'dev-u', state: 'DEACTIVATED', organizationId: 'org-a', facilityId: 'fac-a', assignedAt: T0 })];
    await sensorFleetService.reactivateDevice('dev-u', ACTOR);
    expect(store.devices[0]).toMatchObject({ state: 'ACTIVE' });
    expect(store.devices[0]!.assignedAt).toEqual(T0);
  });

  it('reactivates a never-assigned device back to UNASSIGNED', async () => {
    store.devices = [device({ id: 'dev-u', state: 'DEACTIVATED' })];
    await sensorFleetService.reactivateDevice('dev-u', ACTOR);
    expect(store.devices[0]!.state).toBe('UNASSIGNED');
  });

  it('can deactivate an UNASSIGNED device', async () => {
    await sensorFleetService.deactivateDevice('dev-u', ACTOR);
    expect(store.devices[0]!.state).toBe('DEACTIVATED');
  });

  it('rejects deactivating a deactivated device and reactivating a non-deactivated one', async () => {
    store.devices = [device({ id: 'dev-u', state: 'DEACTIVATED' })];
    await expect(sensorFleetService.deactivateDevice('dev-u', ACTOR)).rejects.toMatchObject({ code: 'CONFLICT' });
    store.devices = [device({ id: 'dev-u', state: 'UNASSIGNED' })];
    await expect(sensorFleetService.reactivateDevice('dev-u', ACTOR)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('every mutation writes exactly one audit entry', () => {
  const T0 = new Date('2026-10-01T00:00:00Z');
  const activeFixture = () =>
    device({ id: 'dev-u', state: 'ACTIVE', organizationId: 'org-a', facilityId: 'fac-a', zoneId: 'zone-a1', label: 'Cooler 1', assignedAt: T0 });

  const cases: Array<{ name: string; action: string; setup: () => void; run: () => Promise<unknown> }> = [
    { name: 'addDevices', action: 'device.add', setup: () => { store.devices = []; }, run: () => sensorFleetService.addDevices(['MT-01'], ACTOR) },
    { name: 'assignDevice', action: 'device.assign', setup: () => {}, run: () => sensorFleetService.assignDevice(assignInput(), ACTOR) },
    { name: 'reassignDevice (org change)', action: 'device.reassign', setup: () => { store.devices = [activeFixture()]; }, run: () => sensorFleetService.reassignDevice(assignInput({ organizationId: 'org-b', facilityId: 'fac-b', zoneId: 'zone-b1' }), ACTOR) },
    { name: 'reassignDevice (zone change)', action: 'device.zone_change', setup: () => { store.devices = [activeFixture()]; }, run: () => sensorFleetService.reassignDevice(assignInput({ zoneId: 'zone-a2' }), ACTOR) },
    { name: 'deactivateDevice', action: 'device.deactivate', setup: () => { store.devices = [activeFixture()]; }, run: () => sensorFleetService.deactivateDevice('dev-u', ACTOR) },
    { name: 'reactivateDevice', action: 'device.reactivate', setup: () => { store.devices = [{ ...activeFixture(), state: 'DEACTIVATED' }]; }, run: () => sensorFleetService.reactivateDevice('dev-u', ACTOR) },
  ];

  it.each(cases)('$name → one $action entry with actor and timestamp', async ({ action, setup, run }) => {
    setup();
    await run();
    expect(store.audit).toHaveLength(1);
    expect(store.audit[0]).toMatchObject({ actorId: ACTOR, action });
    expect(store.audit[0]!.createdAt).toBeInstanceOf(Date);
  });
});
