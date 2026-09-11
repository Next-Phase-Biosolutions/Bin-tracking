import { describe, it, expect, vi } from 'vitest';
import type { FormDigitizeDraft } from '@bin-tracker/types';

// digitizeFromPhoto enqueues on the heavy-jobs queue instead of running
// inline (Task 22b, mirroring Task 22a's payroll.computeRun); digitizeJobStatus
// polls it. Mock at the queue boundary (lib/queue.js) and form.service.js's
// own Gemini logic (already covered by form-digitize.service.test.ts), and
// drive the router through createCaller.
const addMock = vi.fn();
const getJobMock = vi.fn();

vi.mock('../lib/queue.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lib/queue.js')>();
    return {
        ...actual,
        HEAVY_JOBS_QUEUE: 'heavy-jobs',
        FORM_DIGITIZE_JOB: 'form.digitizeFromPhoto',
        getHeavyJobsQueue: () => ({ add: addMock, getJob: getJobMock }),
    };
});

vi.mock('../services/form.service.js', () => ({
    formService: {
        listByStage: vi.fn(),
        getById: vi.fn(),
        digitizeFromPhoto: vi.fn(),
        refineFromRegion: vi.fn(),
        create: vi.fn(),
        transcribeField: vi.fn(),
        submit: vi.fn(),
        listSubmissions: vi.fn(),
        getSubmission: vi.fn(),
        updateSubmission: vi.fn(),
    },
}));

vi.mock('../services/form-voice-fill.service.js', () => ({
    formVoiceFillService: {
        fillFromVoice: vi.fn(),
    },
}));

const { formRouter } = await import('./form.router.js');

const ORG_A = 'org-a';
const ORG_B = 'org-b';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(orgId: string, orgRole: string = 'ADMIN'): any {
    return {
        orgId,
        user: { id: 'user-1', role: 'ADMIN' },
        // Task 25: orgOpsProcedure now gates on ctx.orgRole (the caller's
        // per-org membership role), not ctx.user.role.
        orgRole,
        prisma: {
            organizationModule: {
                findUnique: vi.fn().mockResolvedValue({ enabled: true }),
            },
        },
    };
}

describe('form.digitizeFromPhoto', () => {
    it('enqueues a job on the heavy-jobs queue with the org, image, and mime type, and returns its id', async () => {
        addMock.mockResolvedValue({ id: 'job-1' });

        const caller = formRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.digitizeFromPhoto({ imageBase64: 'base64==', mimeType: 'image/png' });

        expect(result).toEqual({ jobId: 'job-1' });
        expect(addMock).toHaveBeenCalledWith('form.digitizeFromPhoto', {
            orgId: ORG_A,
            imageBase64: 'base64==',
            mimeType: 'image/png',
        });
    });
});

