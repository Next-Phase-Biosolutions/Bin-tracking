import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import { PLAN_LIMITS } from '@bin-tracker/types';
import type { CreateFacilityInput, UpdateFacilityInput, ListFacilitiesInput } from '@bin-tracker/validators';
import { handlePrismaError } from '../lib/errors.js';

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
