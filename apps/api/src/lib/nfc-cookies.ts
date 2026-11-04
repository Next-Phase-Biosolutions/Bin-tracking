import type { FastifyReply, FastifyRequest } from 'fastify';
// Pulls in @fastify/cookie's type augmentation (req.cookies, reply.setCookie). Needed here
// because apps/web type-checks the API's AppRouter by importing source and never reaches server.ts.
import type {} from '@fastify/cookie';
import { AppError } from './app-error.js';

/**
 * Cookies for the no-login phone flow. They are NOT user authentication:
 * the device cookie remembers a registered phone (its SHA-256 is a
 * DeviceSession row), and the pending cookie marks a browser as
 * "mid-registration" for a few minutes. Neither is readable by page script.
 */
export const DEVICE_COOKIE = 'bt_device';
export const PENDING_COOKIE = 'bt_pending_reg';

export const DEVICE_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365; // ~1 year: a session cookie would force re-registration on every browser close
export const PENDING_COOKIE_MAX_AGE_S = 10 * 60;

/**
 * Always Secure, except for plain-http local development (COOKIE_SECURE=false).
 * The override is ignored in production so it cannot be left on by accident.
 */
function secure(): boolean {
    return process.env['NODE_ENV'] === 'production' || process.env['COOKIE_SECURE'] !== 'false';
}

function options(maxAge: number) {
    // SameSite=Lax: the phone pages reach the API same-origin (Netlify /trpc
    // rewrite, Vite proxy in dev), so nothing stricter or looser is needed.
    return { httpOnly: true, secure: secure(), sameSite: 'lax' as const, path: '/', maxAge };
}

export const deviceCookieOptions = () => options(DEVICE_COOKIE_MAX_AGE_S);
export const pendingCookieOptions = () => options(PENDING_COOKIE_MAX_AGE_S);

export function readCookie(req: FastifyRequest, name: string): string | undefined {
    return req.cookies?.[name];
}

export function setCookie(res: FastifyReply | undefined, name: string, value: string, opts: ReturnType<typeof options>): void {
    if (!res) throw new Error('setCookie called without a reply object in the tRPC context');
    void res.setCookie(name, value, opts);
}

export function clearCookie(res: FastifyReply | undefined, name: string): void {
    if (!res) throw new Error('clearCookie called without a reply object in the tRPC context');
    void res.clearCookie(name, { path: '/' });
}

/** Origins allowed to make cookie-authenticated calls: the web app (APP_URL) and CORS_ORIGIN. */
function trustedOrigins(): Set<string> {
    const origins = new Set<string>();
    for (const value of [process.env['APP_URL'] ?? 'http://localhost:3000', process.env['CORS_ORIGIN']]) {
        if (!value) continue;
        try {
            origins.add(new URL(value).origin);
        } catch {
            // an unparsable env value simply contributes no origin
        }
    }
    return origins;
}

/**
 * Defence in depth on top of SameSite=Lax and the JSON content type: a
 * cookie-authenticated call that carries an Origin header must come from our
 * own web app. A request with no Origin header (same-origin GET, non-browser
 * client) is left to the cookie itself.
 */
export function assertTrustedOrigin(req: FastifyRequest): void {
    const origin = req.headers.origin;
    if (origin && !trustedOrigins().has(origin)) {
        throw new AppError('BAD_ORIGIN', 'FORBIDDEN');
    }
}
