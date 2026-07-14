import type { Prisma, ModuleKey } from '@prisma/client';
import { PLAN_DEFAULT_MODULES, type Plan } from '@bin-tracker/types';

/**
 * Re-exported from apps/api/src/services/module.service.ts, where the
 * conventional entry point lives.
 *
 * Implementation has to live in packages/db (not apps/api) for the same
 * reason org-provision.ts does: provisionOrganization() calls
 * reconcileModulesForPlan() inside its transaction, and provisionOrganization
 * itself must stay callable from prisma/seed.ts, which runs inside this
 * package's own composite TS project and cannot reach into apps/api without
 * cycling the turbo task graph.
 *
 * Takes Prisma.TransactionClient (not PrismaClient) so it works both inside
 * a $transaction callback (provisionOrganization's use case) and with the
 * top-level prisma singleton (Task 14/16's use case) — a full PrismaClient
 * is structurally assignable to Prisma.TransactionClient, but not the other
 * way around.
 */
export async function reconcileModulesForPlan(prisma: Prisma.TransactionClient, orgId: string, plan: Plan): Promise<void> {
    const defaults = PLAN_DEFAULT_MODULES[plan];
    for (const module of defaults) {
        await prisma.organizationModule.upsert({
            where: { orgId_module: { orgId, module: module as ModuleKey } },
            update: { enabled: true, source: 'plan' },
            create: { orgId, module: module as ModuleKey, enabled: true, source: 'plan' },
        });
    }
    // Plan-sourced modules NOT in the new plan's defaults get disabled — manual overrides are untouched.
    await prisma.organizationModule.updateMany({
        where: { orgId, source: 'plan', module: { notIn: defaults as ModuleKey[] } },
        data: { enabled: false },
    });
}

export async function getEnabledModules(prisma: Prisma.TransactionClient, orgId: string): Promise<ModuleKey[]> {
    const rows = await prisma.organizationModule.findMany({ where: { orgId, enabled: true } });
    return rows.map((r) => r.module);
}

export async function setModuleOverride(
    prisma: Prisma.TransactionClient,
    input: { orgId: string; module: ModuleKey; enabled: boolean; updatedBy: string },
): Promise<void> {
    await prisma.organizationModule.upsert({
        where: { orgId_module: { orgId: input.orgId, module: input.module } },
        update: { enabled: input.enabled, source: 'manual', updatedBy: input.updatedBy },
        create: { orgId: input.orgId, module: input.module, enabled: input.enabled, source: 'manual', updatedBy: input.updatedBy },
    });
}
