import type { Prisma, PrismaClient } from '@prisma/client';
import { Urgency } from '@prisma/client';

/**
 * Default bin-type set every new organization gets on creation.
 * Values mirror what used to be hardcoded directly in prisma/seed.ts —
 * extracted here so the seed script and (future, Phase 4) self-serve signup
 * share one source of truth instead of drifting apart.
 *
 * Lives in @bin-tracker/db (not apps/api) so prisma/seed.ts can import it
 * without a reverse dependency on apps/api — apps/api already depends on
 * this package, so a cycle back the other way would break the turbo task
 * graph and this package's composite TS project boundary. apps/api re-exports
 * this from src/services/org-provision.service.ts for callers there.
 */
export const DEFAULT_BIN_TYPES = [
    { organType: 'heart', dkHours: 4, urgency: Urgency.CRITICAL, prefix: 'BIN-HEART', masterQrCode: 'TYPE-HEART' },
    { organType: 'liver', dkHours: 6, urgency: Urgency.CRITICAL, prefix: 'BIN-LIVER', masterQrCode: 'TYPE-LIVER' },
    { organType: 'kidney', dkHours: 12, urgency: Urgency.MEDIUM, prefix: 'BIN-KIDNEY', masterQrCode: 'TYPE-KIDNEY' },
    { organType: 'skin', dkHours: 24, urgency: Urgency.STANDARD, prefix: 'BIN-SKIN', masterQrCode: 'TYPE-SKIN' },
    { organType: 'fat', dkHours: 24, urgency: Urgency.STANDARD, prefix: 'BIN-FAT', masterQrCode: 'TYPE-FAT' },
    { organType: 'bone', dkHours: 48, urgency: Urgency.LOW, prefix: 'BIN-BONE', masterQrCode: 'TYPE-BONE' },
] as const;

// Starter default until an admin sets a real rate via the Settings screen —
// the Settings row must exist (payroll checks for its presence), but the rate
// itself is just a placeholder the org is expected to configure.
const DEFAULT_HOURLY_RATE_CENTS = 1500; // $15.00/hr

export interface ProvisionOrganizationInput {
    name: string;
    slug: string;
    ownerUserId: string;
}

export interface ProvisionOrganizationResult {
    orgId: string;
}

/**
 * Creates a brand-new tenant: the Organization row, an owner membership, the
 * default BinType set, a default Settings row, and a STARTER/TRIALING
 * Subscription. Runs as one transaction — a failure partway through leaves
 * nothing half-created. Used by the seed script and, in a later phase,
 * self-serve signup.
 */
export async function provisionOrganization(
    prisma: PrismaClient,
    { name, slug, ownerUserId }: ProvisionOrganizationInput,
): Promise<ProvisionOrganizationResult> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const org = await tx.organization.create({ data: { name, slug } });

        await tx.organizationMember.create({
            data: { orgId: org.id, userId: ownerUserId },
        });

        await tx.binType.createMany({
            data: DEFAULT_BIN_TYPES.map((binType) => ({ ...binType, organizationId: org.id })),
        });

        await tx.settings.create({
            data: { organizationId: org.id, flatHourlyRateCents: DEFAULT_HOURLY_RATE_CENTS },
        });

        await tx.subscription.create({
            data: { orgId: org.id, plan: 'STARTER', status: 'TRIALING', stripeCustomerId: null },
        });

        return { orgId: org.id };
    });
}
