import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// getHeavyJobsQueue() constructs a real bullmq Queue + ioredis connection as
// a side effect — mock both so this test never touches a real Redis
// instance, and capture what Queue was constructed with.
const capturedQueueArgs: unknown[] = [];
vi.mock('bullmq', () => ({
    Queue: class {
        constructor(...args: unknown[]) {
            capturedQueueArgs.push(args);
        }
    },
}));

vi.mock('ioredis', () => ({
    default: class {
        constructor() {
            // no-op fake connection
        }
    },
}));

const ORIGINAL_REDIS_URL = process.env['REDIS_URL'];

beforeEach(() => {
    process.env['REDIS_URL'] = 'redis://localhost:6379';
    capturedQueueArgs.length = 0;
});

afterEach(() => {
    if (ORIGINAL_REDIS_URL === undefined) delete process.env['REDIS_URL'];
    else process.env['REDIS_URL'] = ORIGINAL_REDIS_URL;
});

describe('getHeavyJobsQueue', () => {
    it('constructs the heavy-jobs Queue with a bounded retention window and no auto-retry', async () => {
        vi.resetModules();
        const modulePath = './queue.js' + '?case=default-options';
        const { getHeavyJobsQueue, HEAVY_JOBS_QUEUE } = await import(modulePath);

        getHeavyJobsQueue();

        expect(capturedQueueArgs).toHaveLength(1);
        const [name, options] = capturedQueueArgs[0] as [string, { defaultJobOptions?: unknown }];
        expect(name).toBe(HEAVY_JOBS_QUEUE);
        expect(options.defaultJobOptions).toEqual({
            removeOnComplete: { age: 3600 },
            removeOnFail: { age: 86400 },
        });
    });
});
