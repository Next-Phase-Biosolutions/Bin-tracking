import { describe, it, expect, vi } from 'vitest';
import { reviveJobResultDates } from '../lib/queue.js';
import type { PayrollRunView } from '@bin-tracker/types';

// payroll.computeRun enqueues on the heavy-jobs queue instead of running
// inline (Task 22a); payroll.jobStatus polls it. Mock at the queue boundary
// (lib/queue.js) and payroll.service.js's own DB logic (already covered by
// payroll.service.test.ts), and drive the router through createCaller.
// reviveJobResultDates is kept as the REAL implementation (importOriginal)
// because it's exactly what's under test below — mocking it out would hide
// the bug this file exists to catch.
const addMock = vi.fn();
const getJobMock = vi.fn();

vi.mock('../lib/queue.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/queue.js')>();
    return {
        ...actual,
        HEAVY_JOBS_QUEUE: 'heavy-jobs',
        PAYROLL_COMPUTE_RUN_JOB: 'payroll.computeRun',
        getHeavyJobsQueue: () => ({ add: addMock, getJob: getJobMock }),
    };
});

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
        // Task 25: orgOpsProcedure now gates on ctx.orgRole (the caller's
        // per-org membership role), not ctx.user.role.
        orgRole: 'ADMIN',
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

    it('returns the computed result once a same-org job has completed, with real Date instances', async () => {
        // BullMQ persists job.returnvalue to Redis via JSON.stringify and
        // reconstructs it via JSON.parse when the job is read back, so every
        // Date field silently becomes an ISO string by the time the router
        // sees it — even though PayrollRunView's type still says Date. Route
        // a real PayrollRunView through that exact round-trip (rather than
        // hand-constructing a plain object) so this test would have failed
        // before reviveJobResultDates existed: pre-fix, `result` was
        // `job.returnvalue` verbatim, i.e. the JSON-round-tripped strings
        // below, and `toBeInstanceOf(Date)` on a string fails.
        const run: PayrollRunView = {
            id: 'run-1',
            period: '2026-06',
            status: 'APPROVED',
            rateCents: 1500,
            currency: 'USD',
            totalEmployees: 1,
            totalMinutes: 480,
            totalGrossCents: 12000,
            computedAt: new Date('2026-06-30T12:00:00.000Z'),
            createdAt: new Date('2026-06-01T00:00:00.000Z'),
            lineItems: [
                {
                    id: 'line-1',
                    employeeId: 'emp-1',
                    employeeCode: 'E1',
                    fullName: 'Jane Doe',
                    minutes: 480,
                    hours: 8,
                    rateCents: 1500,
                    grossCents: 12000,
                    payoutStatus: 'PAID',
                    payoutRef: 'ref-1',
                    paidAt: new Date('2026-07-01T00:00:00.000Z'),
                },
            ],
            exceptions: [],
        };
        const returnvalue = JSON.parse(JSON.stringify(run));

        getJobMock.mockResolvedValue({
            name: 'payroll.computeRun',
            data: { orgId: ORG_A },
            getState: vi.fn().mockResolvedValue('completed'),
            returnvalue,
        });

        const caller = payrollRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.jobStatus({ jobId: 'job-1' });

        expect(result.state).toBe('completed');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload = (result as any).result as PayrollRunView;
        expect(payload.createdAt).toBeInstanceOf(Date);
        expect(payload.createdAt.toISOString()).toBe('2026-06-01T00:00:00.000Z');
        expect(payload.computedAt).toBeInstanceOf(Date);
        expect(payload.computedAt?.toISOString()).toBe('2026-06-30T12:00:00.000Z');
        expect(payload.lineItems[0]?.paidAt).toBeInstanceOf(Date);
        expect(payload.lineItems[0]?.paidAt?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    });

    it('reviveJobResultDates handles null computedAt / null paidAt without throwing', () => {
        const revived = reviveJobResultDates({
            id: 'run-2',
            period: '2026-06',
            status: 'DRAFT',
            rateCents: 1500,
            currency: 'USD',
            totalEmployees: 0,
            totalMinutes: 0,
            totalGrossCents: 0,
            computedAt: null,
            createdAt: new Date('2026-06-01T00:00:00.000Z'),
            lineItems: [],
            exceptions: [],
        });

        expect(revived.computedAt).toBeNull();
        expect(revived.createdAt).toBeInstanceOf(Date);
    });

    it('returns the failure reason once a same-org job has failed', async () => {
        getJobMock.mockResolvedValue({
            name: 'payroll.computeRun',
            data: { orgId: ORG_A },
            getState: vi.fn().mockResolvedValue('failed'),
            failedReason: 'Payroll settings are not configured.',
        });

        const caller = payrollRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.jobStatus({ jobId: 'job-1' });

        expect(result).toEqual({ state: 'failed', error: 'Payroll settings are not configured.' });
    });

    it('reports in-progress states without a result or error', async () => {
        getJobMock.mockResolvedValue({
            name: 'payroll.computeRun',
            data: { orgId: ORG_A },
            getState: vi.fn().mockResolvedValue('active'),
        });

        const caller = payrollRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.jobStatus({ jobId: 'job-1' });

        expect(result).toEqual({ state: 'active' });
    });

    it('denies with NOT_FOUND when a same-org jobId belongs to a form.digitizeFromPhoto job on the shared heavy-jobs queue (job-type confusion, not just org confusion)', async () => {
        // BullMQ job IDs are queue-scoped, not job-type-scoped: this job
        // passes the org check but is the wrong job.name, so it must be
        // denied identically to a nonexistent/foreign-org job — no leaking
        // "this job exists but is the wrong type" as distinguishable info.
        getJobMock.mockResolvedValue({
            name: 'form.digitizeFromPhoto',
            data: { orgId: ORG_A },
            getState: vi.fn().mockResolvedValue('completed'),
            returnvalue: { title: 'Intake Form', description: null, formType: 'standard', schema: {}, warnings: [] },
        });

        const caller = payrollRouter.createCaller(makeCtx(ORG_A));

        await expect(caller.jobStatus({ jobId: 'job-1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});
