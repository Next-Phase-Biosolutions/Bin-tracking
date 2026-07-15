import { TRPCError } from '@trpc/server';
import { middleware } from './trpc.js';
import type { UserRole } from '@prisma/client';
import { isAuthDisabled } from '../lib/auth-flags.js';

/**
 * Role-based access control middleware
 * Ensures the authenticated user has one of the specified roles
 *
 * GLOBAL-ROLE ONLY, NOT ORG-AWARE (Task 25): this checks `ctx.user.role`,
 * the single account-wide role on User — it has no idea which organization
 * the request is acting on, so a user's role in one org (or no org at all)
 * is indistinguishable from their role in any other. It backs
 * adminProcedure/opsManagerProcedure/driverProcedure below, none of which
 * are currently wired into any org-scoped router. Do NOT use this (or those
 * procedures) to gate access to anything org-scoped — use `requireOrgRole`
 * and the `org*Procedure` variants instead, which check the caller's
 * per-membership OrganizationMember.role.
 */
export function requireRole(...allowedRoles: UserRole[]) {
    return middleware(async ({ ctx, next }) => {
        if (isAuthDisabled()) return next({ ctx });
        if (!ctx.user) {
            throw new TRPCError({
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
            });
        }

        if (!allowedRoles.includes(ctx.user.role)) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
            });
        }

        return next({ ctx: { ...ctx, user: ctx.user } });
    });
}

/**
 * Org-scoped role-based access control middleware (Task 25). Checks the
 * caller's MEMBERSHIP role in the resolved organization (`ctx.orgRole`),
 * never the global `ctx.user.role` — a user's global role and their role
 * within any specific org can legitimately differ (e.g. an existing account
 * with global ADMIN from having signed up before, invited into a different
 * org as DRIVER: only `ctx.orgRole` reflects what that org's admin actually
 * granted them). Backs `orgAdminProcedure`/`orgOpsProcedure` — use these for
 * any org-scoped authorization decision instead of the global-role variants.
 */
export function requireOrgRole(...allowedRoles: UserRole[]) {
    return middleware(async ({ ctx, next }) => {
        if (isAuthDisabled()) return next({ ctx });
        if (!ctx.orgRole || !allowedRoles.includes(ctx.orgRole)) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
            });
        }

        return next({ ctx: { ...ctx, orgRole: ctx.orgRole } });
    });
}

/**
 * Facility access middleware
 * Ensures user is authenticated. Specific facility checks are enforced in the service layer.
 *
 * GLOBAL-ROLE ONLY, NOT ORG-AWARE (Task 25): backs `facilityProcedure`,
 * which is not currently wired into any router. See the note on
 * `requireRole` above — do not use for org-scoped resources.
 */
export function requireFacilityAccess() {
    return middleware(async ({ ctx, next }) => {
        if (isAuthDisabled()) return next({ ctx });
        if (!ctx.user) {
            throw new TRPCError({
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
            });
        }

        return next({ ctx: { ...ctx, user: ctx.user } });
    });
}

/**
 * Driver assignment middleware
 * Ensures the user has the DRIVER or ADMIN role.
 * The specific per-cycle driver assignment check is enforced in the service layer.
 */
export function requireAssignedDriver() {
    return middleware(async ({ ctx, next }) => {
        if (isAuthDisabled()) return next({ ctx });
        if (!ctx.user) {
            throw new TRPCError({
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
            });
        }

        if (ctx.user.role !== 'DRIVER' && ctx.user.role !== 'ADMIN') {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'Only drivers can perform this action',
            });
        }

        return next({ ctx: { ...ctx, user: ctx.user } });
    });
}

/**
 * Check if user can access a specific bin (via facility ownership)
 */
export async function userCanAccessBin(
    userId: string,
    binId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma: any,
    userRole: UserRole,
): Promise<boolean> {
    // ADMIN always has access
    if (userRole === 'ADMIN') {
        return true;
    }

    // Get bin's facility
    const bin = await prisma.bin.findUnique({
        where: { id: binId },
        select: { currentFacilityId: true },
    });

    if (!bin) {
        return false;
    }

    // Check user-facility relationship
    const userFacility = await prisma.userFacility.findUnique({
        where: {
            userId_facilityId: {
                userId,
                facilityId: bin.currentFacilityId,
            },
        },
    });

    return !!userFacility;
}

/**
 * Get list of facility IDs user has access to
 * ADMIN users get all facilities in their org, other roles get their assigned facilities
 */
export async function getUserFacilityIds(
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma: any,
    userRole: UserRole,
    orgId: string,
): Promise<string[]> {
    // ADMIN has access to all facilities in their org
    if (userRole === 'ADMIN') {
        const facilities = await prisma.facility.findMany({
            where: { deletedAt: null, organizationId: orgId },
            select: { id: true },
        });
        return facilities.map((f: { id: string }) => f.id);
    }

    // Other roles: get assigned facilities
    const userFacilities = await prisma.userFacility.findMany({
        where: { userId },
        select: { facilityId: true },
    });

    return userFacilities.map((uf: { facilityId: string }) => uf.facilityId);
}
