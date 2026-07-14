import { router, stationOrgProcedure, orgProcedure } from '../trpc/trpc.js';
import { binStartSchema, binStartDynamicSchema, binGetByIdSchema, binGetByQrCodeSchema, binGetActiveDynamicSchema, binListSchema } from '@bin-tracker/validators';
import { binService } from '../services/bin.service.js';
import { getUserFacilityIds } from '../trpc/middleware.js';

export const binRouter = router({
    /** Start a pre-associated bin cycle (Option A) */
    start: stationOrgProcedure.input(binStartSchema).mutation(async ({ input, ctx }) => {
        return binService.start(ctx.orgId, input, ctx.station!.id);
    }),

    /** Start a dynamic bin cycle from a Master QR (Option B MVP) */
    startDynamic: stationOrgProcedure.input(binStartDynamicSchema).mutation(async ({ input, ctx }) => {
        return binService.startDynamic(ctx.orgId, input, ctx.station!.id);
    }),

    /** Get bin details by ID */
    getById: orgProcedure.input(binGetByIdSchema).query(async ({ input, ctx }) => {
        return binService.getById(ctx.orgId, input.id, ctx.user!.id, ctx.user!.role);
    }),

    /** Get bin details by QR code */
    getByQrCode: orgProcedure.input(binGetByQrCodeSchema).query(async ({ input, ctx }) => {
        return binService.getByQrCode(ctx.orgId, input.qrCode, ctx.user!.id, ctx.user!.role);
    }),

    /** Get active dynamic bin cycles by QR or Master QR code */
    getActiveDynamicMatches: orgProcedure.input(binGetActiveDynamicSchema).query(async ({ input, ctx }) => {
        return binService.getActiveDynamicMatches(ctx.orgId, input.qrCode, ctx.user!.id, ctx.user!.role);
    }),

    /** List bins with filters and pagination */
    list: orgProcedure.input(binListSchema).query(async ({ input, ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.user!.role);
        return binService.list(ctx.orgId, input, facilityIds, ctx.user!.role);
    }),
});
