import { router, stationProcedure, protectedProcedure } from '../trpc/trpc.js';
import { binStartSchema, binStartDynamicSchema, binGetByIdSchema, binGetByQrCodeSchema, binGetActiveDynamicSchema, binListSchema } from '@bin-tracker/validators';
import { binService } from '../services/bin.service.js';
import { getUserFacilityIds } from '../trpc/middleware.js';

export const binRouter = router({
    /** Start a pre-associated bin cycle (Option A) */
    start: stationProcedure.input(binStartSchema).mutation(async ({ input, ctx }) => {
        return binService.start(input, ctx.station!.id);
    }),

    /** Start a dynamic bin cycle from a Master QR (Option B MVP) */
    startDynamic: stationProcedure.input(binStartDynamicSchema).mutation(async ({ input, ctx }) => {
        return binService.startDynamic(input, ctx.station!.id);
    }),

    /** Get bin details by ID */
    getById: protectedProcedure.input(binGetByIdSchema).query(async ({ input, ctx }) => {
        return binService.getById(input.id, ctx.user!.id, ctx.user!.role);
    }),

    /** Get bin details by QR code */
    getByQrCode: protectedProcedure.input(binGetByQrCodeSchema).query(async ({ input, ctx }) => {
        return binService.getByQrCode(input.qrCode, ctx.user!.id, ctx.user!.role);
    }),

    /** Get active dynamic bin cycles by QR or Master QR code */
    getActiveDynamicMatches: protectedProcedure.input(binGetActiveDynamicSchema).query(async ({ input, ctx }) => {
        return binService.getActiveDynamicMatches(input.qrCode, ctx.user!.id, ctx.user!.role);
    }),

    /** List bins with filters and pagination */
    list: protectedProcedure.input(binListSchema).query(async ({ input, ctx }) => {
        const facilityIds = await getUserFacilityIds(ctx.user!.id, ctx.prisma, ctx.user!.role);
        return binService.list(input, facilityIds, ctx.user!.role);
    }),
});
