import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { ModuleKey } from '@bin-tracker/types';
import type { Context } from './context.js';
import { requireRole, requireFacilityAccess, requireAssignedDriver } from './middleware.js';
import { isAuthDisabled } from '../lib/auth-flags.js';

const t = initTRPC.context<Context>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            data: {
                ...shape.data,
                // Strip Prisma/internal details in production
                stack: process.env['NODE_ENV'] === 'development' ? error.stack : undefined,
            },
        };
    },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

/**
 * Protected procedure — requires authenticated user (JWT)
 */
const isAuthenticated = middleware(async ({ ctx, next }) => {
    // AUTH BYPASS: skip check entirely when DISABLE_AUTH=true
    if (isAuthDisabled()) {
        return next({ ctx });
    }
    if (!ctx.user) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
        });
    }
    return next({
        ctx: { ...ctx, user: ctx.user },
    });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);

/**
 * Verified procedure — requires a valid Supabase JWT (`ctx.jwtPayload`), but
 * NOT an existing local `User` row. Distinct from protectedProcedure, whose
 * `isAuthenticated` middleware throws unless `ctx.user` is already set — a
 * brand-new signup has a valid JWT but no `User` row yet, so a literal
 * protectedProcedure would 401 before its handler ever ran.
 *
 * Used by `auth.bootstrap` (Task 18), which creates the `User` row on first
 * call, and reusable as-is by Task 19's invitation-accept for the identical
 * reason.
 */
const isVerified = middleware(async ({ ctx, next }) => {
    // AUTH BYPASS: skip check entirely when DISABLE_AUTH=true
    if (isAuthDisabled()) {
        return next({ ctx });
    }
    if (!ctx.jwtPayload) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
        });
    }
    return next({
        ctx: { ...ctx, jwtPayload: ctx.jwtPayload },
    });
});

export const verifiedProcedure = t.procedure.use(isVerified);

/**
 * Station procedure — requires station token auth (tablets)
 */
const isStation = middleware(async ({ ctx, next }) => {
    // AUTH BYPASS: skip check entirely when DISABLE_AUTH=true
    if (isAuthDisabled()) {
        return next({ ctx });
    }
    if (!ctx.station) {
        throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Station authentication required',
        });
    }
    return next({
        ctx: { ...ctx, station: ctx.station },
    });
});

export const stationProcedure = t.procedure.use(isStation);

/**
 * Role-based procedures
 */
export const adminProcedure = t.procedure.use(requireRole('ADMIN'));
export const opsManagerProcedure = t.procedure.use(requireRole('ADMIN', 'OPS_MANAGER'));
export const driverProcedure = t.procedure.use(requireRole('ADMIN', 'DRIVER'));

/**
 * Facility-scoped procedure
 * Requires user to have access to the facility specified in the input
 */
export const facilityProcedure = t.procedure.use(isAuthenticated).use(requireFacilityAccess());

/**
 * Driver assignment procedure (for pickup/deliver)
 * Verifies the user is the assigned driver for the cycle
 */
export const assignedDriverProcedure = t.procedure.use(requireAssignedDriver());

/**
 * Organization-scoped procedures
 * Ensures the request resolved to a tenant (ctx.orgId) before proceeding.
 */
const hasOrg = middleware(async ({ ctx, next }) => {
    if (!ctx.orgId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization for this account' });
    }
    return next({ ctx: { ...ctx, orgId: ctx.orgId } });
});

export const orgProcedure = protectedProcedure.use(hasOrg);
export const orgAdminProcedure = t.procedure.use(requireRole('ADMIN')).use(hasOrg);
export const orgOpsProcedure = t.procedure.use(requireRole('ADMIN', 'OPS_MANAGER')).use(hasOrg);
export const stationOrgProcedure = stationProcedure.use(hasOrg);
export const orgAssignedDriverProcedure = assignedDriverProcedure.use(hasOrg);

/**
 * Platform-admin procedure — for the SaaS operator's internal tooling only
 * (e.g. Task 16's per-org module toggle panel). `isPlatformAdmin` is an
 * orthogonal, org-independent flag on `User`, deliberately separate from the
 * org-scoped `ADMIN` role: an org's ADMIN must never see or modify another
 * org's data, but the platform admin operates across all orgs. There is no
 * self-serve way to set this flag — it's set manually via psql/Prisma Studio.
 */
const isPlatformAdmin = middleware(async ({ ctx, next }) => {
    if (!ctx.user?.isPlatformAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform admin access required' });
    }
    return next({ ctx });
});
export const platformAdminProcedure = protectedProcedure.use(isPlatformAdmin);

/**
 * Module-gating middleware — denies access unless the calling org has an
 * enabled OrganizationModule row for the given module key. Reflects the
 * org's actual assigned modules (Task 12), not just its plan tier, so a
 * manually-granted module (Task 16) is honored exactly like a plan-default
 * one.
 */
export function requireModule(module: ModuleKey) {
    return middleware(async ({ ctx, next }) => {
        if (!ctx.orgId) throw new TRPCError({ code: 'FORBIDDEN', message: 'No organization' });
        const row = await ctx.prisma.organizationModule.findUnique({
            where: { orgId_module: { orgId: ctx.orgId, module } },
        });
        // No row = never provisioned for this org (shouldn't happen after Task 12's
        // provisioning/backfill) → deny, never default to enabled.
        if (!row?.enabled) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `This feature (${module}) is not enabled for your organization. Contact your account manager to enable it.`,
            });
        }
        // Rebuild (not just pass through) so ctx.orgId's non-null narrowing
        // survives into downstream procedures — same pattern as hasOrg below.
        return next({ ctx: { ...ctx, orgId: ctx.orgId } });
    });
}
