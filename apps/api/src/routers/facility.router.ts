import { router, protectedProcedure, adminProcedure } from '../trpc/trpc.js';
import {
    createFacilitySchema,
    updateFacilitySchema,
    getFacilitySchema,
    listFacilitiesSchema,
} from '@bin-tracker/validators';
import { facilityService } from '../services/facility.service.js';
import { getUserFacilityIds } from '../trpc/middleware.js';

export const facilityRouter = router({
    /** List facilities user has access to */
    list: protectedProcedure.input(listFacilitiesSchema).query(async ({ input, ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.user!.role);
        return facilityService.list(input, facilityIds, ctx.user!.role);
    }),

    /** Get facility by ID */
    getById: protectedProcedure.input(getFacilitySchema).query(async ({ input, ctx }) => {
        return facilityService.getById(input.id, ctx.user!.id, ctx.user!.role);
    }),

    /** Create facility (ADMIN only) */
    create: adminProcedure.input(createFacilitySchema).mutation(async ({ input }) => {
        return facilityService.create(input);
    }),

    /** Update facility */
    update: protectedProcedure.input(updateFacilitySchema).mutation(async ({ input, ctx }) => {
        return facilityService.update(input, ctx.user!.id, ctx.user!.role);
    }),

    /** Soft delete facility */
    remove: protectedProcedure.input(getFacilitySchema).mutation(async ({ input, ctx }) => {
        return facilityService.remove(input.id, ctx.user!.id, ctx.user!.role);
    }),
});
