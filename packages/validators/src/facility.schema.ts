import { z } from 'zod';
import { paginationSchema } from './common.schema.js';

// ─── Create Facility ──────────────────────────────────────────

export const createFacilitySchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    type: z.enum(['PROCESSING', 'RENDERING']),
    address: z.string().min(1, 'Address is required').max(500),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
});

export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;

// ─── Update Facility ──────────────────────────────────────────

export const updateFacilitySchema = z.object({
    id: z.string().cuid(),
    name: z.string().min(1).max(200).optional(),
    address: z.string().min(1).max(500).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
});

export type UpdateFacilityInput = z.infer<typeof updateFacilitySchema>;

// ─── List Facilities ──────────────────────────────────────────

export const listFacilitiesSchema = z.object({
    type: z.enum(['PROCESSING', 'RENDERING']).optional(),
}).merge(paginationSchema);

export type ListFacilitiesInput = z.infer<typeof listFacilitiesSchema>;

// ─── Get Facility ─────────────────────────────────────────────

export const getFacilitySchema = z.object({
    id: z.string().cuid(),
});
