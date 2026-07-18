import { router, orgProcedure, requireModule } from '../trpc/trpc.js';
import {
    shipmentRegisterSchema,
    shipmentGetByIdSchema,
    shipmentListSchema,
} from '@bin-tracker/validators';
import { shipmentService } from '../services/shipment.service.js';

export const shipmentRouter = router({
    /** Record a new inbound supplier shipment on arrival */
    register: orgProcedure
        .use(requireModule('SHIPMENTS'))
        .input(shipmentRegisterSchema)
        .mutation(async ({ input, ctx }) => {
            return shipmentService.register(input, ctx.orgId);
        }),

    /** List shipments (optionally filtered by condition) */
    list: orgProcedure
        .use(requireModule('SHIPMENTS'))
        .input(shipmentListSchema)
        .query(async ({ input, ctx }) => {
            return shipmentService.list(ctx.orgId, input);
        }),

    /** Fetch a single shipment by id */
    getById: orgProcedure
        .use(requireModule('SHIPMENTS'))
        .input(shipmentGetByIdSchema)
        .query(async ({ input, ctx }) => {
            return shipmentService.getById(ctx.orgId, input.id);
        }),

    /** Id/name list of facilities for the arrival form dropdown */
    facilityOptions: orgProcedure
        .use(requireModule('SHIPMENTS'))
        .query(async ({ ctx }) => {
            return shipmentService.facilityOptions(ctx.orgId);
        }),
});
