import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { SlidingWindowLimiter, aiRateLimit } from './rate-limit.js';

describe('SlidingWindowLimiter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-15T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows calls up to the limit, then throttles the next one', () => {
        const limiter = new SlidingWindowLimiter(3, 60_000);

        expect(limiter.tryConsume('org-a')).toBe(true);
        expect(limiter.tryConsume('org-a')).toBe(true);
        expect(limiter.tryConsume('org-a')).toBe(true);
        expect(limiter.tryConsume('org-a')).toBe(false);
    });

    it('resets once the oldest hit falls outside the window', () => {
        const limiter = new SlidingWindowLimiter(2, 60_000);

        expect(limiter.tryConsume('org-a')).toBe(true);
        vi.advanceTimersByTime(30_000);
        expect(limiter.tryConsume('org-a')).toBe(true);
        // Both hits are within the last 60s — a 3rd call is throttled.
        expect(limiter.tryConsume('org-a')).toBe(false);

        // Advance past the first hit's window (30s + 31s = 61s since it fired),
        // but the second hit (fired at 30s) is still only 31s old, still
        // inside the window — a true sliding window, not a fixed bucket reset.
        vi.advanceTimersByTime(31_000);
        expect(limiter.tryConsume('org-a')).toBe(true);
    });

    it('keeps separate buckets per key', () => {
        const limiter = new SlidingWindowLimiter(1, 60_000);

        expect(limiter.tryConsume('org-a')).toBe(true);
        expect(limiter.tryConsume('org-a')).toBe(false);
        expect(limiter.tryConsume('org-b')).toBe(true);
    });
});

// Same extraction pattern as trpc/require-module.test.ts — aiRateLimit()
// returns a tRPC middleware builder; its actual handler lives at
// `_middlewares[0]`.
function getMiddlewareFn(builder: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (builder as any)._middlewares[0];
}

describe('aiRateLimit middleware', () => {
    it('lets calls through under the limit and throws TOO_MANY_REQUESTS once exhausted', async () => {
        const limiter = new SlidingWindowLimiter(2, 60_000);
        const fn = getMiddlewareFn(aiRateLimit(limiter));
        const next = vi.fn().mockResolvedValue('ok');
        const ctx = { orgId: 'org-a' };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await fn({ ctx, next } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await fn({ ctx, next } as any);
        expect(next).toHaveBeenCalledTimes(2);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(fn({ ctx, next } as any)).rejects.toThrow(TRPCError);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(fn({ ctx, next } as any)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
        expect(next).toHaveBeenCalledTimes(2);
    });

    it('throws FORBIDDEN instead of consuming a slot when ctx has no orgId', async () => {
        const limiter = new SlidingWindowLimiter(2, 60_000);
        const fn = getMiddlewareFn(aiRateLimit(limiter));
        const next = vi.fn().mockResolvedValue('ok');
        const ctx = { orgId: null };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(fn({ ctx, next } as any)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(next).not.toHaveBeenCalled();
    });
});