describe('form.digitizeJobStatus', () => {
    it('denies with NOT_FOUND when the job belongs to a different org (never leaks a FORBIDDEN that would confirm existence)', async () => {
        getJobMock.mockResolvedValue({ data: { orgId: ORG_B }, getState: vi.fn() });

        const caller = formRouter.createCaller(makeCtx(ORG_A));

        await expect(caller.digitizeJobStatus({ jobId: 'job-1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('denies with NOT_FOUND when the job does not exist at all — same error as a foreign-org job', async () => {
        getJobMock.mockResolvedValue(undefined);

        const caller = formRouter.createCaller(makeCtx(ORG_A));

        await expect(caller.digitizeJobStatus({ jobId: 'nope' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns the digitized draft once a same-org job has completed, surviving the BullMQ JSON round-trip unchanged', async () => {
        // Unlike PayrollRunView, FormDigitizeDraft has no Date fields, so this
        // is a regression guard that a real JSON.stringify/JSON.parse round-trip
        // (exactly what BullMQ does to job.returnvalue) doesn't corrupt it —
        // same discipline as payroll.router.test.ts's Date-revival test, just
        // confirming the "no revival needed" side of that story.
        const draft: FormDigitizeDraft = {
            title: 'Intake Form',
            description: 'Filled at receiving dock',
            formType: 'standard',
            schema: { formType: 'standard', sections: [] },
            warnings: ['Adjusted column count'],
        };
        const returnvalue = JSON.parse(JSON.stringify(draft));

        getJobMock.mockResolvedValue({
            name: 'form.digitizeFromPhoto',
            data: { orgId: ORG_A },
            getState: vi.fn().mockResolvedValue('completed'),
            returnvalue,
        });

        const caller = formRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.digitizeJobStatus({ jobId: 'job-1' });

        expect(result).toEqual({ state: 'completed', result: draft });
    });

    it('returns the failure reason once a same-org job has failed', async () => {
        getJobMock.mockResolvedValue({
            name: 'form.digitizeFromPhoto',
            data: { orgId: ORG_A },
            getState: vi.fn().mockResolvedValue('failed'),
            failedReason: 'GEMINI_API_KEY is not configured',
        });

        const caller = formRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.digitizeJobStatus({ jobId: 'job-1' });

        expect(result).toEqual({ state: 'failed', error: 'GEMINI_API_KEY is not configured' });
    });

    it('reports in-progress states without a result or error', async () => {
        getJobMock.mockResolvedValue({
            name: 'form.digitizeFromPhoto',
            data: { orgId: ORG_A },
            getState: vi.fn().mockResolvedValue('active'),
        });

        const caller = formRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.digitizeJobStatus({ jobId: 'job-1' });

        expect(result).toEqual({ state: 'active' });
    });

    it('denies with NOT_FOUND when a same-org jobId belongs to a payroll.computeRun job on the shared heavy-jobs queue (job-type confusion, not just org confusion)', async () => {
        // BullMQ job IDs are queue-scoped, not job-type-scoped: this job
        // passes the org check but is the wrong job.name, so it must be
        // denied identically to a nonexistent/foreign-org job — no leaking
        // "this job exists but is the wrong type" as distinguishable info.
        getJobMock.mockResolvedValue({
            name: 'payroll.computeRun',
            data: { orgId: ORG_A },
            getState: vi.fn().mockResolvedValue('completed'),
            returnvalue: { id: 'run-1', period: '2026-06', status: 'DRAFT' },
        });

        const caller = formRouter.createCaller(makeCtx(ORG_A));

        await expect(caller.digitizeJobStatus({ jobId: 'job-1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});

describe('per-org AI rate limit on digitizeFromPhoto', () => {
    it('rejects the 11th enqueue within a minute for the same org with TOO_MANY_REQUESTS', async () => {
        addMock.mockResolvedValue({ id: 'job-x' });
        const caller = formRouter.createCaller(makeCtx('org-rate-limit'));

        // rate-limit.ts's shared limiter allows 10 calls/minute per org,
        // shared across digitizeFromPhoto and refineFromRegion.
        for (let i = 0; i < 10; i++) {
            await caller.digitizeFromPhoto({ imageBase64: 'base64==', mimeType: 'image/png' });
        }

        await expect(
            caller.digitizeFromPhoto({ imageBase64: 'base64==', mimeType: 'image/png' }),
        ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    });

    it('does not throttle a different org sharing no bucket with an already-limited org', async () => {
        addMock.mockResolvedValue({ id: 'job-y' });
        const caller = formRouter.createCaller(makeCtx('org-rate-limit-isolated'));

        const result = await caller.digitizeFromPhoto({ imageBase64: 'base64==', mimeType: 'image/png' });

        expect(result).toEqual({ jobId: 'job-y' });
    });
});

describe('form.submit', () => {
    it('passes ctx.user.id through as the acting user', async () => {
        const { formService } = await import('../services/form.service.js');
        vi.mocked(formService.submit).mockResolvedValue({
            id: 'cljsubmission1000000000001',
            formId: 'cljform1000000000000000001',
            submittedByUserId: 'user-1',
            values: { formType: 'standard', values: {}, tableRows: {} },
            createdAt: new Date(),
        });

        const caller = formRouter.createCaller(makeCtx(ORG_A));
        await caller.submit({
            formId: 'cljform1000000000000000001',
            values: { formType: 'standard', values: {}, tableRows: {} },
        });

        expect(formService.submit).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ formId: 'cljform1000000000000000001' }),
            ORG_A,
            'user-1',
        );
    });
});

describe('form.getSubmission', () => {
    it('surfaces NOT_FOUND when the service reports no submission (cross-org or missing)', async () => {
        const { formService } = await import('../services/form.service.js');
        vi.mocked(formService.getSubmission).mockResolvedValue(null);

        const caller = formRouter.createCaller(makeCtx(ORG_A));

        await expect(caller.getSubmission({ id: 'cljsubmissionb000000000001' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});

describe('form.updateSubmission', () => {
    it('denies a non-admin org role with FORBIDDEN before the service is ever called', async () => {
        const { formService } = await import('../services/form.service.js');
        vi.mocked(formService.updateSubmission).mockClear();

        const caller = formRouter.createCaller(makeCtx(ORG_A, 'OPS_MANAGER'));

        await expect(
            caller.updateSubmission({ id: 'cljsubmission1000000000001', values: { formType: 'standard', values: {}, tableRows: {} } }),
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(formService.updateSubmission).not.toHaveBeenCalled();
    });

    it('allows an ADMIN org role through to the service', async () => {
        const { formService } = await import('../services/form.service.js');
        vi.mocked(formService.updateSubmission).mockResolvedValue({
            id: 'cljsubmission1000000000001',
            formId: 'cljform1000000000000000001',
            submittedByUserId: 'user-1',
            values: { formType: 'standard', values: { name: 'Fixed' }, tableRows: {} },
            createdAt: new Date(),
        });

        const caller = formRouter.createCaller(makeCtx(ORG_A, 'ADMIN'));
        const result = await caller.updateSubmission({
            id: 'cljsubmission1000000000001',
            values: { formType: 'standard', values: { name: 'Fixed' }, tableRows: {} },
        });

        expect(result.values).toEqual({ formType: 'standard', values: { name: 'Fixed' }, tableRows: {} });
    });
});
