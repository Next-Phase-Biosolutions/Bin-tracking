import type { FastifyRequest } from 'fastify';
import { clientIp } from './client-ip.js';

/**
 * Global per-IP request limits for the API.
 *
 * Employee phones reach the API through the web host's /trpc rewrite, so many of
 * them share one address (the proxy's, unless CLIENT_IP_HEADER is set). A single
 * 100-requests-a-minute bucket would therefore be one bucket for the whole company:
 * at a shift change the 101st employee is refused. The two procedures a phone calls
 * with no login (`attendance.tap`, `deviceRegistration.start`) get a bucket of their
 * own and a much larger ceiling. They are already limited where it matters: each tap
 * is capped per registered phone (consumeTapBudget), and registration links are
 * 256-bit single-use tokens. This global limit stays as the flood guard (a stream of
 * garbage cookies is still bounded), and everything else keeps the strict default.
 */
const PHONE_PROCEDURES: ReadonlySet<string> = new Set(['attendance.tap', 'deviceRegistration.start']);

const DEFAULT_MAX = 100;
const DEFAULT_PHONE_MAX = 3000;

const positiveInt = (raw: string | undefined, fallback: number): number => {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * True when the request calls ONLY the phone procedures. A batch that mixes in
 * anything else is not a phone request, so it cannot borrow the larger bucket.
 */
export function isPhoneRoute(url: string): boolean {
    let pathname: string;
    try {
        pathname = new URL(url, 'http://local').pathname;
    } catch {
        return false;
    }
    if (!pathname.startsWith('/trpc/')) return false;
    const procedures = pathname.slice('/trpc/'.length).split(',');
    return procedures.length > 0 && procedures.every((p) => PHONE_PROCEDURES.has(p));
}

/** The bucket a request counts against: its own namespace for phone routes, so they never eat the API's budget. */
export function rateLimitKey(req: Pick<FastifyRequest, 'ip' | 'headers' | 'url'>): string {
    const ip = clientIp(req);
    return isPhoneRoute(req.url) ? `phone:${ip}` : ip;
}

/** Requests per minute allowed for this request's bucket. */
export function rateLimitMax(req: Pick<FastifyRequest, 'url'>): number {
    return isPhoneRoute(req.url)
        ? positiveInt(process.env['NFC_RATE_LIMIT_MAX'], DEFAULT_PHONE_MAX)
        : positiveInt(process.env['RATE_LIMIT_MAX'], DEFAULT_MAX);
}

/** Options for @fastify/rate-limit, shared by the server and its tests. */
export function rateLimitOptions() {
    return {
        max: (req: FastifyRequest) => rateLimitMax(req),
        keyGenerator: (req: FastifyRequest) => rateLimitKey(req),
        timeWindow: '1 minute',
    };
}
