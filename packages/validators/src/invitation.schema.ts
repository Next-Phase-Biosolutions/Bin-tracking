import { z } from 'zod';

// ─── Create Invitation (org admin invites a teammate) ─────────

export const createInvitationSchema = z.object({
    email: z.string().email('Invalid email format'),
    role: z.enum(['ADMIN', 'OPS_MANAGER', 'DRIVER', 'WORKER']),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

// ─── Accept Invitation ─────────────────────────────────────────

export const acceptInvitationSchema = z.object({
    token: z.string().min(1, 'Token is required'),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
