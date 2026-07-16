import type { PrismaClient, UserRole } from '@prisma/client';

interface OrgResolutionInput {
    userId: string | null;
    facilityId: string | null; // from station.facility.id
    /**
     * Explicit org selection from the `x-org-id` request header. A user with
     * multiple memberships would otherwise ALWAYS resolve to their oldest
     * org (the findFirst below) — and silently act in it. Validated against
     * the caller's own memberships and FAIL-CLOSED: a requested org the user
     * doesn't belong to resolves to no org at all, never to the default one
     * (falling back would turn a typo'd/forged header into acting on the
     * wrong tenant). Ignored for station-resolved requests.
     */
    requestedOrgId?: string | null;
}

export interface OrgResolution {
    orgId: string | null;
    /**
     * The caller's ORG-SCOPED role for the resolved org — i.e. their
     * OrganizationMember.role, NOT their global User.role (Task 25: those
     * can legitimately differ, e.g. an existing account with global ADMIN
     * invited into a different org as DRIVER). Resolved from the same
     * membership row as orgId, so no second DB round-trip is needed. `null`
     * for station-resolved orgId (no ctx.user) — stations don't have roles,
     * mirroring how ctx.user itself is null there.
     */
    orgRole: UserRole | null;
}

/** Resolve the tenant for this request (and the caller's role within it):
 * user membership wins, then station's facility. */
export async function resolveOrgId(
    prisma: PrismaClient,
    { userId, facilityId, requestedOrgId }: OrgResolutionInput,
): Promise<OrgResolution> {
    if (userId) {
        if (requestedOrgId) {
            const member = await prisma.organizationMember.findUnique({
                where: { orgId_userId: { orgId: requestedOrgId, userId } },
                select: { orgId: true, role: true },
            });
            // Fail closed: an org the caller doesn't belong to resolves to
            // nothing — never silently falls back to their default org.
            return member ? { orgId: member.orgId, orgRole: member.role } : { orgId: null, orgRole: null };
        }
        const member = await prisma.organizationMember.findFirst({
            where: { userId },
            select: { orgId: true, role: true },
            orderBy: { createdAt: 'asc' }, // deterministic if a user ever has 2 memberships
        });
        if (member) return { orgId: member.orgId, orgRole: member.role };
    }
    if (facilityId) {
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: { organizationId: true },
        });
        if (facility) return { orgId: facility.organizationId, orgRole: null };
    }
    return { orgId: null, orgRole: null };
}
