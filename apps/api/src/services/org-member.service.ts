import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import type { UserRole } from '@prisma/client';

export interface OrgMemberListItem {
    userId: string;
    name: string;
    email: string;
    role: UserRole;
    joinedAt: Date;
}

/** All members of the org, oldest first (founder on top). */
export async function listMembers(orgId: string): Promise<OrgMemberListItem[]> {
    const members = await prisma.organizationMember.findMany({
        where: { orgId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joinedAt: m.createdAt,
    }));
}

/**
 * Shared rails for updateMemberRole/removeMember. Both act on the
 * (orgId, targetUserId) membership and both must refuse to leave the org
 * without an ADMIN:
 * - acting on yourself is always rejected (an admin who wants out is
 *   removed/demoted by another admin), which also makes lock-out via
 *   self-demotion impossible;
 * - the last ADMIN can never be demoted or removed — an org with no admin
 *   is permanently unmanageable (invites and role changes are all
 *   orgAdminProcedure).
 */
async function loadTargetWithRails(orgId: string, actorUserId: string, targetUserId: string, willRemainAdmin: boolean) {
    if (actorUserId === targetUserId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot change or remove your own membership. Ask another admin.' });
    }
    const target = await prisma.organizationMember.findUnique({
        where: { orgId_userId: { orgId, userId: targetUserId } },
    });
    if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'That user is not a member of this organization' });
    }
    if (target.role === 'ADMIN' && !willRemainAdmin) {
        const adminCount = await prisma.organizationMember.count({ where: { orgId, role: 'ADMIN' } });
        if (adminCount <= 1) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot demote or remove the last admin of the organization' });
        }
    }
    return target;
}

export async function updateMemberRole(
    orgId: string,
    actorUserId: string,
    targetUserId: string,
    role: UserRole,
): Promise<OrgMemberListItem> {
    await loadTargetWithRails(orgId, actorUserId, targetUserId, role === 'ADMIN');
    const updated = await prisma.organizationMember.update({
        where: { orgId_userId: { orgId, userId: targetUserId } },
        data: { role },
        include: { user: { select: { id: true, name: true, email: true } } },
    });
    return {
        userId: updated.user.id,
        name: updated.user.name,
        email: updated.user.email,
        role: updated.role,
        joinedAt: updated.createdAt,
    };
}

/**
 * Removes a member. Deletes the membership row AND the user's facility
 * assignments within this org in one transaction — middleware.ts's
 * checkBinAccess authorizes from UserFacility alone (it never re-checks
 * org membership), so stale assignments would keep granting bin-level
 * access to someone no longer in the org. The User row itself stays:
 * historical records (cycles, events) reference it, and the same account
 * may belong to other orgs.
 */
export async function removeMember(orgId: string, actorUserId: string, targetUserId: string): Promise<{ userId: string }> {
    await loadTargetWithRails(orgId, actorUserId, targetUserId, false);
    await prisma.$transaction([
        prisma.userFacility.deleteMany({
            where: { userId: targetUserId, facility: { organizationId: orgId } },
        }),
        prisma.organizationMember.delete({
            where: { orgId_userId: { orgId, userId: targetUserId } },
        }),
    ]);
    return { userId: targetUserId };
}

export const orgMemberService = {
    listMembers,
    updateMemberRole,
    removeMember,
};
