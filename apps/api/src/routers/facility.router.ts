import { router, orgProcedure, orgAdminProcedure } from '../trpc/trpc.js';
import {
    createFacilitySchema,
    updateFacilitySchema,
    getFacilitySchema,
    listFacilitiesSchema,
    createStationSchema,
} from '@bin-tracker/validators';
import { facilityService } from '../services/facility.service.js';
import { getUserFacilityIds } from '../trpc/middleware.js';

export const facilityRouter = router({
    /** List facilities user has access to */
    list: orgProcedure.input(listFacilitiesSchema).query(async ({ input, ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.orgRole!, ctx.orgId);
        return facilityService.list(ctx.orgId, input, facilityIds, ctx.orgRole!);
    }),

    /** Get facility by ID */
    getById: orgProcedure.input(getFacilitySchema).query(async ({ input, ctx }) => {
        return facilityService.getById(ctx.orgId, input.id, ctx.user!.id, ctx.orgRole!);
    }),

    /** Create facility (ADMIN only) */
    create: orgAdminProcedure.input(createFacilitySchema).mutation(async ({ input, ctx }) => {
        return facilityService.create(ctx.orgId, input);
    }),

    /** Provision a station (tablet) token for a facility (ADMIN only) */
    createStation: orgAdminProcedure.input(createStationSchema).mutation(async ({ input, ctx }) => {
        return facilityService.createStation(ctx.orgId, input);
    }),

    /** Update facility */
    update: orgProcedure.input(updateFacilitySchema).mutation(async ({ input, ctx }) => {
        return facilityService.update(ctx.orgId, input, ctx.user!.id, ctx.orgRole!);
    }),

    /** Soft delete facility */
    remove: orgProcedure.input(getFacilitySchema).mutation(async ({ input, ctx }) => {
        return facilityService.remove(ctx.orgId, input.id, ctx.user!.id, ctx.orgRole!);
    }),
});
