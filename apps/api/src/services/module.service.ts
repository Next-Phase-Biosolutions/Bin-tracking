/**
 * Re-exported from @bin-tracker/db, where the implementation actually lives.
 *
 * Same layering constraint as org-provision.service.ts: provisionOrganization()
 * (packages/db/src/org-provision.ts) calls reconcileModulesForPlan() inside
 * its own transaction, and that file must stay importable from
 * prisma/seed.ts without a reverse dependency on apps/api. This file keeps
 * the conventional apps/api/src/services/*.service.ts entry point so
 * Task 13's Stripe webhook handler, Task 14's requireModule middleware, and
 * Task 16's admin router import it the same way as every other service.
 */
export { reconcileModulesForPlan, getEnabledModules, setModuleOverride } from '@bin-tracker/db';
