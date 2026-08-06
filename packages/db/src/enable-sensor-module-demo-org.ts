import { prisma } from './index.js';
import { setModuleOverride } from './module-service.js';

// Provisioning (reconcileModulesForPlan) only fires at org-create/plan-change
// time — it never retroactively touches existing orgs, so the demo org needs
// this one-time manual override to pick up ENVIRONMENT_MONITORING. Uses
// setModuleOverride (source: 'manual') rather than raw SQL so the row
// survives the next plan reconciliation instead of being silently disabled.
async function main(): Promise<void> {
    const org = await prisma.organization.findUniqueOrThrow({ where: { slug: 'default' } });

    const platformAdmin = await prisma.user.findFirstOrThrow({
        where: { isPlatformAdmin: true },
    });

    await setModuleOverride(prisma, {
        orgId: org.id,
        module: 'ENVIRONMENT_MONITORING',
        enabled: true,
        updatedBy: platformAdmin.id,
    });

    const row = await prisma.organizationModule.findUniqueOrThrow({
        where: { orgId_module: { orgId: org.id, module: 'ENVIRONMENT_MONITORING' } },
    });
    console.log(`ENVIRONMENT_MONITORING enabled for org ${org.slug}: enabled=${row.enabled} source=${row.source}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
