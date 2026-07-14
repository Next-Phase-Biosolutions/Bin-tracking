/**
 * Re-exported from @bin-tracker/db, where the implementation actually lives.
 *
 * The provisioning logic has to live in packages/db (not here) so that
 * prisma/seed.ts — which runs inside the db package's own composite TS
 * project — can call it without a reverse dependency on apps/api (apps/api
 * already depends on @bin-tracker/db; the other direction would cycle the
 * turbo task graph and violate the db package's TS `rootDir` boundary).
 * This file keeps the conventional apps/api/src/services/*.service.ts entry
 * point so callers here (and the future self-serve signup flow) import it
 * the same way as every other service.
 */
export { provisionOrganization, DEFAULT_BIN_TYPES } from '@bin-tracker/db';
export type { ProvisionOrganizationInput, ProvisionOrganizationResult } from '@bin-tracker/db';
