import { router, opsManagerProcedure } from '../trpc/trpc.js';
import { payrollPeriodSchema, payrollListSchema } from '@bin-tracker/validators';
import { payrollService } from '../services/payroll.service.js';
import { getDefaultOrganizationId } from '../lib/default-org.js';

export const payrollRouter = router({
    /** Build or rebuild a month's payroll from recorded work sessions */
    computeRun: opsManagerProcedure
        .input(payrollPeriodSchema)
        .mutation(async ({ input }) => {
            return payrollService.computeRun(input, await getDefaultOrganizationId());
        }),

    /** Fetch a single run with line items + exceptions */
    getRun: opsManagerProcedure
        .input(payrollPeriodSchema)
        .query(async ({ input }) => {
            return payrollService.getRun(input);
        }),

    /** List recent runs (newest first) */
    listRuns: opsManagerProcedure
        .input(payrollListSchema)
        .query(async ({ input }) => {
            return payrollService.listRuns(input);
        }),
});
