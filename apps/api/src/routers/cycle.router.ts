import { router, orgAssignedDriverProcedure, orgProcedure } from '../trpc/trpc.js';
import {
    cyclePickupSchema,
    cycleDeliverSchema,
    cycleGetByIdSchema,
    cycleListSchema,
    cycleHistorySchema,
} from '@bin-tracker/validators';
import { cycleService } from '../services/cycle.service.js';
import { getUserFacilityIds } from '../trpc/middleware.js';

export const cycleRouter = router({
    /** Pickup bin (Scan 2 — Driver) */
    pickup: orgAssignedDriverProcedure.input(cyclePickupSchema).mutation(async ({ input, ctx }) => {
        return cycleService.pickup(ctx.orgId, input, ctx.user!.id, ctx.orgRole!);
    }),

    /** Deliver bin (Scan 3 — Driver) */
    deliver: orgAssignedDriverProcedure.input(cycleDeliverSchema).mutation(async ({ input, ctx }) => {
        return cycleService.deliver(ctx.orgId, input, ctx.user!.id, ctx.orgRole!);
    }),

    /** Get cycle by ID */
    getById: orgProcedure.input(cycleGetByIdSchema).query(async ({ input, ctx }) => {
        return cycleService.getById(ctx.orgId, input.id, ctx.user!.id, ctx.orgRole!);
    }),

    /** List active cycles */
    listActive: orgProcedure.input(cycleListSchema).query(async ({ input, ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.orgRole!, ctx.orgId);
        return cycleService.listActive(ctx.orgId, input, facilityIds, ctx.orgRole!);
    }),

    /** Cycle history for a bin */
    history: orgProcedure.input(cycleHistorySchema).query(async ({ input, ctx }) => {
        return cycleService.getHistory(ctx.orgId, input, ctx.user!.id, ctx.orgRole!);
    }),
});
