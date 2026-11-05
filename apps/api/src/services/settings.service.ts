import { prisma } from '@bin-tracker/db';
import { TRPCError } from '@trpc/server';
import type { AttendanceMethodInput, UpdatePayrollSettingsInput } from '@bin-tracker/validators';
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

    /**
     * Switch the organization between NFC tap attendance and the original QR badge scan.
     * Exactly one is active. Recorded in PayrollAuditLog (who/old/new): it decides which
     * clock-in records feed payroll. A no-op write (same value) is not logged.
     */
    async setAttendanceMethod(orgId: string, method: AttendanceMethodInput, actorId: string) {
        const existing = await prisma.settings.findUnique({ where: { organizationId: orgId } });
        if (!existing) {
            throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Payroll settings are not configured yet. Set the hourly rate first.' });
        }
        if (existing.attendanceMethod === method) return { attendanceMethod: method };

        await prisma.$transaction([
            prisma.settings.update({ where: { organizationId: orgId }, data: { attendanceMethod: method } }),
            prisma.payrollAuditLog.create({
                data: {
                    orgId,
                    actorId,
                    action: 'settings.attendanceMethod',
                    oldValue: { attendanceMethod: existing.attendanceMethod },
                    newValue: { attendanceMethod: method },
                },
            }),
        ]);
        return { attendanceMethod: method };
    },
};
