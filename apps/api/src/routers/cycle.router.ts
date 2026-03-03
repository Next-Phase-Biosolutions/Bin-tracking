import { router, assignedDriverProcedure, protectedProcedure } from '../trpc/trpc.js';
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
    pickup: assignedDriverProcedure.input(cyclePickupSchema).mutation(async ({ input, ctx }) => {
        return cycleService.pickup(input, ctx.user!.id, ctx.user!.role);
    }),

    /** Deliver bin (Scan 3 — Driver) */
    deliver: assignedDriverProcedure.input(cycleDeliverSchema).mutation(async ({ input, ctx }) => {
        return cycleService.deliver(input, ctx.user!.id, ctx.user!.role);
    }),

    /** Get cycle by ID */
    getById: protectedProcedure.input(cycleGetByIdSchema).query(async ({ input, ctx }) => {
        return cycleService.getById(input.id, ctx.user!.id, ctx.user!.role);
    }),

    /** List active cycles */
    listActive: protectedProcedure.input(cycleListSchema).query(async ({ input, ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.user!.role);
        return cycleService.listActive(input, facilityIds, ctx.user!.role);
    }),

    /** Cycle history for a bin */
    history: protectedProcedure.input(cycleHistorySchema).query(async ({ input, ctx }) => {
        return cycleService.getHistory(input, ctx.user!.id, ctx.user!.role);
    }),
});
