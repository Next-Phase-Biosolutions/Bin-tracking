import { prisma } from './index.js';
import { setModuleOverride } from './module-service.js';

/**
 * One-time backfill: enables ENVIRONMENT_MONITORING for every existing org,
 * not just one. reconcileModulesForPlan only fires at org-create/plan-change
 * time and never retroactively touches existing orgs — see
 * enable-sensor-module-demo-org.ts for the single-org version this
 * generalizes.
 *
 * Each org only ever sees its own devices (there is no cross-org visibility),
 * and seeing them still requires the org to hold this module grant — so an org
 * that gets a sensor registered also needs the module enabled.
 */
async function main(): Promise<void> {
  const platformAdmin = await prisma.user.findFirst({ where: { isPlatformAdmin: true } });
  const updatedBy = platformAdmin?.id ?? 'enable-sensor-module-all-orgs-script';

  const orgs = await prisma.organization.findMany({ select: { id: true, slug: true } });

  for (const org of orgs) {
    await setModuleOverride(prisma, {
      orgId: org.id,
      module: 'ENVIRONMENT_MONITORING',
      enabled: true,
      updatedBy,
    });
    console.log(`ENVIRONMENT_MONITORING enabled for org ${org.slug}`);
  }

  console.log(`Done — ${orgs.length} org(s) updated.`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
