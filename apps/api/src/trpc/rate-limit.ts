import { TRPCError } from '@trpc/server';
import { middleware } from './trpc.js';

/**
 * In-memory sliding-window limiter. Single-process only — the existing
 * global @fastify/rate-limit plugin in server.ts has no distributed backing
 * either, and a Redis-backed limiter is out of scope for this batch (see
 * lib/queue.ts's REDIS_URL story for the same boot-safety reasoning). Fine
 * for guarding bursts on a single API instance; revisit with a Redis store
 * if the API ever runs multiple instances behind a load balancer.
 */
export class SlidingWindowLimiter {
    // ponytail: unbounded Map growth across distinct keys over process
    // lifetime — acceptable given the small, slow-growing set of orgIds;
    // add eviction if this ever shows up in memory profiling.
    private readonly hits = new Map<string, number[]>();

    constructor(
        private readonly limit: number,
        private readonly windowMs: number,
    ) {}

    /** Returns true and records a hit if `key` is under its limit, false otherwise. */
    tryConsume(key: string): boolean {
        const now = Date.now();
        const cutoff = now - this.windowMs;
        const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
        if (recent.length >= this.limit) {
            this.hits.set(key, recent);
            return false;
        }
        recent.push(now);
        this.hits.set(key, recent);
        return true;
    }
}

/**
 * Shared across digitizeFromPhoto and refineFromRegion — both burn the same
 * Gemini quota/cost budget, so they share one per-org bucket rather than
 * each getting their own 10/min allowance. 10 calls/minute per org is a
 * generous ceiling for a human reviewing/correcting one form at a time;
 * adjust if real usage patterns disagree.
 */
const AI_CALLS_PER_MINUTE = 10;
const AI_WINDOW_MS = 60_000;
const aiDigitizeLimiter = new SlidingWindowLimiter(AI_CALLS_PER_MINUTE, AI_WINDOW_MS);

/**
 * Per-org AI call rate limit, keyed on ctx.orgId rather than IP. The global
 * @fastify/rate-limit plugin (server.ts) limits per-IP — that both
 * under-throttles a single org hammering the AI endpoints from many
 * users/devices, and over-throttles unrelated tenants that happen to share
 * an egress IP (shared NAT/VPN). Must run after a middleware that guarantees
 * ctx.orgId is set (e.g. requireModule / hasOrg) — those already run first
 * on every call site this is used from.
 *
 * `limiter` is injectable for tests; production call sites use the default
 * shared instance so all AI-gated procedures draw from the same budget.
 */
export function aiRateLimit(limiter: SlidingWindowLimiter = aiDigitizeLimiter) {
    return middleware(async ({ ctx, next }) => {
        if (!ctx.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization' });
        if (!limiter.tryConsume(ctx.orgId)) {
            throw new TRPCError({
                code: 'TOO_MANY_REQUESTS',
                message: 'AI digitize rate limit reached for your organization. Try again in a minute.',
            });
        }
        return next({ ctx: { ...ctx, orgId: ctx.orgId } });
    });
}

/**
 * Per-org cap on invitation emails. invitation.create sends real email to an
 * arbitrary address — without a cap, one compromised/hostile org admin can
 * burn the Resend quota and get the sending domain flagged as spam, which
 * hurts every tenant. 20/day is far above any legitimate team-building burst;
 * the global per-IP limiter doesn't help here (one admin, one IP, unlimited
 * distinct recipients).
 */
const INVITES_PER_DAY = 20;
const INVITE_WINDOW_MS = 24 * 60 * 60 * 1000;
const inviteLimiter = new SlidingWindowLimiter(INVITES_PER_DAY, INVITE_WINDOW_MS);

export function inviteRateLimit(limiter: SlidingWindowLimiter = inviteLimiter) {
    return middleware(async ({ ctx, next }) => {
        if (!ctx.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization' });
        if (!limiter.tryConsume(ctx.orgId)) {
            throw new TRPCError({
                code: 'TOO_MANY_REQUESTS',
                message: 'Invitation limit reached for your organization. Try again tomorrow.',
            });
        }
        return next({ ctx: { ...ctx, orgId: ctx.orgId } });
    });
}
