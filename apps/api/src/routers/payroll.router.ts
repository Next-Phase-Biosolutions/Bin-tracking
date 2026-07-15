import { TRPCError } from '@trpc/server';
import { router, orgOpsProcedure, requireModule } from '../trpc/trpc.js';
import { payrollPeriodSchema, payrollListSchema, payrollJobStatusSchema } from '@bin-tracker/validators';
import { payrollService } from '../services/payroll.service.js';
import { getHeavyJobsQueue, PAYROLL_COMPUTE_RUN_JOB, reviveJobResultDates } from '../lib/queue.js';
import type { PayrollRunView } from '@bin-tracker/types';

export const payrollRouter = router({
    /**
     * Enqueues a payroll computation on the `heavy-jobs` queue and returns
     * immediately with a jobId — computeRun does raw SQL aggregation over a
     * month of work sessions, which can be slow enough to blow past a
     * request timeout for larger orgs. Poll `jobStatus` for the result.
     */
    computeRun: orgOpsProcedure
        .use(requireModule('PAYROLL'))
        .input(payrollPeriodSchema)
        .mutation(async ({ ctx, input }) => {
            const job = await getHeavyJobsQueue().add(PAYROLL_COMPUTE_RUN_JOB, { orgId: ctx.orgId, input });
            return { jobId: job.id! };
        }),

    /**
     * Polls the status of a `computeRun` job. The job's own orgId (stored at
     * enqueue time) must match ctx.orgId — a job that doesn't exist and a job
     * that belongs to another org both report NOT_FOUND, so a caller can
     * never distinguish "not yours" from "doesn't exist" (same discipline as
     * cycle.service.ts's pickup/deliver).
     */
    jobStatus: orgOpsProcedure
        .use(requireModule('PAYROLL'))
        .input(payrollJobStatusSchema)
        .query(async ({ ctx, input }) => {
            const job = await getHeavyJobsQueue().getJob(input.jobId);
            if (!job || job.data.orgId !== ctx.orgId) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
            }

            const state = await job.getState();
            if (state === 'completed') {
                // getJob's returnvalue type is the union across all heavy-jobs
                // job types (Task 22b added a second one); this job name only
                // ever produces a PayrollRunView.
                return { state, result: reviveJobResultDates(job.returnvalue as PayrollRunView) };
            }
            if (state === 'failed') {
                return { state, error: job.failedReason };
            }
            return { state };
        }),

    /** Fetch a single run with line items + exceptions */
    getRun: orgOpsProcedure
        .use(requireModule('PAYROLL'))
        .input(payrollPeriodSchema)
        .query(async ({ ctx, input }) => {
            return payrollService.getRun(ctx.orgId, input);
        }),

    /** List recent runs (newest first) */
    listRuns: orgOpsProcedure
        .use(requireModule('PAYROLL'))
        .input(payrollListSchema)
        .query(async ({ ctx, input }) => {
            return payrollService.listRuns(ctx.orgId, input);
        }),
});
