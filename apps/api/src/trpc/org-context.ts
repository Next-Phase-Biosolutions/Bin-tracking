import type { PrismaClient, UserRole } from '@prisma/client';

interface OrgResolutionInput {
    userId: string | null;
    facilityId: string | null; // from station.facility.id
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
    { userId, facilityId }: OrgResolutionInput,
): Promise<OrgResolution> {
    if (userId) {
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
