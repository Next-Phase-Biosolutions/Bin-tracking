import { prisma } from '@bin-tracker/db';
import type { UpdatePayrollSettingsInput } from '@bin-tracker/validators';
import { sendManagerEmailChangedNotice } from '../lib/email.js';
import { captureError } from '../lib/sentry.js';

/**
 * The org's payroll config (rate/currency/timezone/managerEmail). Every org is
 * provisioned with a Settings row (org-provision.ts), so `get` returns null only
 * for an org that somehow predates provisioning; the update path upserts anyway.
 */
export const settingsService = {
    /** Read the org's Settings row. Kept single-line so the tenancy audit's
     * same-line `organizationId` check passes without an allowlist entry. */
    async get(orgId: string) {
        return prisma.settings.findUnique({ where: { organizationId: orgId } });
    },

    /**
     * Upsert the org's Settings. Real orgs always have a row (the `create`
     * branch is a defensive fallback). Scoped to organizationId only, so it can
     * never write another org's row.
     *
     * Every call writes a PayrollAuditLog entry (who/old/new) in the same
     * transaction — this is money-movement config. If managerEmail changes,
     * the PREVIOUS address is notified (best-effort): that inbox authorizes
     * payouts, so its holder must learn when approval is redirected.
     */
    async update(orgId: string, input: UpdatePayrollSettingsInput, actorId: string) {
        const existing = await prisma.settings.findUnique({ where: { organizationId: orgId } });
        const oldValue = existing
            ? {
                  flatHourlyRateCents: existing.flatHourlyRateCents,
                  currency: existing.currency,
                  companyTimezone: existing.companyTimezone,
                  managerEmail: existing.managerEmail,
              }
            : null;
        // Captured BEFORE the write, deliberately — never read pre-state
        // through an object that has since been updated.
        const previousManager = existing?.managerEmail ?? null;

        const [updated] = await prisma.$transaction([
            prisma.settings.upsert({
                where: { organizationId: orgId },
                create: { organizationId: orgId, ...input },
                update: { ...input },
            }),
            prisma.payrollAuditLog.create({
                data: { orgId, actorId, action: 'settings.update', oldValue: oldValue ?? undefined, newValue: input },
            }),
        ]);

        if (previousManager && previousManager !== input.managerEmail) {
            try {
                const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
                await sendManagerEmailChangedNotice(previousManager, org?.name ?? 'Your organization', input.managerEmail);
            } catch (error: unknown) {
                // The save succeeded; the notice is defense-in-depth, not a gate.
                captureError(error, orgId);
            }
        }

        return updated;
    },
};
