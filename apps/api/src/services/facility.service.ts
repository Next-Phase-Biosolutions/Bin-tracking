import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import { PLAN_LIMITS } from '@bin-tracker/types';
import type { CreateFacilityInput, UpdateFacilityInput, ListFacilitiesInput, CreateStationInput } from '@bin-tracker/validators';
import { handlePrismaError } from '../lib/errors.js';
import { hashToken } from '../lib/token.js';

function generateStationToken(): string {
    return `STN-${randomUUID()}`;
}

function isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002';
}

export const facilityService = {
    async list(orgId: string, input: ListFacilitiesInput, facilityIds: string[], userRole: string) {
        const facilityFilter = userRole === 'ADMIN' ? {} : { id: { in: facilityIds } };

        const where = {
            deletedAt: null,
            organizationId: orgId,
            ...(input.type && { type: input.type }),
            ...facilityFilter,
        };

        const [items, totalCount] = await Promise.all([
            prisma.facility.findMany({
                where,
                include: { stations: { select: { id: true, label: true } } },
                take: input.limit + 1,
                ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
                orderBy: { name: 'asc' },
            }),
            prisma.facility.count({ where }),
        ]);

        const hasMore = items.length > input.limit;
        if (hasMore) items.pop();

        return {
            items,
            nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
            totalCount,
        };
    },

    async getById(orgId: string, id: string, userId: string, userRole: string) {
        const facility = await prisma.facility.findFirst({
            where: { id, organizationId: orgId },
            include: {
                stations: { select: { id: true, label: true } },
                _count: { select: { bins: true, cycles: true } },
            },
        });

        if (!facility || facility.deletedAt) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Facility not found' });
        }

        if (userRole !== 'ADMIN') {
            const hasAccess = await prisma.userFacility.findUnique({
                where: { userId_facilityId: { userId, facilityId: id } },
            });
            if (!hasAccess) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this facility' });
            }
        }

        return facility;
    },

    async create(orgId: string, input: CreateFacilityInput) {
        // Every org gets a Subscription row at provisioning time (org-provision.ts),
        // so this should always resolve — if it's ever missing, skip the quantity
        // check rather than block facility creation on an unrelated invariant break.
        const subscription = await prisma.subscription.findUnique({ where: { orgId } });
        const maxFacilities = subscription ? PLAN_LIMITS[subscription.plan].maxFacilities : -1;
        if (maxFacilities !== -1) {
            const count = await prisma.facility.count({ where: { organizationId: orgId, deletedAt: null } });
            if (count >= maxFacilities) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: `Your plan allows up to ${maxFacilities} facilities. Upgrade your plan to add more.`,
                });
            }
        }

        try {
            return await prisma.facility.create({ data: { ...input, organizationId: orgId } });
        } catch (error) {
            handlePrismaError(error);
        }
    },

    async update(orgId: string, input: UpdateFacilityInput, userId: string, userRole: string) {
        const { id, ...data } = input;

        const existing = await prisma.facility.findFirst({ where: { id, organizationId: orgId } });
        if (!existing || existing.deletedAt) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Facility not found' });
        }

        if (userRole !== 'ADMIN') {
            const hasAccess = await prisma.userFacility.findUnique({
                where: { userId_facilityId: { userId, facilityId: id } },
            });
            if (!hasAccess) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this facility' });
            }
        }

        try {
            return await prisma.facility.update({ where: { id }, data });
        } catch (error) {
            handlePrismaError(error);
        }
    },

    /**
     * Provisions a Station (tablet) token for a facility — used by the
     * onboarding wizard (Task 18) to show a QR code for tablet setup.
     * Verifies the facility belongs to `orgId` first: a facilityId is
     * client-supplied input, so this must never trust it as already
     * org-scoped, the same discipline as getById/update/remove above.
     */
    async createStation(orgId: string, input: CreateStationInput) {
        const facility = await prisma.facility.findFirst({ where: { id: input.facilityId, organizationId: orgId } });
        if (!facility || facility.deletedAt) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Facility not found' });
        }

        const MAX_ATTEMPTS = 5;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            try {
                // Stored hashed at rest (lib/token.ts); the raw token is
                // returned exactly once here for the setup QR code and is
                // not recoverable afterwards.
                const rawToken = generateStationToken();
                const station = await prisma.station.create({
                    data: {
                        facilityId: input.facilityId,
                        token: hashToken(rawToken),
                        label: input.label ?? 'Tablet',
                    },
                });
                return { ...station, token: rawToken };
            } catch (error: unknown) {
                // P2002 = unique collision on token (astronomically unlikely
                // with a UUID) — retry with a freshly generated token.
                if (isUniqueConstraintError(error) && attempt < MAX_ATTEMPTS - 1) continue;
                handlePrismaError(error);
            }
        }

        throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Could not generate a unique station token. Please retry.',
        });
    },

    /** Soft delete — sets deletedAt timestamp */
    async remove(orgId: string, id: string, userId: string, userRole: string) {
        const existing = await prisma.facility.findFirst({ where: { id, organizationId: orgId } });
        if (!existing || existing.deletedAt) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Facility not found' });
        }

        if (userRole !== 'ADMIN') {
            const hasAccess = await prisma.userFacility.findUnique({
                where: { userId_facilityId: { userId, facilityId: id } },
            });
            if (!hasAccess) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this facility' });
            }
        }

        return prisma.facility.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    },
};
