import { describe, it, expect, vi, beforeEach } from 'vitest';

// Task 25 regression: cycle.listActive's facility-scoping ADMIN branch
// (via getUserFacilityIds, trpc/middleware.ts) must key off ctx.orgRole,
// never the global ctx.user.role. getUserFacilityIds is the real
// implementation, driven against a fake ctx.prisma.

vi.mock('../services/cycle.service.js', () => ({
    cycleService: {
        listActive: vi.fn().mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 }),
        pickup: vi.fn().mockResolvedValue({ ok: true }),
        deliver: vi.fn().mockResolvedValue({ ok: true }),
    },
}));

const { cycleRouter } = await import('./cycle.router.js');
const { cycleService } = await import('../services/cycle.service.js');

const ORG_A = 'org-a';

// cycleService is a module-level mock shared across every test in this file
// (vi.mock above) — without clearing, .not.toHaveBeenCalled() assertions in
// later tests would see calls left over from earlier ones.
beforeEach(() => {
    vi.clearAllMocks();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(userRole: string, orgRole: string | null): any {
    return {
        orgId: ORG_A,
        user: { id: 'user-1', role: userRole },
        orgRole,
        prisma: {
            facility: { findMany: vi.fn().mockResolvedValue([{ id: 'f-all-1' }, { id: 'f-all-2' }]) },
            userFacility: { findMany: vi.fn().mockResolvedValue([{ facilityId: 'f-assigned-1' }]) },
        },
    };
}

describe('cycle.listActive — facility scoping keys off ctx.orgRole, not ctx.user.role', () => {
    it('global ADMIN with org role WORKER gets only assigned facilities, not every facility in the org', async () => {
        const ctx = makeCtx('ADMIN', 'WORKER');
        const caller = cycleRouter.createCaller(ctx);

        await caller.listActive({ limit: 20 });

        expect(ctx.prisma.userFacility.findMany).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            select: { facilityId: true },
        });
        expect(ctx.prisma.facility.findMany).not.toHaveBeenCalled();
        expect(cycleService.listActive).toHaveBeenCalledWith(ORG_A, expect.anything(), ['f-assigned-1'], 'WORKER');
    });

    it('global WORKER with org role ADMIN gets every facility in the org, not just assigned ones', async () => {
        const ctx = makeCtx('WORKER', 'ADMIN');
        const caller = cycleRouter.createCaller(ctx);

        await caller.listActive({ limit: 20 });

        expect(ctx.prisma.facility.findMany).toHaveBeenCalledWith({
            where: { deletedAt: null, organizationId: ORG_A },
            select: { id: true },
        });
        expect(ctx.prisma.userFacility.findMany).not.toHaveBeenCalled();
        expect(cycleService.listActive).toHaveBeenCalledWith(ORG_A, expect.anything(), ['f-all-1', 'f-all-2'], 'ADMIN');
    });
});

// Task 25 follow-up: pickup/deliver are gated by orgAssignedDriverProcedure
// (requireAssignedDriver + hasOrg), which now checks ctx.orgRole instead of
// the global ctx.user.role. Cases below construct ctx where the two
// disagree to prove the fix actually changed request outcomes, not just
// re-confirm the happy path.
describe('cycle.pickup / cycle.deliver — driver-assignment gate keys off ctx.orgRole, not ctx.user.role', () => {
    const CYCLE_ID = 'cjld2cjxh0000qzrmn831i7rn';
    const DESTINATION_ID = 'cjld2cjxh0001qzrmn831i7rn';

    it('allows pickup when ctx.orgRole is DRIVER even though ctx.user.role is OPS_MANAGER', async () => {
        const ctx = makeCtx('OPS_MANAGER', 'DRIVER');
        const caller = cycleRouter.createCaller(ctx);

        await caller.pickup({ cycleId: CYCLE_ID, vehicleId: 'v1' });

        expect(cycleService.pickup).toHaveBeenCalledWith(ORG_A, expect.anything(), 'user-1', 'DRIVER');
    });

    it('denies pickup with FORBIDDEN when ctx.orgRole is WORKER even though ctx.user.role is DRIVER', async () => {
        const ctx = makeCtx('DRIVER', 'WORKER');
        const caller = cycleRouter.createCaller(ctx);

        await expect(caller.pickup({ cycleId: CYCLE_ID, vehicleId: 'v1' })).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
        expect(cycleService.pickup).not.toHaveBeenCalled();
    });

    it('allows deliver when ctx.orgRole is ADMIN even though ctx.user.role is WORKER', async () => {
        const ctx = makeCtx('WORKER', 'ADMIN');
        const caller = cycleRouter.createCaller(ctx);

        await caller.deliver({ cycleId: CYCLE_ID, destinationId: DESTINATION_ID });

        expect(cycleService.deliver).toHaveBeenCalledWith(ORG_A, expect.anything(), 'user-1', 'ADMIN');
    });

    it('denies deliver with FORBIDDEN when ctx.orgRole is null even though ctx.user.role is ADMIN', async () => {
        const ctx = makeCtx('ADMIN', null);
        const caller = cycleRouter.createCaller(ctx);

        await expect(caller.deliver({ cycleId: CYCLE_ID, destinationId: DESTINATION_ID })).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
        expect(cycleService.deliver).not.toHaveBeenCalled();
    });
});
