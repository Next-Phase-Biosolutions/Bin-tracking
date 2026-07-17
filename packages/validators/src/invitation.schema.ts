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

// ─── Revoke Invitation (org admin, settings page) ─────────────

export const revokeInvitationSchema = z.object({
    invitationId: z.string().min(1, 'Invitation id is required'),
});

export type RevokeInvitationInput = z.infer<typeof revokeInvitationSchema>;

// ─── Member management (org admin, settings page) ─────────────

export const updateMemberRoleSchema = z.object({
    userId: z.string().min(1, 'User id is required'),
    role: z.enum(['ADMIN', 'OPS_MANAGER', 'DRIVER', 'WORKER']),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const removeMemberSchema = z.object({
    userId: z.string().min(1, 'User id is required'),
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
