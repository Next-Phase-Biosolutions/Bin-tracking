import pino from 'pino';
import { Worker, type Job } from 'bullmq';
import {
    HEAVY_JOBS_QUEUE,
    PAYROLL_COMPUTE_RUN_JOB,
    createRedisConnection,
    type PayrollComputeRunJobData,
} from './lib/queue.js';
import { payrollService } from './services/payroll.service.js';
import { initSentry, captureError } from './lib/sentry.js';

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
async function processJob(job: Job<PayrollComputeRunJobData>) {
    switch (job.name) {
        case PAYROLL_COMPUTE_RUN_JOB:
            return payrollService.computeRun(job.data.orgId, job.data.input);
        default:
            throw new Error(`heavy-jobs worker: unknown job name "${job.name}"`);
    }
}

const worker = new Worker<PayrollComputeRunJobData>(HEAVY_JOBS_QUEUE, processJob, {
    connection: createRedisConnection(),
});

worker.on('completed', (job) => {
    logger.info({ jobId: job.id, name: job.name, orgId: job.data.orgId }, 'heavy-jobs: job completed');
});

worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, name: job?.name, orgId: job?.data.orgId, err }, 'heavy-jobs: job failed');
    captureError(err, job?.data.orgId ?? null);
});

logger.info(`heavy-jobs worker listening on queue "${HEAVY_JOBS_QUEUE}"`);
