import { beforeEach, describe, expect, it, vi } from 'vitest';

// zone.listMine must scope to the caller's own facilities (same rule as
// sensor.listDevices): an ADMIN gets every non-deleted facility of their org, a
// non-admin only their UserFacility rows. Never a client-supplied id.

const zoneServiceMock = {
  listForFacilities: vi.fn().mockResolvedValue([]),
  listForFacility: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  reorder: vi.fn(),
  remove: vi.fn(),
};

vi.mock('../services/zone.service.js', () => ({ zoneService: zoneServiceMock }));

const { zoneRouter } = await import('./zone.router.js');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(orgRole: string, opts: { allFacilities?: string[]; userFacilities?: string[] } = {}): any {
  return {
    orgId: 'org-a',
    user: { id: 'user-1' },
    orgRole,
    prisma: {
      facility: { findMany: vi.fn().mockResolvedValue((opts.allFacilities ?? []).map((id) => ({ id }))) },
      userFacility: {
        findMany: vi.fn().mockResolvedValue((opts.userFacilities ?? []).map((facilityId) => ({ facilityId }))),
      },
    },
  };
}

beforeEach(() => {
  delete process.env['DISABLE_AUTH'];
  vi.clearAllMocks();
});

describe('zone.listMine', () => {
  it("passes an ADMIN every facility of their org", async () => {
    const caller = zoneRouter.createCaller(makeCtx('ADMIN', { allFacilities: ['f-1', 'f-2'] }));
    await caller.listMine();
    expect(zoneServiceMock.listForFacilities).toHaveBeenCalledWith(['f-1', 'f-2']);
  });

  it('passes a non-admin only their assigned facilities', async () => {
    const caller = zoneRouter.createCaller(makeCtx('WORKER', { allFacilities: ['f-1', 'f-2'], userFacilities: ['f-2'] }));
    await caller.listMine();
    expect(zoneServiceMock.listForFacilities).toHaveBeenCalledWith(['f-2']);
  });

  it('rejects a caller with no org role as UNAUTHORIZED', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.orgRole = null;
    await expect(zoneRouter.createCaller(ctx).listMine()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
