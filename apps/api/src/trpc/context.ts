import type { FastifyRequest } from 'fastify';
import { prisma } from '@bin-tracker/db';
import type { User, Station, UserRole } from '@prisma/client';
import { verifySupabaseToken } from '../lib/jwt.js';
import { isAuthDisabled } from '../lib/auth-flags.js';
import { resolveOrgId } from './org-context.js';

export interface Context {
    prisma: typeof prisma;
    user: User | null;
    station: (Station & { facility: { id: string; name: string } }) | null;
    orgId: string | null;
    /**
     * The caller's ORG-SCOPED role in `orgId` — their OrganizationMember.role,
     * resolved by the same query as orgId (see org-context.ts). NOT the
     * global `user.role`; those can differ (Task 25). `null` whenever orgId
     * is station-resolved (no ctx.user) or unresolved, exactly like orgId
     * itself follows `user`/`station` resolution.
     */
    orgRole: UserRole | null;
    /**
     * The Supabase JWT's own claims, set whenever `verifySupabaseToken`
     * succeeds — regardless of whether a local `User` row exists yet. Needed
     * for `verifiedProcedure` (trpc.ts): a brand-new signup has a valid JWT
     * but no `User` row, so `user` alone can't gate access to `auth.bootstrap`
     * (Task 18) or invitation-accept (Task 19). Every other procedure keeps
     * using `user`/`orgId` exactly as before — this field is purely additive.
     */
    jwtPayload: { sub: string; email?: string } | null;
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
    if (isAuthDisabled()) {
        try {
            // Inject the first ADMIN user as the acting user
            user = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
            // Inject the first available station for tablet endpoints
            station = await prisma.station.findFirst({
                include: { facility: { select: { id: true, name: true } } },
            });
        } catch {
            // DB unreachable in dev — proceed with null user/station.
            // stationProcedure and protectedProcedure will still pass
            // because DISABLE_AUTH=true bypasses the null checks in their middleware.
        }
        const { orgId: bypassOrgId, orgRole: bypassOrgRole } = await resolveOrgId(prisma, {
            userId: user?.id ?? null,
            facilityId: station?.facility.id ?? null,
        });
        // Enrich this request's pino logger so every subsequent log line
        // (including Fastify's own request-completion log) carries orgId —
        // per-tenant log filtering without threading orgId through every call site.
        if (bypassOrgId) req.log = req.log.child({ orgId: bypassOrgId });
        return { prisma, user, station, orgId: bypassOrgId, orgRole: bypassOrgRole, jwtPayload: null, req };
    }
    // ─────────────────────────────────────────────────────────────────────────

    const authHeader = req.headers.authorization;
    let jwtPayload: { sub: string; email?: string } | null = null;

    if (authHeader?.startsWith('Bearer ')) {
        // JWT auth — verify Supabase token
        const token = authHeader.slice(7);

        const payload = await verifySupabaseToken(token);

        if (payload?.sub) {
            // Set regardless of whether a local User row exists yet — see
            // the jwtPayload doc comment on Context.
            jwtPayload = { sub: payload.sub, email: payload.email };

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
                include: { facility: { select: { id: true, name: true } } },
            });
            if (station?.revokedAt) station = null; // revoked tokens are dead tokens
        }
    }

    const { orgId, orgRole } = await resolveOrgId(prisma, {
        userId: user?.id ?? null,
        facilityId: station?.facility.id ?? null,
    });

    // See the bypass branch above — same log enrichment for the real-auth path.
    if (orgId) req.log = req.log.child({ orgId });

    return {
        prisma,
        user,
        station,
        orgId,
        orgRole,
        jwtPayload,
        req,
    };
}
