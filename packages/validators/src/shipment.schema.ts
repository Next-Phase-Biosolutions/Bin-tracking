import { z } from 'zod';

// ─── Supplier Shipment Validators ─────────────────────────────

export const shipmentConditionEnum = z.enum(['GOOD', 'DAMAGED']);

export const shipmentRegisterSchema = z.object({
    supplier: z.string().min(1, 'Supplier is required').max(120),
    reference: z.string().max(120).optional(),
    contents: z.string().max(2000).optional(),
    quantity: z.number().int().min(0).max(1_000_000).optional(),
    weightKg: z.number().min(0).max(1_000_000).optional(),
    condition: shipmentConditionEnum.default('GOOD'),
    conditionNote: z.string().max(2000).optional(),
    receivedBy: z.string().max(120).optional(),
    /** Expected arrival date (ISO string) — optional reference value */
    expectedAt: z.string().datetime().optional(),
    /** Actual received date/time (ISO string); defaults to now on the server */
    receivedAt: z.string().datetime().optional(),
    /** Optional destination facility id (links to an existing Facility) */
    facilityId: z.string().min(1).optional(),
});

export type ShipmentRegisterInput = z.infer<typeof shipmentRegisterSchema>;

export const shipmentGetByIdSchema = z.object({
    id: z.string().min(1),
});

export type ShipmentGetByIdInput = z.infer<typeof shipmentGetByIdSchema>;

export const shipmentListSchema = z.object({
    condition: shipmentConditionEnum.optional(),
    limit: z.number().int().min(1).max(200).default(100),
});

export type ShipmentListInput = z.infer<typeof shipmentListSchema>;
