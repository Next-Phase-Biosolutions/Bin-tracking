import { z } from 'zod';
import { paginationSchema } from './common.schema.js';

// ─── Cycle Pickup (Scan 2 — Driver) ──────────────────────────

export const cyclePickupSchema = z.object({
    cycleId: z.string().cuid(),
    vehicleId: z.string().max(50).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
});

export type CyclePickupInput = z.infer<typeof cyclePickupSchema>;

// ─── Cycle Deliver (Scan 3 — Driver) ─────────────────────────

export const cycleDeliverSchema = z.object({
    cycleId: z.string().cuid(),
    destinationId: z.string().cuid(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
});

export type CycleDeliverInput = z.infer<typeof cycleDeliverSchema>;

// ─── Cycle Queries ────────────────────────────────────────────

export const cycleGetByIdSchema = z.object({
    id: z.string().cuid(),
});

export const cycleListSchema = z.object({
    status: z.enum(['ACTIVE', 'IN_TRANSIT', 'COMPLETED']).optional(),
    facilityId: z.string().cuid().optional(),
    binId: z.string().cuid().optional(),
    complianceResult: z.enum(['ON_TIME', 'LATE']).optional(),
}).merge(paginationSchema);

export type CycleListInput = z.infer<typeof cycleListSchema>;

export const cycleHistorySchema = z.object({
    binId: z.string().cuid(),
}).merge(paginationSchema);

export type CycleHistoryInput = z.infer<typeof cycleHistorySchema>;
