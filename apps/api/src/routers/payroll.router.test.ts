import { describe, it, expect, vi } from 'vitest';

// payroll.computeRun enqueues on the heavy-jobs queue instead of running
// inline (Task 22a); payroll.jobStatus polls it. Mock at the queue boundary
// (lib/queue.js) and payroll.service.js's own DB logic (already covered by
// payroll.service.test.ts), and drive the router through createCaller.
const addMock = vi.fn();
const getJobMock = vi.fn();

vi.mock('../lib/queue.js', () => ({
    HEAVY_JOBS_QUEUE: 'heavy-jobs',
    PAYROLL_COMPUTE_RUN_JOB: 'payroll.computeRun',
    getHeavyJobsQueue: () => ({ add: addMock, getJob: getJobMock }),
}));

vi.mock('../services/payroll.service.js', () => ({
    payrollService: {
        computeRun: vi.fn(),
        getRun: vi.fn(),
        listRuns: vi.fn(),
    },
}));

const { payrollRouter } = await import('./payroll.router.js');

const ORG_A = 'org-a';
const ORG_B = 'org-b';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(orgId: string): any {
    return {
        orgId,
        user: { role: 'ADMIN' },
        prisma: {
            organizationModule: {
                findUnique: vi.fn().mockResolvedValue({ enabled: true }),
            },
        },
    };
}

describe('payroll.computeRun', () => {
    it('enqueues a job on the heavy-jobs queue with the org and input, and returns its id', async () => {
        addMock.mockResolvedValue({ id: 'job-1' });

        const caller = payrollRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.computeRun({ period: '2026-06' });

        expect(result).toEqual({ jobId: 'job-1' });
        expect(addMock).toHaveBeenCalledWith('payroll.computeRun', { orgId: ORG_A, input: { period: '2026-06' } });
    });
});

describe('payroll.jobStatus', () => {
    it('denies with NOT_FOUND when the job belongs to a different org (never leaks a FORBIDDEN that would confirm existence)', async () => {
        getJobMock.mockResolvedValue({ data: { orgId: ORG_B }, getState: vi.fn() });

        const caller = payrollRouter.createCaller(makeCtx(ORG_A));

        await expect(caller.jobStatus({ jobId: 'job-1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('denies with NOT_FOUND when the job does not exist at all — same error as a foreign-org job', async () => {
        getJobMock.mockResolvedValue(undefined);

        const caller = payrollRouter.createCaller(makeCtx(ORG_A));

        await expect(caller.jobStatus({ jobId: 'nope' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns the computed result once a same-org job has completed', async () => {
        getJobMock.mockResolvedValue({
            data: { orgId: ORG_A },
            getState: vi.fn().mockResolvedValue('completed'),
            returnvalue: { id: 'run-1', period: '2026-06' },
        });

        const caller = payrollRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.jobStatus({ jobId: 'job-1' });

        expect(result).toEqual({ state: 'completed', result: { id: 'run-1', period: '2026-06' } });
    });

    it('returns the failure reason once a same-org job has failed', async () => {
        getJobMock.mockResolvedValue({
            data: { orgId: ORG_A },
            getState: vi.fn().mockResolvedValue('failed'),
            failedReason: 'Payroll settings are not configured.',
        });

        const caller = payrollRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.jobStatus({ jobId: 'job-1' });

        expect(result).toEqual({ state: 'failed', error: 'Payroll settings are not configured.' });
    });

    it('reports in-progress states without a result or error', async () => {
        getJobMock.mockResolvedValue({ data: { orgId: ORG_A }, getState: vi.fn().mockResolvedValue('active') });

        const caller = payrollRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.jobStatus({ jobId: 'job-1' });

        expect(result).toEqual({ state: 'active' });
    });
});
