import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { SlidingWindowLimiter, aiRateLimit, consumeTapBudget } from './rate-limit.js';

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

    it('does not grow forever under a flood of distinct keys: expired keys are swept', () => {
        const limiter = new SlidingWindowLimiter(5, 60_000);
        const tracked = () => (limiter as unknown as { hits: Map<string, number[]> }).hits.size;

        for (let i = 0; i < 10_001; i++) limiter.tryConsume(`key-${i}`);
        expect(tracked()).toBe(10_001);

        vi.advanceTimersByTime(61_000); // every key above has left its window
        limiter.tryConsume('fresh'); // the sweep runs on the next hit
        expect(tracked()).toBe(1);
    });

    it('sweeping never forgets a key that is still inside its window', () => {
        const limiter = new SlidingWindowLimiter(1, 60_000);
        for (let i = 0; i < 10_001; i++) limiter.tryConsume(`old-${i}`);
        vi.advanceTimersByTime(30_000);
        limiter.tryConsume('recent'); // still counts after a sweep that removes nothing yet
        vi.advanceTimersByTime(31_000); // 'old-*' expired, 'recent' not
        limiter.tryConsume('trigger'); // triggers the sweep

        expect(limiter.tryConsume('recent')).toBe(false);
    });
});

describe('consumeTapBudget', () => {
    it('allows 30 taps a minute per registered phone, then answers with a retryable 429', () => {
        const limiter = new SlidingWindowLimiter(30, 60_000);
        for (let i = 0; i < 30; i++) expect(() => consumeTapBudget('session-1', limiter)).not.toThrow();

        expect(() => consumeTapBudget('session-1', limiter)).toThrowError(expect.objectContaining({ appCode: 'TOO_MANY_TAPS', code: 'TOO_MANY_REQUESTS' }));
        expect(() => consumeTapBudget('session-2', limiter)).not.toThrow(); // another phone is unaffected
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
