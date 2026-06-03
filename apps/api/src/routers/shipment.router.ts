import { router, publicProcedure } from '../trpc/trpc.js';
import {
    shipmentRegisterSchema,
    shipmentGetByIdSchema,
    shipmentListSchema,
} from '@bin-tracker/validators';
import { shipmentService } from '../services/shipment.service.js';

export const shipmentRouter = router({
    /** Record a new inbound supplier shipment on arrival */
    register: publicProcedure
        .input(shipmentRegisterSchema)
        .mutation(async ({ input }) => {
            return shipmentService.register(input);
        }),

    /** List shipments (optionally filtered by condition) */
    list: publicProcedure
        .input(shipmentListSchema)
        .query(async ({ input }) => {
            return shipmentService.list(input);
        }),

    /** Fetch a single shipment by id */
    getById: publicProcedure
        .input(shipmentGetByIdSchema)
        .query(async ({ input }) => {
            return shipmentService.getById(input.id);
        }),

    /** Public id/name list of facilities for the arrival form dropdown */
    facilityOptions: publicProcedure.query(async () => {
        return shipmentService.facilityOptions();
    }),
});
