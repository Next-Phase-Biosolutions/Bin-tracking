import { router, publicProcedure } from '../trpc/trpc.js';
import { payrollPeriodSchema, payrollListSchema } from '@bin-tracker/validators';
import { payrollService } from '../services/payroll.service.js';

export const payrollRouter = router({
    /** Build or rebuild a month's payroll from recorded work sessions */
    computeRun: publicProcedure
        .input(payrollPeriodSchema)
        .mutation(async ({ input }) => {
            return payrollService.computeRun(input);
        }),

    /** Fetch a single run with line items + exceptions */
    getRun: publicProcedure
        .input(payrollPeriodSchema)
        .query(async ({ input }) => {
            return payrollService.getRun(input);
        }),

    /** List recent runs (newest first) */
    listRuns: publicProcedure
        .input(payrollListSchema)
        .query(async ({ input }) => {
            return payrollService.listRuns(input);
        }),
});
