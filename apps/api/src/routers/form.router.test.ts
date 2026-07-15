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
    },
}));

const { formRouter } = await import('./form.router.js');

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
            data: { orgId: ORG_A },
            getState: vi.fn().mockResolvedValue('failed'),
            failedReason: 'GEMINI_API_KEY is not configured',
        });

        const caller = formRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.digitizeJobStatus({ jobId: 'job-1' });

        expect(result).toEqual({ state: 'failed', error: 'GEMINI_API_KEY is not configured' });
    });

    it('reports in-progress states without a result or error', async () => {
        getJobMock.mockResolvedValue({ data: { orgId: ORG_A }, getState: vi.fn().mockResolvedValue('active') });

        const caller = formRouter.createCaller(makeCtx(ORG_A));
        const result = await caller.digitizeJobStatus({ jobId: 'job-1' });

        expect(result).toEqual({ state: 'active' });
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
