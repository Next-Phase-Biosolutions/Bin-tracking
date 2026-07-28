import { z } from 'zod';
import { paginationSchema } from './common.schema.js';

// ─── Create Facility ──────────────────────────────────────────

export const createFacilitySchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    type: z.enum(['PROCESSING', 'RENDERING']),
    address: z.string().min(1, 'Address is required').max(500),
    city: z.string().min(1, 'City is required').max(200),
    province: z.string().min(1, 'Province is required').max(200),
    postalCode: z.string().min(1, 'Postal code is required').max(20),
    country: z.string().min(1, 'Country is required').max(200),
});

export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;

// ─── Update Facility ──────────────────────────────────────────

export const updateFacilitySchema = z.object({
    id: z.string().cuid(),
    name: z.string().min(1).max(200).optional(),
    address: z.string().min(1).max(500).optional(),
    city: z.string().min(1).max(200).optional(),
    province: z.string().min(1).max(200).optional(),
    postalCode: z.string().min(1).max(20).optional(),
    country: z.string().min(1).max(200).optional(),
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

