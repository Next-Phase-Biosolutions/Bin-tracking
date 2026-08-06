import { prisma } from './index.js';
import { setModuleOverride } from './module-service.js';

/**
 * One-time backfill: enables ENVIRONMENT_MONITORING for every existing org,
 * not just one. reconcileModulesForPlan only fires at org-create/plan-change
 * time and never retroactively touches existing orgs — see
 * enable-sensor-module-demo-org.ts for the single-org version this
 * generalizes.
 *
 * Needed because of the shared-sensor-device product decision (see
 * SHARED_DEVICE_IDS in apps/api/src/services/sensor.service.ts): every org's
 * Wet Aging tab should show that one device's real readings, which still
 * requires the org to hold the module grant — the shared-device allowlist
 * bypasses org/facility *device* scoping, not the module gate.
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
