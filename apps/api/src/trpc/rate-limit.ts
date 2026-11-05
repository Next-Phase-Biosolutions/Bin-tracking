import { TRPCError } from '@trpc/server';
import { middleware } from './trpc.js';
import { AppError } from '../lib/app-error.js';
import { clientIp } from '../lib/client-ip.js';

/**
 * In-memory sliding-window limiter. Single-process only — the existing
 * global @fastify/rate-limit plugin in server.ts has no distributed backing
 * either, and a Redis-backed limiter is out of scope for this batch (see
 * lib/queue.ts's REDIS_URL story for the same boot-safety reasoning). Fine
 * for guarding bursts on a single API instance; revisit with a Redis store
 * if the API ever runs multiple instances behind a load balancer.
 */
/** Above this many tracked keys, expired ones are swept (at most once per SWEEP_INTERVAL_MS). */
const MAX_TRACKED_KEYS = 10_000;
const SWEEP_INTERVAL_MS = 5_000;
/**
 * Hard ceiling. A flood of distinct, un-expired keys (possible when the key comes from a header
 * the caller controls, see lib/client-ip.ts) cannot grow the map past this: the OLDEST key is
 * dropped, which only ever makes the limiter more lenient to whoever was evicted, never unbounded.
 */
const HARD_CAP_KEYS = 50_000;

export class SlidingWindowLimiter {
    // ponytail: unbounded Map growth across distinct keys over process
    // lifetime — acceptable given the small, slow-growing set of orgIds;
    // add eviction if this ever shows up in memory profiling.
    private readonly hits = new Map<string, number[]>();
    private lastSweepAt = 0;

    constructor(
        private readonly limit: number,
        private readonly windowMs: number,
    ) {}

    /** Returns true and records a hit if `key` is under its limit, false otherwise. */
    tryConsume(key: string): boolean {
        const now = Date.now();
        const cutoff = now - this.windowMs;
        if (this.hits.size > MAX_TRACKED_KEYS && now - this.lastSweepAt >= SWEEP_INTERVAL_MS) {
            this.lastSweepAt = now;
            this.evictExpired(cutoff);
        }
        const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
        if (recent.length >= this.limit) {
            this.hits.set(key, recent);
            return false;
        }
        recent.push(now);
        if (!this.hits.has(key) && this.hits.size >= HARD_CAP_KEYS) {
            const oldest = this.hits.keys().next().value;
            if (oldest !== undefined) this.hits.delete(oldest);
        }
        this.hits.set(key, recent);
        return true;
    }

    /** Drops keys whose newest hit has left the window, so a flood of distinct keys cannot grow the map forever. */
    private evictExpired(cutoff: number): void {
        for (const [key, times] of this.hits) {
            if ((times[times.length - 1] ?? 0) <= cutoff) this.hits.delete(key);
        }
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

/**
 * Per-org cap on bank-details request emails — same reasoning as
 * inviteRateLimit: a real email to a real address, so an unbounded loop burns
 * the Resend quota and the sending domain's reputation for every tenant.
 */
const BANK_LINKS_PER_DAY = 20;
const BANK_LINK_WINDOW_MS = 24 * 60 * 60 * 1000;
const bankLinkLimiter = new SlidingWindowLimiter(BANK_LINKS_PER_DAY, BANK_LINK_WINDOW_MS);

export function bankLinkRateLimit(limiter: SlidingWindowLimiter = bankLinkLimiter) {
    return middleware(async ({ ctx, next }) => {
        if (!ctx.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization' });
        if (!limiter.tryConsume(ctx.orgId)) {
            throw new TRPCError({
                code: 'TOO_MANY_REQUESTS',
                message: 'Bank details request limit reached for your organization. Try again tomorrow.',
            });
        }
        return next({ ctx: { ...ctx, orgId: ctx.orgId } });
    });
}

/**
 * Per-IP cap on the two UNAUTHENTICATED bank-link endpoints. These take a
 * token as their sole credential, so they're the one guessable surface in this
 * feature; the global @fastify/rate-limit plugin (100/min per IP) is far too
 * loose to be the only guard on that. Keyed on IP rather than org because
 * there is no org context until the token resolves — that's the whole point.
 *
 * A UUIDv4 is not realistically brute-forceable at any rate; this exists so an
 * attempt is cheap to spot and impossible to run quietly.
 */
const BANK_TOKEN_ATTEMPTS_PER_HOUR = 20;
const BANK_TOKEN_WINDOW_MS = 60 * 60 * 1000;
const bankTokenLimiter = new SlidingWindowLimiter(BANK_TOKEN_ATTEMPTS_PER_HOUR, BANK_TOKEN_WINDOW_MS);

export function bankTokenRateLimit(limiter: SlidingWindowLimiter = bankTokenLimiter) {
    return middleware(async ({ ctx, next }) => {
        // clientIp() is ctx.req.ip unless CLIENT_IP_HEADER is configured: behind
        // Netlify/Caddy req.ip is the proxy's address (see lib/client-ip.ts).
        const key = clientIp(ctx.req);
        if (!limiter.tryConsume(key)) {
            throw new TRPCError({
                code: 'TOO_MANY_REQUESTS',
                message: 'Too many attempts. Try again later.',
            });
        }
        return next();
    });
}

/**
 * Registration links: the 256-bit single-use token is the real protection, so
 * this only bounds cheap lookups. It must also be roomy: employees open their
 * links in a burst on the first day, often behind one proxy address (see
 * lib/client-ip.ts), and a tight shared cap would lock a whole company out.
 */
const REGISTRATION_STARTS_PER_HOUR = Number.isInteger(Number(process.env['REGISTRATION_STARTS_PER_HOUR'])) && Number(process.env['REGISTRATION_STARTS_PER_HOUR']) > 0 ? Number(process.env['REGISTRATION_STARTS_PER_HOUR']) : 1000;
const registrationStartLimiter = new SlidingWindowLimiter(REGISTRATION_STARTS_PER_HOUR, BANK_TOKEN_WINDOW_MS);
export const registrationStartRateLimit = () => bankTokenRateLimit(registrationStartLimiter);

/**
 * NFC taps are limited per registered phone, keyed on its DeviceSession id and
 * consumed only AFTER the cookie has been validated. Keying on the raw cookie
 * (or on IP) would let an anonymous caller mint endless keys or share one bucket
 * across a whole shift change. Garbage cookies never get here: they are refused
 * by the lookup and bounded by the global limiter.
 */
const TAPS_PER_MINUTE = 30;
const tapLimiter = new SlidingWindowLimiter(TAPS_PER_MINUTE, 60 * 1000);

/** Throws a retryable 429 when one phone taps too often. Nothing has been recorded at that point. */
export function consumeTapBudget(deviceSessionId: string, limiter: SlidingWindowLimiter = tapLimiter): void {
    if (!limiter.tryConsume(deviceSessionId)) {
        throw new AppError('TOO_MANY_TAPS', 'TOO_MANY_REQUESTS', 'Too many taps. Wait a moment and tap again.');
    }
}
