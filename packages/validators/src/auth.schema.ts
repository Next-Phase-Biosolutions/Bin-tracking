import { z } from 'zod';

// ─── Login (Ops Dashboard / Admin) ────────────────────────────

export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Station Auth (Tablet) ────────────────────────────────────

export const stationAuthSchema = z.object({
    token: z
        .string()
        .min(1, 'Token is required')
        .max(128, 'Token too long'),
});

export type StationAuthInput = z.infer<typeof stationAuthSchema>;
