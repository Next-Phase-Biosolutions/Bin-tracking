import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import type { CreateFacilityInput, UpdateFacilityInput, ListFacilitiesInput } from '@bin-tracker/validators';
import { handlePrismaError } from '../lib/errors.js';

export const facilityService = {
    async list(input: ListFacilitiesInput, facilityIds: string[], userRole: string) {
        const facilityFilter = userRole === 'ADMIN' ? {} : { id: { in: facilityIds } };

        const where = {
            deletedAt: null,
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

    async getById(id: string, userId: string, userRole: string) {
        const facility = await prisma.facility.findUnique({
            where: { id },
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

    async create(input: CreateFacilityInput) {
        try {
            return await prisma.facility.create({ data: input });
        } catch (error) {
            handlePrismaError(error);
        }
    },

    async update(input: UpdateFacilityInput, userId: string, userRole: string) {
        const { id, ...data } = input;

        const existing = await prisma.facility.findUnique({ where: { id } });
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
    async remove(id: string, userId: string, userRole: string) {
        const existing = await prisma.facility.findUnique({ where: { id } });
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
