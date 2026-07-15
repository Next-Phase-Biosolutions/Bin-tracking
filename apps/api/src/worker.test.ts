import { describe, it, expect, vi } from 'vitest';

// worker.ts constructs its Worker (and calls createRedisConnection(), which
// throws without REDIS_URL) as a module-level side effect on import — same
// situation server.test.ts handles for server.ts's main(). Mock bullmq's
// Worker to capture the processor function instead of connecting to Redis,
// and mock lib/queue.js / lib/sentry.js / pino so importing this module is
// side-effect-free.
const computeRunMock = vi.fn();
vi.mock('./services/payroll.service.js', () => ({
    payrollService: { computeRun: computeRunMock, getRun: vi.fn(), listRuns: vi.fn() },
}));

const digitizeFromPhotoMock = vi.fn();
vi.mock('./services/form.service.js', () => ({
    formService: {
        digitizeFromPhoto: digitizeFromPhotoMock,
        refineFromRegion: vi.fn(),
        listByStage: vi.fn(),
        getById: vi.fn(),
        create: vi.fn(),
        transcribeField: vi.fn(),
    },
}));

vi.mock('./lib/queue.js', () => ({
    HEAVY_JOBS_QUEUE: 'heavy-jobs',
    PAYROLL_COMPUTE_RUN_JOB: 'payroll.computeRun',
    FORM_DIGITIZE_JOB: 'form.digitizeFromPhoto',
    createRedisConnection: () => ({ marker: 'fake-redis-connection' }),
}));

const sentryMock = vi.hoisted(() => ({ initSentry: vi.fn(), captureError: vi.fn() }));
vi.mock('./lib/sentry.js', () => sentryMock);

vi.mock('pino', () => ({
    default: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

type Processor = (job: { name: string; data: unknown; id?: string }) => unknown;
let capturedProcessor: Processor | undefined;

vi.mock('bullmq', () => ({
    Worker: class {
        constructor(_name: string, processor: Processor) {
            capturedProcessor = processor;
        }
        on(): void {
            // no-op — tests invoke the captured processor directly
        }
    },
}));

await import('./worker.js');

describe('heavy-jobs worker processor', () => {
    it("invokes payrollService.computeRun with the job's orgId and input for a payroll.computeRun job", async () => {
        computeRunMock.mockResolvedValue({ id: 'run-1', period: '2026-06' });
        const job = { name: 'payroll.computeRun', data: { orgId: 'org-a', input: { period: '2026-06' } } };

        const result = await capturedProcessor!(job);

        expect(computeRunMock).toHaveBeenCalledWith('org-a', { period: '2026-06' });
        expect(result).toEqual({ id: 'run-1', period: '2026-06' });
    });

    it("invokes formService.digitizeFromPhoto with the job's imageBase64, orgId, and mimeType for a form.digitizeFromPhoto job", async () => {
        digitizeFromPhotoMock.mockResolvedValue({
            title: 'Intake Form',
            description: null,
            formType: 'standard',
            schema: { formType: 'standard', sections: [] },
        });
        const job = {
            name: 'form.digitizeFromPhoto',
            data: { orgId: 'org-a', imageBase64: 'base64==', mimeType: 'image/png' },
        };

        const result = await capturedProcessor!(job);

        expect(digitizeFromPhotoMock).toHaveBeenCalledWith('base64==', 'org-a', 'image/png');
        expect(result).toEqual({
            title: 'Intake Form',
            description: null,
            formType: 'standard',
            schema: { formType: 'standard', sections: [] },
        });
    });

    it('rejects an unrecognized job name instead of silently doing nothing', async () => {
        computeRunMock.mockClear();
        digitizeFromPhotoMock.mockClear();
        const job = { name: 'mystery.job', data: {} };

        await expect(capturedProcessor!(job)).rejects.toThrow(/unknown job name/i);
        expect(computeRunMock).not.toHaveBeenCalled();
        expect(digitizeFromPhotoMock).not.toHaveBeenCalled();
    });
});
