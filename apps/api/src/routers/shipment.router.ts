import { router, protectedProcedure, stationProcedure } from '../trpc/trpc.js';
import {
    shipmentRegisterSchema,
    shipmentGetByIdSchema,
    shipmentListSchema,
} from '@bin-tracker/validators';
import { shipmentService } from '../services/shipment.service.js';

export const shipmentRouter = router({
    /** Record a new inbound supplier shipment on arrival */
    register: stationProcedure
        .input(shipmentRegisterSchema)
        .mutation(async ({ input }) => {
            return shipmentService.register(input);
        }),

    /** List shipments (optionally filtered by condition) */
    list: protectedProcedure
        .input(shipmentListSchema)
        .query(async ({ input }) => {
            return shipmentService.list(input);
        }),

    /** Fetch a single shipment by id */
    getById: protectedProcedure
        .input(shipmentGetByIdSchema)
        .query(async ({ input }) => {
            return shipmentService.getById(input.id);
        }),

    /** Public id/name list of facilities for the arrival form dropdown */
    facilityOptions: protectedProcedure.query(async () => {
        return shipmentService.facilityOptions();
    }),
});
