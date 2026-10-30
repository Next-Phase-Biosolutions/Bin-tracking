import { beforeEach, describe, expect, it, vi } from 'vitest';

// Every platform-admin sensor and zone procedure must reject anyone who is not a
// platform admin (G26) — and the sweep is driven by the routers' own procedure
// lists, so a newly added procedure that forgot platformAdminProcedure fails here
// instead of silently shipping an open endpoint.

const fleetService = vi.hoisted(() => ({
  addDevices: vi.fn().mockResolvedValue({ added: [], duplicates: [], invalid: [] }),
  assignDevice: vi.fn().mockResolvedValue({}),
  reassignDevice: vi.fn().mockResolvedValue({}),
  deactivateDevice: vi.fn().mockResolvedValue(undefined),
  reactivateDevice: vi.fn().mockResolvedValue(undefined),
}));
const readService = vi.hoisted(() => ({
  listFleetDevices: vi.fn().mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 25 }),
  fleetSummary: vi.fn().mockResolvedValue({}),
  deviceDetail: vi.fn().mockResolvedValue({}),
  deviceReadings: vi.fn().mockResolvedValue([]),
  listOrgAssignmentOptions: vi.fn().mockResolvedValue({}),
  viewAsTenant: vi.fn().mockResolvedValue({}),
  viewAsTenantReadings: vi.fn().mockResolvedValue([]),
}));
const unknownLog = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([]),
  dismiss: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
}));
const settings = vi.hoisted(() => ({
  getOfflineAfterMinutes: vi.fn().mockResolvedValue(20),
  setOfflineAfterMinutes: vi.fn().mockResolvedValue(undefined),
}));
const zones = vi.hoisted(() => ({
  listForFacilities: vi.fn(),
  listForFacility: vi.fn().mockResolvedValue([]),
  create: vi.fn().mockResolvedValue({}),
  rename: vi.fn().mockResolvedValue({}),
  reorder: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/sensor-fleet.service.js', () => ({ sensorFleetService: fleetService }));
vi.mock('../services/sensor-fleet-read.service.js', () => ({ sensorFleetReadService: readService }));
vi.mock('../services/unknown-device-log.service.js', () => ({ unknownDeviceLog: unknownLog }));
vi.mock('../services/platform-settings.service.js', () => ({ platformSettings: settings }));
vi.mock('../services/zone.service.js', () => ({ zoneService: zones }));

const { sensorAdminRouter } = await import('./sensor-admin.router.js');
const { zoneRouter } = await import('./zone.router.js');

// A minimal VALID input per procedure (the auth check runs first, but valid input keeps the sweep honest).
const INPUTS: Record<string, unknown> = {
  addDevices: { externalIds: ['MT-01'] },
  assignDevice: { deviceId: 'd', organizationId: 'o', facilityId: 'f', zoneId: 'z', name: 'N' },
  reassignDevice: { deviceId: 'd', organizationId: 'o', facilityId: 'f', zoneId: 'z', name: 'N' },
  deactivateDevice: { deviceId: 'd' },
  reactivateDevice: { deviceId: 'd' },
  listFleetDevices: {},
  fleetSummary: undefined,
  deviceDetail: { deviceId: 'd' },
  deviceReadings: { deviceId: 'd' },
  listUnknownIds: undefined,
  dismissUnknownIds: { externalIds: ['ghost-1'] },
  clearUnknownIds: undefined,
  orgAssignmentOptions: { organizationId: 'o' },
  viewAsTenant: { organizationId: 'o' },
  viewAsTenantReadings: { organizationId: 'o', deviceId: 'd' },
  getOfflineThreshold: undefined,
  setOfflineThreshold: { minutes: 10 },
  adminList: { facilityId: 'f' },
  adminCreate: { facilityId: 'f', name: 'Cold Room' },
  adminRename: { zoneId: 'z', name: 'X' },
  adminReorder: { facilityId: 'f', zoneIds: ['z'] },
  adminRemove: { zoneId: 'z' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctxFor = (isPlatformAdmin: boolean): any => ({
  user: { id: 'user-1', isPlatformAdmin },
  orgId: 'org-a',
  orgRole: 'ADMIN',
  prisma: {},
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCaller = Record<string, (input?: unknown) => Promise<any>>;
const sensorAdmin = (isAdmin: boolean) => sensorAdminRouter.createCaller(ctxFor(isAdmin)) as unknown as AnyCaller;
const zone = (isAdmin: boolean) => zoneRouter.createCaller(ctxFor(isAdmin)) as unknown as AnyCaller;

const adminProcedures = [
  ...Object.keys(sensorAdminRouter._def.procedures).map((name) => ({ router: 'sensorAdmin', name })),
  ...Object.keys(zoneRouter._def.procedures)
    .filter((name) => name.startsWith('admin'))
    .map((name) => ({ router: 'zone', name })),
];

beforeEach(() => {
  delete process.env['DISABLE_AUTH'];
  vi.clearAllMocks();
});

describe('platform-admin gate', () => {
  it('sweeps a non-trivial procedure list (guards against a vacuous pass)', () => {
    const names = adminProcedures.map((p) => p.name);
    expect(adminProcedures.length).toBeGreaterThanOrEqual(20);
    expect(names).toContain('addDevices');
    expect(names).toContain('adminCreate');
    for (const { name } of adminProcedures) expect(INPUTS, `no sweep input for ${name}`).toHaveProperty(name);
  });

  it.each(adminProcedures)('$router.$name rejects a non-platform-admin with FORBIDDEN and runs nothing', async ({ router, name }) => {
    const caller = router === 'sensorAdmin' ? sensorAdmin(false) : zone(false);
    await expect(caller[name]!(INPUTS[name])).rejects.toMatchObject({ code: 'FORBIDDEN' });

    for (const service of [fleetService, readService, unknownLog, settings, zones]) {
      for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe('platform admin reaches the services', () => {
  it('mutations pass the acting admin id for the audit trail', async () => {
    const caller = sensorAdmin(true);

    await caller['addDevices']!({ externalIds: ['MT-01'] });
    await caller['deactivateDevice']!({ deviceId: 'd' });
    await caller['reactivateDevice']!({ deviceId: 'd' });
    await caller['assignDevice']!(INPUTS['assignDevice']);
    await caller['reassignDevice']!(INPUTS['reassignDevice']);
    await caller['setOfflineThreshold']!({ minutes: 10 });

    expect(fleetService.addDevices).toHaveBeenCalledWith(['MT-01'], 'user-1');
    expect(fleetService.deactivateDevice).toHaveBeenCalledWith('d', 'user-1');
    expect(fleetService.reactivateDevice).toHaveBeenCalledWith('d', 'user-1');
    expect(fleetService.assignDevice).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'd', enableModule: false }), 'user-1');
    expect(fleetService.reassignDevice).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'd' }), 'user-1');
    expect(settings.setOfflineAfterMinutes).toHaveBeenCalledWith(10, 'user-1');
  });

  it('queries reach the read services with parsed defaults', async () => {
    const caller = sensorAdmin(true);

    await caller['listFleetDevices']!({});
    await caller['deviceReadings']!({ deviceId: 'd' });
    await caller['viewAsTenantReadings']!({ organizationId: 'o', deviceId: 'd' });
    await caller['fleetSummary']!();
    await caller['getOfflineThreshold']!();
    await caller['listUnknownIds']!();

    expect(readService.listFleetDevices).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(readService.deviceReadings).toHaveBeenCalledWith('d', '24h');
    expect(readService.viewAsTenantReadings).toHaveBeenCalledWith('o', 'd', '24h', 'user-1');
    expect(readService.fleetSummary).toHaveBeenCalled();
    expect(unknownLog.list).toHaveBeenCalled();
  });

  it('lets an admin dismiss chosen unknown ids and clear the whole list', async () => {
    const caller = sensorAdmin(true);
    await caller['dismissUnknownIds']!({ externalIds: ['ghost-1', 'ghost-2'] });
    await caller['clearUnknownIds']!();
    expect(unknownLog.dismiss).toHaveBeenCalledWith(['ghost-1', 'ghost-2']);
    expect(unknownLog.clear).toHaveBeenCalled();
  });

  it('rejects dismissing an empty selection', async () => {
    await expect(sensorAdmin(true)['dismissUnknownIds']!({ externalIds: [] })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(unknownLog.dismiss).not.toHaveBeenCalled();
  });

  it('getOfflineThreshold returns { minutes }', async () => {
    expect(await sensorAdmin(true)['getOfflineThreshold']!()).toEqual({ minutes: 20 });
  });

  it('rejects an invalid threshold before touching the service', async () => {
    await expect(sensorAdmin(true)['setOfflineThreshold']!({ minutes: 0 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(settings.setOfflineAfterMinutes).not.toHaveBeenCalled();
  });

  it('zone admin procedures reach the zone service', async () => {
    await zone(true)['adminCreate']!({ facilityId: 'f', name: 'Cold Room' });
    expect(zones.create).toHaveBeenCalledWith({ facilityId: 'f', name: 'Cold Room', icon: 'grid' });
  });
});
