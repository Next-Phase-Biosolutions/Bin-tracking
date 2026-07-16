import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { PayrollPeriodInput } from '@bin-tracker/validators';
import type { PayrollRunView, FormDigitizeDraft } from '@bin-tracker/types';

// NOTE: package.json pins "ioredis" to the exact version bullmq bundles
// internally (5.10.1). If they diverge, pnpm keeps two separate `Redis`
// classes in the tree and TypeScript rejects our IORedis instance as
// incompatible with BullMQ's `ConnectionOptions` type. Bump both together.

export const HEAVY_JOBS_QUEUE = 'heavy-jobs';

/** Job data for payroll.computeRun (Task 22a). */
export interface PayrollComputeRunJobData {
    orgId: string;
    input: PayrollPeriodInput;
}

export const PAYROLL_COMPUTE_RUN_JOB = 'payroll.computeRun';

/** Job data for form.digitizeFromPhoto (Task 22b) — Gemini's 10-30s vision call. */
export interface FormDigitizeJobData {
    orgId: string;
    imageBase64: string;
    mimeType: string;
}

export const FORM_DIGITIZE_JOB = 'form.digitizeFromPhoto';

type HeavyJobData = PayrollComputeRunJobData | FormDigitizeJobData;
type HeavyJobName = typeof PAYROLL_COMPUTE_RUN_JOB | typeof FORM_DIGITIZE_JOB;
type HeavyJobResult = PayrollRunView | FormDigitizeDraft;

let _connection: IORedis | null = null;
let _queue: Queue<HeavyJobData, HeavyJobResult, HeavyJobName> | null = null;

/**
 * BullMQ persists `job.returnvalue` to Redis via `JSON.stringify` and
 * reconstructs it via `JSON.parse` when the job is later read back. That
 * round-trip silently turns every `Date` field in `PayrollRunView` into a
 * plain ISO string, even though the type system still claims `Date` — so a
 * completed job's raw `returnvalue` lies about its own shape. Revive the
 * known `Date` fields here, once, at this boundary, so `PayrollRunView`
 * stays an accurate contract for callers (e.g. payroll.router.ts's
 * `jobStatus`). `new Date(...)` is idempotent on an already-real `Date`, so
 * this is safe to call even if BullMQ's in-memory (non-persisted) fast path
 * ever hands back the original object unchanged.
 */
export function reviveJobResultDates(raw: PayrollRunView): PayrollRunView {
    return {
        ...raw,
        computedAt: raw.computedAt ? new Date(raw.computedAt) : null,
        createdAt: new Date(raw.createdAt),
        lineItems: raw.lineItems.map((item) => ({
            ...item,
            paidAt: item.paidAt ? new Date(item.paidAt) : null,
        })),
    };
}

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
export function getHeavyJobsQueue(): Queue<HeavyJobData, HeavyJobResult, HeavyJobName> {
    if (_queue) return _queue;
    _connection = createRedisConnection();
    _queue = new Queue(HEAVY_JOBS_QUEUE, {
        connection: _connection,
        defaultJobOptions: {
            // attempts stays at BullMQ's default of 1 (no auto-retry). This
            // queue is shared by both job types (see HeavyJobName) and
            // defaultJobOptions applies to all of them uniformly — payroll's
            // computeRun is safely re-runnable (it's an explicit
            // delete-then-recompute, see payroll.service.ts), but form's
            // digitizeFromPhoto calls meterDigitize() -> usageService.
            // checkAndIncrement() before the Gemini call, which is NOT
            // idempotent: a retry would double-count the org's monthly
            // digitize quota for one logical request. Since neither
            // payroll.router.ts nor form.router.ts may be touched here to
            // set a per-job override, attempts must stay uniform — so no
            // retries rather than an unsafe one.
            //
            // removeOnComplete/removeOnFail default to `false` in BullMQ,
            // which keeps every job's data (including the base64 image
            // payload for digitize jobs) in Redis forever. Age-based
            // eviction here bounds that: the web client polls jobStatus
            // every 1.5s and stops polling as soon as it observes
            // completed/failed (see FormImportPage.tsx's refetchInterval),
            // so the real read window is under a couple seconds — 1h/1d
            // leave enormous headroom for slow clients, retries, or a
            // paused tab without risking eviction before the result is read.
            removeOnComplete: { age: 3600 }, // 1 hour
            removeOnFail: { age: 86400 }, // 1 day
        },
    });
    return _queue;
}
