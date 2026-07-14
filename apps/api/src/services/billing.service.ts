/**
 * defaultPlanForNewOrg is re-exported from @bin-tracker/db, where it has to
 * live so provisionOrganization() (packages/db/src/org-provision.ts) can
 * call it inside its own transaction without a reverse dependency on
 * apps/api — see org-provision.service.ts for the full layering rationale.
 *
 * Task 13 extends this file with the rest of the Stripe billing logic
 * (checkout sessions, webhook sync), which belongs here since it needs
 * apps/api's Stripe client and request handling.
 */
export { defaultPlanForNewOrg } from '@bin-tracker/db';
