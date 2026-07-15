import pino from 'pino';
import { Worker, type Job } from 'bullmq';
import {
    HEAVY_JOBS_QUEUE,
    PAYROLL_COMPUTE_RUN_JOB,
    FORM_DIGITIZE_JOB,
    createRedisConnection,
    type PayrollComputeRunJobData,
    type FormDigitizeJobData,
} from './lib/queue.js';
import { payrollService } from './services/payroll.service.js';
import { formService } from './services/form.service.js';
import { initSentry, captureError } from './lib/sentry.js';

type HeavyJobData = PayrollComputeRunJobData | FormDigitizeJobData;

const IS_DEV = process.env['NODE_ENV'] !== 'production';

const logger = pino({
    level: process.env['LOG_LEVEL'] ?? (IS_DEV ? 'debug' : 'info'),
    transport: IS_DEV ? { target: 'pino-pretty' } : undefined,
});

// Same boot-safety story as server.ts — no-op when SENTRY_DSN is unset.
initSentry();

/**
 * Runs a single `heavy-jobs` job. `createRedisConnection()` (called below,
 * at module scope) throws immediately if REDIS_URL is unset — unlike the
 * main API server, this process's only job is to talk to Redis, so failing
 * loudly at startup here is correct rather than a boot-safety violation.
 */
async function processJob(job: Job<HeavyJobData>) {
    switch (job.name) {
        case PAYROLL_COMPUTE_RUN_JOB: {
            const data = job.data as PayrollComputeRunJobData;
            return payrollService.computeRun(data.orgId, data.input);
        }
        case FORM_DIGITIZE_JOB: {
            const data = job.data as FormDigitizeJobData;
            return formService.digitizeFromPhoto(data.imageBase64, data.orgId, data.mimeType);
        }
        default:
            throw new Error(`heavy-jobs worker: unknown job name "${job.name}"`);
    }
}

const worker = new Worker<HeavyJobData>(HEAVY_JOBS_QUEUE, processJob, {
    connection: createRedisConnection(),
});

worker.on('completed', (job) => {
    logger.info({ jobId: job.id, name: job.name, orgId: job.data.orgId }, 'heavy-jobs: job completed');
});

worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, orgId: job?.data.orgId, err }, 'heavy-jobs: job failed');
    captureError(err, job?.data.orgId ?? null);
});

// Graceful shutdown — worker.close() waits for the in-flight job to finish
// before resolving (BullMQ default), so a redeploy hands off cleanly instead
// of relying on the stalled-job timeout to recover a severed job.
// Never under vitest — the runner re-emits signals at teardown and a
// process.exit() here would kill its worker mid-report.
let shuttingDown = false;
if (process.env['NODE_ENV'] !== 'test') {
    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
        process.on(signal, () => {
            if (shuttingDown) return;
            shuttingDown = true;
            logger.info(`${signal} received — finishing in-flight job and shutting down`);
            worker.close().then(
                () => process.exit(0),
                (err) => {
                    logger.error(err, 'error during graceful shutdown');
                    process.exit(1);
                },
            );
        });
    }
}

logger.info(`heavy-jobs worker listening on queue "${HEAVY_JOBS_QUEUE}"`);
