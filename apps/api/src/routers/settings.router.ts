import { router, orgAdminProcedure } from '../trpc/trpc.js';
import { updatePayrollSettingsSchema } from '@bin-tracker/validators';
import { settingsService } from '../services/settings.service.js';

/**
 * Org payroll config (rate/currency/timezone/managerEmail). Admin-only both
 * ways — the rate and the approval-email inbox are org-admin configuration, not
 * data a driver/worker needs. `orgAdminProcedure` resolves ctx.orgId and gates
 * on the caller's ADMIN membership.
 */
export const settingsRouter = router({
    get: orgAdminProcedure.query(({ ctx }) => settingsService.get(ctx.orgId)),

    update: orgAdminProcedure
        .input(updatePayrollSettingsSchema)
        .mutation(({ ctx, input }) => settingsService.update(ctx.orgId, input, ctx.user!.id)),
});
