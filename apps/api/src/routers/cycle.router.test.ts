import { describe, it, expect, vi } from 'vitest';

// Task 25 regression: cycle.listActive's facility-scoping ADMIN branch
// (via getUserFacilityIds, trpc/middleware.ts) must key off ctx.orgRole,
// never the global ctx.user.role. getUserFacilityIds is the real
// implementation, driven against a fake ctx.prisma.

vi.mock('../services/cycle.service.js', () => ({
    cycleService: {
        listActive: vi.fn().mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 }),
    },
}));

const { cycleRouter } = await import('./cycle.router.js');
const { cycleService } = await import('../services/cycle.service.js');

const ORG_A = 'org-a';

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
