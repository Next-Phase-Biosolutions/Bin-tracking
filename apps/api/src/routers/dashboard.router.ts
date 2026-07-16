import { router, orgProcedure } from '../trpc/trpc.js';
import { paginationSchema } from '@bin-tracker/validators';
import { dashboardService } from '../services/dashboard.service.js';
import { getUserFacilityIds } from '../trpc/middleware.js';

export const dashboardRouter = router({
    /** Aggregate dashboard stats */
    stats: orgProcedure.query(async ({ ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.orgRole!, ctx.orgId);
        return dashboardService.getStats(ctx.orgId, facilityIds, ctx.orgRole!);
    }),

    /** Priority queue — most urgent cycles first */
    priorityQueue: orgProcedure.input(paginationSchema).query(async ({ input, ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.orgRole!, ctx.orgId);
        return dashboardService.getPriorityQueue(ctx.orgId, input, facilityIds, ctx.orgRole!);
    }),

    /** Overdue cycles */
    overdue: orgProcedure.input(paginationSchema).query(async ({ input, ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.orgRole!, ctx.orgId);
        return dashboardService.getOverdue(ctx.orgId, input, facilityIds, ctx.orgRole!);
    }),
});
