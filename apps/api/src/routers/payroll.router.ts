import { router, orgOpsProcedure } from '../trpc/trpc.js';
import { payrollPeriodSchema, payrollListSchema } from '@bin-tracker/validators';
import { payrollService } from '../services/payroll.service.js';

export const payrollRouter = router({
    /** Build or rebuild a month's payroll from recorded work sessions */
    computeRun: orgOpsProcedure
        .input(payrollPeriodSchema)
        .mutation(async ({ ctx, input }) => {
            return payrollService.computeRun(ctx.orgId, input);
        }),

    /** Fetch a single run with line items + exceptions */
    getRun: orgOpsProcedure
        .input(payrollPeriodSchema)
        .query(async ({ ctx, input }) => {
            return payrollService.getRun(ctx.orgId, input);
        }),

    /** List recent runs (newest first) */
    listRuns: orgOpsProcedure
        .input(payrollListSchema)
        .query(async ({ ctx, input }) => {
            return payrollService.listRuns(ctx.orgId, input);
        }),
});
