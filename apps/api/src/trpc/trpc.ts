import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
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
