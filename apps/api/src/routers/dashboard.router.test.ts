import { describe, it, expect, vi } from 'vitest';

// Task 25 regression: dashboard.stats' facility-scoping ADMIN branch (via
// getUserFacilityIds, trpc/middleware.ts) must key off ctx.orgRole, never
// the global ctx.user.role. getUserFacilityIds is the real implementation,
// driven against a fake ctx.prisma.

vi.mock('../services/dashboard.service.js', () => ({
    dashboardService: {
        getStats: vi.fn().mockResolvedValue({}),
    },
}));

const { dashboardRouter } = await import('./dashboard.router.js');
const { dashboardService } = await import('../services/dashboard.service.js');

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

describe('dashboard.stats — facility scoping keys off ctx.orgRole, not ctx.user.role', () => {
    it('global ADMIN with org role DRIVER gets only assigned facilities, not every facility in the org', async () => {
        const ctx = makeCtx('ADMIN', 'DRIVER');
        const caller = dashboardRouter.createCaller(ctx);

        await caller.stats();

        expect(ctx.prisma.userFacility.findMany).toHaveBeenCalledWith({
            where: { userId: 'user-1', facility: { organizationId: ORG_A } },
            select: { facilityId: true },
        });
        expect(ctx.prisma.facility.findMany).not.toHaveBeenCalled();
        expect(dashboardService.getStats).toHaveBeenCalledWith(ORG_A, ['f-assigned-1'], 'DRIVER');
    });

    it('global DRIVER with org role ADMIN gets every facility in the org, not just assigned ones', async () => {
        const ctx = makeCtx('DRIVER', 'ADMIN');
        const caller = dashboardRouter.createCaller(ctx);

        await caller.stats();

        expect(ctx.prisma.facility.findMany).toHaveBeenCalledWith({
            where: { deletedAt: null, organizationId: ORG_A },
            select: { id: true },
        });
        expect(ctx.prisma.userFacility.findMany).not.toHaveBeenCalled();
        expect(dashboardService.getStats).toHaveBeenCalledWith(ORG_A, ['f-all-1', 'f-all-2'], 'ADMIN');
    });
});
