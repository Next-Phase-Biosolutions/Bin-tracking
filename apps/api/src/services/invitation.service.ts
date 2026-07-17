import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import type { User, UserRole } from '@prisma/client';
import { sendInvitationEmail } from '../lib/email.js';
import { hashToken } from '../lib/token.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CreateInvitationResult {
    id: string;
    email: string;
    role: UserRole;
    expiresAt: Date;
}

/**
 * Creates a pending Invitation and emails the accept link. `orgId` always
 * comes from the caller's own org context (auth.router.ts passes ctx.orgId,
 * resolved by orgAdminProcedure) — never client input — so an admin can
 * only ever invite people into their own organization.
 *
 * The invitation row is committed before the email send is attempted; if
 * the send throws (e.g. RESEND_API_KEY unset), the error propagates to the
 * caller so they see it failed, but the invitation still exists and could
 * be resent by a future re-invite flow (not in scope here).
 */
export async function createInvitation(orgId: string, email: string, role: UserRole): Promise<CreateInvitationResult> {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });

    const normalizedEmail = email.toLowerCase();

    // Re-inviting the same address rotates the existing pending invitation
    // (fresh token + expiry) instead of accumulating rows — one live token
    // per (org, email), and "resend" comes for free.
    const pending = await prisma.invitation.findFirst({
        where: { orgId, email: normalizedEmail, acceptedAt: null, expiresAt: { gt: new Date() } },
    });

    // Stored hashed at rest (lib/token.ts); only the emailed link ever
    // carries the raw token.
    const rawToken = randomUUID();
    const data = {
        role,
        token: hashToken(rawToken),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    };
    const invitation = pending
        ? await prisma.invitation.update({ where: { id: pending.id }, data })
        : await prisma.invitation.create({ data: { orgId, email: normalizedEmail, ...data } });

    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000';
    await sendInvitationEmail(invitation.email, `${appUrl}/app/invite/${rawToken}`, org.name);

    return { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt };
}

export interface AcceptInvitationResult {
    orgId: string;
    role: UserRole;
}

/**
 * Accepts an invitation. The token is the SOLE credential — invitation is
 * looked up by token alone, never combined with or overridden by any other
 * caller-supplied id, so only someone who possesses the token (i.e. received
 * the email) can accept it. The resulting OrganizationMember.orgId is always
 * the invitation's own orgId, read from the row the token resolved to —
 * never client input — so a valid token for org A can never create
 * membership in org B.
 *
 * The local User row's email is seeded from jwtPayload.email (the identity
 * Supabase already authenticated the caller as), not invitation.email —
 * Supabase, not this handler, is the source of truth for "who owns this
 * email"; this handler only decides org membership + role from the token.
 * `role` comes from the invitation (not hardcoded ADMIN like bootstrap),
 * since accepting an invite should never silently grant admin.
 *
 * `jwtPayload` is null only under the DISABLE_AUTH dev bypass (verifiedProcedure
 * skips its own check in that mode, same as bootstrap) — fall back to the
 * dev-injected `fallbackUser` instead of crashing.
 */
export async function acceptInvitation(
    token: string,
    jwtPayload: { sub: string; email?: string } | null,
    fallbackUser: User | null,
): Promise<AcceptInvitationResult> {
    let sub: string;
    let email: string;

    if (jwtPayload) {
        if (!jwtPayload.email) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'JWT is missing an email claim' });
        }
        sub = jwtPayload.sub;
        email = jwtPayload.email;
    } else if (fallbackUser) {
        sub = fallbackUser.id;
        email = fallbackUser.email;
    } else {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    // The URL carries the raw token; the DB stores its hash (lib/token.ts).
    const invitation = await prisma.invitation.findUnique({ where: { token: hashToken(token) } });
    if (!invitation) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid invitation token' });
    }
    if (invitation.acceptedAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation has already been accepted' });
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation has expired' });
    }
    // The token proves receipt of the email; requiring the authenticated
    // account to OWN the invited address closes the forwarded/leaked-link
    // hole where any Supabase account holding the URL could join at the
    // invited role. Skipped on the DISABLE_AUTH dev-bypass path (jwtPayload
    // null), where the injected seed user's email never matches.
    if (jwtPayload && email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'This invitation was issued to a different email address. Sign in with the invited account.',
        });
    }

    await prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
            where: { id: sub },
            update: {},
            create: {
                id: sub,
                email,
                name: email.split('@')[0] ?? email,
                role: invitation.role,
            },
        });

        // Task 25: role must come from THIS invitation on both branches — a
        // re-invite of an existing member has to actually change their access,
        // not leave whatever role they happened to have before (that silent
        // drop was the privilege-escalation hole: an existing account's global
        // ADMIN role would otherwise keep winning over an org's explicit
        // low-privilege invite).
        await tx.organizationMember.upsert({
            where: { orgId_userId: { orgId: invitation.orgId, userId: user.id } },
            update: { role: invitation.role },
            create: { orgId: invitation.orgId, userId: user.id, role: invitation.role },
        });

        // Re-check acceptedAt inside the transaction to close the race where two
        // concurrent accept calls both pass the pre-transaction check above —
        // only the first writer's update sticks; the loser sees a mismatched
        // count and is treated as a double-accept.
        const result = await tx.invitation.updateMany({
            where: { id: invitation.id, acceptedAt: null },
            data: { acceptedAt: new Date() },
        });
        if (result.count === 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation has already been accepted' });
        }
    });

    return { orgId: invitation.orgId, role: invitation.role };
}

export interface PendingInvitationListItem {
    id: string;
    email: string;
    role: UserRole;
    createdAt: Date;
    expiresAt: Date;
}

/**
 * Unaccepted invitations for the org (newest first), including expired ones —
 * the settings page marks those "Expired" so an admin can see who never
 * joined and re-invite (createInvitation rotates the pending row).
 */
export async function listInvitations(orgId: string): Promise<PendingInvitationListItem[]> {
    return prisma.invitation.findMany({
        where: { orgId, acceptedAt: null },
        select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Revokes (deletes) an unaccepted invitation; the emailed link stops working.
 * deleteMany scoped by orgId so an admin can only ever revoke invitations in
 * their own org — a foreign id resolves to count 0, indistinguishable from
 * a nonexistent one.
 */
export async function revokeInvitation(orgId: string, invitationId: string): Promise<{ id: string }> {
    const result = await prisma.invitation.deleteMany({
        where: { id: invitationId, orgId, acceptedAt: null },
    });
    if (result.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found or already accepted' });
    }
    return { id: invitationId };
}

export const invitationService = {
    createInvitation,
    acceptInvitation,
    listInvitations,
    revokeInvitation,
};
