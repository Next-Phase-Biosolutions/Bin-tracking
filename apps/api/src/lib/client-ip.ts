import type { FastifyRequest } from 'fastify';

/**
 * The address a request should be rate-limited by.
 *
 * Behind Netlify and Caddy, `req.ip` is the PROXY's address for every client, so
 * a per-IP limiter degenerates into one bucket shared by the whole company (and
 * by any attacker). CLIENT_IP_HEADER names a header the edge sets to the real
 * client address (Netlify: `x-nf-client-connection-ip`) and makes the limiters
 * use it instead.
 *
 * Leave it UNSET until you have confirmed, on the real deployment, that the edge
 * overwrites that header and Caddy passes it through. If the API can also be
 * reached directly (api.nextphasebiosolutions.com is public), a caller can send
 * the header themselves and pick their own bucket, which defeats the limit for
 * that caller. That is the price of any header-based client IP without a locked
 * down proxy chain, and why it is opt-in.
 */
export function clientIp(req: Pick<FastifyRequest, 'ip' | 'headers'>): string {
    const headerName = process.env['CLIENT_IP_HEADER']?.trim().toLowerCase();
    if (headerName) {
        const raw = req.headers[headerName];
        const value = (Array.isArray(raw) ? raw[0] : raw)?.split(',')[0]?.trim();
        if (value && value.length <= 64) return value;
    }
    return req.ip;
}
