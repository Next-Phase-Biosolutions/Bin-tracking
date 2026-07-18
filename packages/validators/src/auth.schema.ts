import { z } from 'zod';

// ─── Login (Ops Dashboard / Admin) ────────────────────────────

export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Create Organization (self-serve signup wizard) ───────────

export const createOrganizationSchema = z.object({
    name: z.string().min(1, 'Organization name is required').max(200),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

// ─── Update Profile (settings page) ───────────────────────────

export const updateProfileSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
