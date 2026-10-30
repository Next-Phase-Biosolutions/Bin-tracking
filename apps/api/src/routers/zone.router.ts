import { TRPCError } from '@trpc/server';
import {
    createZoneSchema,
    facilityRefSchema,
    renameZoneSchema,
    reorderZonesSchema,
    zoneRefSchema,
} from '@bin-tracker/validators';
import { router, orgProcedure, platformAdminProcedure } from '../trpc/trpc.js';
import { getUserFacilityIds } from '../trpc/middleware.js';
import { zoneService } from '../services/zone.service.js';

export const zoneRouter = router({
    /** Zones of the facilities the caller can access — drives the sidebar and zone pages. Never takes a client-supplied facility id. */
    listMine: orgProcedure.query(async ({ ctx }) => {
        if (!ctx.user || !ctx.orgRole) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const facilityIds = await getUserFacilityIds(ctx.user.id, ctx.prisma, ctx.orgRole, ctx.orgId);
        return zoneService.listForFacilities(facilityIds);
    }),

    adminList: platformAdminProcedure
        .input(facilityRefSchema)
        .query(({ input }) => zoneService.listForFacility(input.facilityId)),

    adminCreate: platformAdminProcedure.input(createZoneSchema).mutation(({ input }) => zoneService.create(input)),

    adminRename: platformAdminProcedure
        .input(renameZoneSchema)
        .mutation(({ input }) => zoneService.rename(input.zoneId, input.name)),

    adminReorder: platformAdminProcedure
        .input(reorderZonesSchema)
        .mutation(({ input }) => zoneService.reorder(input.facilityId, input.zoneIds)),

    adminRemove: platformAdminProcedure.input(zoneRefSchema).mutation(({ input }) => zoneService.remove(input.zoneId)),
});
