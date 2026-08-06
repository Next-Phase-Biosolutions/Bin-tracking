import { TRPCError } from '@trpc/server';
import { router, orgProcedure, requireModule } from '../trpc/trpc.js';
import { listDevicesSchema, sensorReadingRangeSchema } from '@bin-tracker/validators';
import { sensorService } from '../services/sensor.service.js';
import { getUserFacilityIds } from '../trpc/middleware.js';

export const sensorRouter = router({
    listDevices: orgProcedure
        .use(requireModule('ENVIRONMENT_MONITORING'))
        .input(listDevicesSchema)
        .query(async ({ ctx, input }) => {
            if (!ctx.user || !ctx.orgRole) {
                throw new TRPCError({ code: 'UNAUTHORIZED' });
            }
            const allFacilityIds = await getUserFacilityIds(ctx.user.id, ctx.prisma, ctx.orgRole, ctx.orgId);

            // Intersect, never replace — a client-supplied facilityId must narrow
            // the caller's own access, not substitute for it.
            const facilityIds = input.facilityId
                ? allFacilityIds.filter((id) => id === input.facilityId)
                : allFacilityIds;

            return sensorService.listDevicesForOrg(ctx.orgId, facilityIds);
        }),
    getReadings: orgProcedure
        .use(requireModule('ENVIRONMENT_MONITORING'))
        .input(sensorReadingRangeSchema)
        .query(({ ctx, input }) => {
            if (!ctx.user || !ctx.orgRole) {
                throw new TRPCError({ code: 'UNAUTHORIZED' });
            }
            return sensorService.getDeviceHistory(ctx.orgId, input.deviceId, input.range, ctx.user.id, ctx.orgRole);
        }),
});
