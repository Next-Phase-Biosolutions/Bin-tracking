import { prisma } from './index.js';

const TENANT_TABLES = [
    'facilities', 'bin_types', 'bins', 'bin_cycles', 'employees',
    'shipments', 'form_templates', 'animal_registrations', 'settings', 'payroll_runs',
] as const;

async function main(): Promise<void> {
    const org = await prisma.organization.upsert({
        where: { slug: 'default' },
        update: {},
        create: { name: 'Default Organization', slug: 'default' },
    });

    // Legacy org keeps full access: explicit ENTERPRISE subscription row.
    // (requireModule denies orgs WITHOUT an enabled OrganizationModule row — see Task 14.)
    await prisma.subscription.upsert({
        where: { orgId: org.id },
        update: {},
        create: { orgId: org.id, plan: 'ENTERPRISE', status: 'ACTIVE' },
    });

    for (const table of TENANT_TABLES) {
        // Raw SQL: Prisma's typed API can't iterate table names.
        const updated = await prisma.$executeRawUnsafe(
            `UPDATE "${table}" SET "organizationId" = $1 WHERE "organizationId" IS NULL`,
            org.id,
        );
        console.log(`${table}: backfilled ${updated} rows`);
    }

    // Every existing user becomes a member of the default org, with a role
    // seeded from their current global role (Task 25: OrganizationMember.role
    // is now the source of truth for org-scoped authorization — a legacy
    // membership must not be left without one). `update: {}` on a re-run
    // deliberately leaves an already-set role untouched, matching this
    // script's existing idempotency: it only ever fills in what's missing.
    const users = await prisma.user.findMany({ select: { id: true, role: true } });
    for (const u of users) {
        await prisma.organizationMember.upsert({
            where: { orgId_userId: { orgId: org.id, userId: u.id } },
            update: {},
            create: { orgId: org.id, userId: u.id, role: u.role },
        });
    }
    console.log(`memberships ensured for ${users.length} users`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
