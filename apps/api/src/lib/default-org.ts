import { prisma } from '@bin-tracker/db';

// ponytail: single-tenant stopgap. Every route resolves the same "Default
// Organization" (same row backfill-org.ts and the seed scripts provision)
// until Task 7 wires real per-request tenant resolution into tRPC context.
let cachedId: string | null = null;

export async function getDefaultOrganizationId(): Promise<string> {
    if (cachedId) return cachedId;
    const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'default' } });
    cachedId = org.id;
    return cachedId;
}
