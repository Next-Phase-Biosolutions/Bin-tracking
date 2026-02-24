import { TRPCError } from '@trpc/server';
import { middleware } from './trpc.js';
import type { UserRole } from '@prisma/client';

/**
 * Role-based access control middleware
 * Ensures the authenticated user has one of the specified roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
    return middleware(async ({ ctx, next }) => {
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
 * Facility access middleware
 * Ensures user is authenticated. Specific facility checks are enforced in the service layer.
 */
export function requireFacilityAccess() {
    return middleware(async ({ ctx, next }) => {
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
 * ADMIN users get all facilities, other roles get their assigned facilities
 */
export async function getUserFacilityIds(
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma: any,
    userRole: UserRole,
): Promise<string[]> {
    // ADMIN has access to all facilities
    if (userRole === 'ADMIN') {
        const facilities = await prisma.facility.findMany({
            where: { deletedAt: null },
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
