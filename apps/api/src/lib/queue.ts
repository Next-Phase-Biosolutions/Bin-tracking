import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { PayrollPeriodInput } from '@bin-tracker/validators';
import type { PayrollRunView } from '@bin-tracker/types';

// NOTE: package.json pins "ioredis" to the exact version bullmq bundles
// internally (5.10.1). If they diverge, pnpm keeps two separate `Redis`
// classes in the tree and TypeScript rejects our IORedis instance as
// incompatible with BullMQ's `ConnectionOptions` type. Bump both together.

export const HEAVY_JOBS_QUEUE = 'heavy-jobs';

/** Job data for the one job type this batch introduces. */
export interface PayrollComputeRunJobData {
    orgId: string;
    input: PayrollPeriodInput;
}

export const PAYROLL_COMPUTE_RUN_JOB = 'payroll.computeRun';

type HeavyJobName = typeof PAYROLL_COMPUTE_RUN_JOB;
type HeavyJobResult = PayrollRunView;

let _connection: IORedis | null = null;
let _queue: Queue<PayrollComputeRunJobData, HeavyJobResult, HeavyJobName> | null = null;

/**
 * Creates an ioredis connection from REDIS_URL. `maxRetriesPerRequest: null`
 * is required by BullMQ for its blocking commands (see BullMQ docs). Throws
 * if REDIS_URL is unset — callers are responsible for only calling this when
 * the queue is actually needed (see getHeavyJobsQueue below), so a missing
 * REDIS_URL never crashes server boot, only an actual enqueue/worker start.
 */
export function createRedisConnection(): IORedis {
    const url = process.env['REDIS_URL'];
    if (!url) throw new Error('REDIS_URL not configured — set it before using the heavy-jobs queue');
    return new IORedis(url, { maxRetriesPerRequest: null });
}

/**
 * Lazy singleton — mirrors lib/stripe.ts's getStripe(). Deliberately does NOT
 * read/validate REDIS_URL at import time so the server boots cleanly with it
 * unset (e.g. local dev). Only throws when a job is actually enqueued or
 * polled.
 */
export function getHeavyJobsQueue(): Queue<PayrollComputeRunJobData, HeavyJobResult, HeavyJobName> {
    if (_queue) return _queue;
    _connection = createRedisConnection();
    _queue = new Queue(HEAVY_JOBS_QUEUE, { connection: _connection });
    return _queue;
}
