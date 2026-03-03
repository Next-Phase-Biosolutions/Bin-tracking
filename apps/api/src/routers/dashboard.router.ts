import { router, protectedProcedure } from '../trpc/trpc.js';
import { paginationSchema } from '@bin-tracker/validators';
import { dashboardService } from '../services/dashboard.service.js';
import { getUserFacilityIds } from '../trpc/middleware.js';

export const dashboardRouter = router({
    /** Aggregate dashboard stats */
    stats: protectedProcedure.query(async ({ ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.user!.role);
        return dashboardService.getStats(facilityIds, ctx.user!.role);
    }),

    /** Priority queue — most urgent cycles first */
    priorityQueue: protectedProcedure.input(paginationSchema).query(async ({ input, ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.user!.role);
        return dashboardService.getPriorityQueue(input, facilityIds, ctx.user!.role);
    }),

    /** Overdue cycles */
    overdue: protectedProcedure.input(paginationSchema).query(async ({ input, ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.user!.role);
        return dashboardService.getOverdue(input, facilityIds, ctx.user!.role);
    }),
});
