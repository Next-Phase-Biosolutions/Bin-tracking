import type { ModuleKey, Plan, SubscriptionStatus } from '@bin-tracker/types';
import { prisma, setModuleOverride } from '@bin-tracker/db';

export interface OrgModuleView {
    module: ModuleKey;
    enabled: boolean;
    source: string; // 'plan' | 'manual'
}

export interface OrgListView {
    id: string;
    name: string;
    plan: Plan;
    status: SubscriptionStatus;
    modules: OrgModuleView[];
}

/**
 * Every org, with its current plan/status and its full module bundle — the
 * platform-admin panel's (Task 16) single data source. Orgs are provisioned
 * with a Subscription row at signup (see org-provision.ts), so a missing
 * subscription falls back to the schema's own defaults rather than crashing
 * on a null.
 */
export async function listOrganizations(): Promise<OrgListView[]> {
    const orgs = await prisma.organization.findMany({
        include: { subscription: true, modules: true },
        orderBy: { name: 'asc' },
    });

    return orgs.map((org) => ({
        id: org.id,
        name: org.name,
        plan: org.subscription?.plan ?? 'STARTER',
        status: org.subscription?.status ?? 'TRIALING',
        modules: org.modules.map((m) => ({ module: m.module, enabled: m.enabled, source: m.source })),
    }));
}

/**
 * Flips a single org's module on/off. Always routes through setModuleOverride
 * (Task 12), which always writes source: 'manual' — this is precisely the
 * override path that survives future plan changes (reconcileModulesForPlan
 * never touches manual rows). Scoped to input.orgId only, so it can never
 * touch another org's OrganizationModule row.
 */
export async function toggleModule(
    input: { orgId: string; module: ModuleKey; enabled: boolean },
    updatedBy: string,
): Promise<void> {
    await setModuleOverride(prisma, {
        orgId: input.orgId,
        module: input.module,
        enabled: input.enabled,
        updatedBy,
    });
}

export const adminService = {
    listOrganizations,
    toggleModule,
};
