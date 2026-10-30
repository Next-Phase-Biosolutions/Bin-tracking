import {
    addSensorDevicesSchema,
    adminReadingRangeSchema,
    assignSensorDeviceSchema,
    fleetListSchema,
    reassignSensorDeviceSchema,
    sensorDeviceRefSchema,
    setOfflineThresholdSchema,
    viewAsTenantReadingsSchema,
    viewAsTenantSchema,
} from '@bin-tracker/validators';
import { router, platformAdminProcedure } from '../trpc/trpc.js';
import { sensorFleetService } from '../services/sensor-fleet.service.js';
import { sensorFleetReadService } from '../services/sensor-fleet-read.service.js';
import { unknownDeviceLog } from '../services/unknown-device-log.service.js';
import { platformSettings } from '../services/platform-settings.service.js';

/**
 * Platform-admin sensor fleet management. Every procedure here is a
 * platformAdminProcedure: these endpoints return hardware ids, signal values,
 * fault detail and raw payloads across ALL tenants, which tenants must never
 * see. The tenant-facing equivalents live in sensor.router.ts.
 * (`ctx.user` is non-null: platformAdminProcedure rejects anyone without it.)
 */
export const sensorAdminRouter = router({
    // ─── Registration & lifecycle (each audited in the service) ──
    addDevices: platformAdminProcedure
        .input(addSensorDevicesSchema)
        .mutation(({ ctx, input }) => sensorFleetService.addDevices(input.externalIds, ctx.user!.id)),

    assignDevice: platformAdminProcedure
        .input(assignSensorDeviceSchema)
        .mutation(({ ctx, input }) => sensorFleetService.assignDevice(input, ctx.user!.id)),

    reassignDevice: platformAdminProcedure
        .input(reassignSensorDeviceSchema)
        .mutation(({ ctx, input }) => sensorFleetService.reassignDevice(input, ctx.user!.id)),

    deactivateDevice: platformAdminProcedure
        .input(sensorDeviceRefSchema)
        .mutation(({ ctx, input }) => sensorFleetService.deactivateDevice(input.deviceId, ctx.user!.id)),

    reactivateDevice: platformAdminProcedure
        .input(sensorDeviceRefSchema)
        .mutation(({ ctx, input }) => sensorFleetService.reactivateDevice(input.deviceId, ctx.user!.id)),

    // ─── Fleet monitoring (cross-tenant, full rows) ──────────────
    listFleetDevices: platformAdminProcedure
        .input(fleetListSchema)
        .query(({ input }) => sensorFleetReadService.listFleetDevices(input)),

    fleetSummary: platformAdminProcedure.query(() => sensorFleetReadService.fleetSummary()),

    deviceDetail: platformAdminProcedure
        .input(sensorDeviceRefSchema)
        .query(({ input }) => sensorFleetReadService.deviceDetail(input.deviceId)),

    deviceReadings: platformAdminProcedure
        .input(adminReadingRangeSchema)
        .query(({ input }) => sensorFleetReadService.deviceReadings(input.deviceId, input.range)),

    listUnknownIds: platformAdminProcedure.query(() => unknownDeviceLog.list()),

    // ─── Assign form & view-as-tenant ────────────────────────────
    orgAssignmentOptions: platformAdminProcedure
        .input(viewAsTenantSchema)
        .query(({ input }) => sensorFleetReadService.listOrgAssignmentOptions(input.organizationId)),

    viewAsTenant: platformAdminProcedure
        .input(viewAsTenantSchema)
        .query(({ input }) => sensorFleetReadService.viewAsTenant(input.organizationId)),

    viewAsTenantReadings: platformAdminProcedure
        .input(viewAsTenantReadingsSchema)
        .query(({ ctx, input }) =>
            sensorFleetReadService.viewAsTenantReadings(input.organizationId, input.deviceId, input.range, ctx.user!.id),
        ),

    // ─── Platform setting ────────────────────────────────────────
    getOfflineThreshold: platformAdminProcedure.query(async () => ({
        minutes: await platformSettings.getOfflineAfterMinutes(),
    })),

    setOfflineThreshold: platformAdminProcedure
        .input(setOfflineThresholdSchema)
        .mutation(({ ctx, input }) => platformSettings.setOfflineAfterMinutes(input.minutes, ctx.user!.id)),
});
