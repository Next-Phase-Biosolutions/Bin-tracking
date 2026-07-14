import type { PrismaClient } from '@prisma/client';

interface OrgResolutionInput {
    userId: string | null;
    facilityId: string | null; // from station.facility.id
}

/** Resolve the tenant for this request: user membership wins, then station's facility. */
export async function resolveOrgId(
    prisma: PrismaClient,
    { userId, facilityId }: OrgResolutionInput,
): Promise<string | null> {
    if (userId) {
        const member = await prisma.organizationMember.findFirst({
            where: { userId },
            select: { orgId: true },
            orderBy: { createdAt: 'asc' }, // deterministic if a user ever has 2 memberships
        });
        if (member) return member.orgId;
    }
    if (facilityId) {
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: { organizationId: true },
        });
        if (facility) return facility.organizationId;
    }
    return null;
}
