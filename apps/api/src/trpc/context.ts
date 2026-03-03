import type { FastifyRequest } from 'fastify';
import { prisma } from '@bin-tracker/db';
import type { User, Station } from '@prisma/client';
import { verifySupabaseToken } from '../lib/jwt.js';

export interface Context {
    prisma: typeof prisma;
    user: User | null;
    station: (Station & { facility: { id: string; name: string } }) | null;
    req: FastifyRequest;
}

/**
 * Create tRPC context from Fastify request.
 * Auth is resolved here — routers get pre-resolved user/station.
 */
export async function createContext(req: FastifyRequest): Promise<Context> {
    let user: User | null = null;
    let station: (Station & { facility: { id: string; name: string } }) | null = null;

    // ─── AUTH BYPASS (DISABLE_AUTH=true) ─────────────────────────────────────
    // Set DISABLE_AUTH=true in your environment to skip all token checks.
    // This is useful for demos / development. Remove or set to false to re-enable.
    if (process.env['DISABLE_AUTH'] === 'true') {
        // Inject the first ADMIN user as the acting user
        user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
        // Inject the first available station for tablet endpoints
        station = await prisma.station.findFirst({
            include: { facility: { select: { id: true, name: true } } },
        });
        return { prisma, user, station, req };
    }
    // ─────────────────────────────────────────────────────────────────────────

    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
        // JWT auth — verify Supabase token
        const token = authHeader.slice(7);

        const payload = await verifySupabaseToken(token);

        if (payload?.sub) {
            // Look up user in our database by Supabase user ID
            user = await prisma.user.findUnique({
                where: { id: payload.sub },
            });

            if (!user) {
                req.log.warn({ userId: payload.sub }, 'Valid JWT but user not in database');
            }
        } else {
            req.log.warn('Invalid or expired JWT token');
        }
    } else if (authHeader?.startsWith('Station ')) {
        // Station token auth — resolve station
        const token = authHeader.slice(8);
        if (token) {
            station = await prisma.station.findUnique({
                where: { token },
                include: {
                    facility: { select: { id: true, name: true } },
                },
            });
        }
    }

    return {
        prisma,
        user,
        station,
        req,
    };
}
