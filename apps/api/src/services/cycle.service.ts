import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@bin-tracker/db';
import type { CyclePickupInput, CycleDeliverInput, CycleListInput, CycleHistoryInput } from '@bin-tracker/validators';
import { calculateCountdown } from '../lib/countdown.js';
import { calculateCompliance } from '../lib/compliance.js';
import { handlePrismaError } from '../lib/errors.js';

export const cycleService = {
    /**
     * Pickup (Scan 2 — Driver)
     * Transition: ACTIVE → IN_TRANSIT
     */
    async pickup(input: CyclePickupInput, userId: string, userRole: string) {
        try {
            return await prisma.$transaction(
                async (tx: Prisma.TransactionClient) => {
                    const cycle = await tx.binCycle.findUnique({
                        where: { id: input.cycleId },
                        include: {
                            bin: { include: { binType: true } },
                            facility: { select: { id: true } },
                        },
                    });

                    if (!cycle) {
                        throw new TRPCError({ code: 'NOT_FOUND', message: 'Cycle not found' });
                    }

                    if (cycle.status !== 'ACTIVE') {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: `Cannot pick up — cycle is ${cycle.status.toLowerCase()}, expected ACTIVE`,
                        });
                    }

                    // Verify facility access (unless ADMIN)
                    if (userRole !== 'ADMIN') {
                        const hasAccess = await tx.userFacility.findUnique({
                            where: {
                                userId_facilityId: {
                                    userId,
                                    facilityId: cycle.facilityId,
                                },
                            },
                        });

                        if (!hasAccess) {
                            throw new TRPCError({
                                code: 'FORBIDDEN',
                                message: 'You do not have access to this facility',
                            });
                        }
                    }

                    const now = new Date();

                    // Update cycle to IN_TRANSIT
                    const updated = await tx.binCycle.update({
                        where: { id: cycle.id },
                        data: {
                            status: 'IN_TRANSIT',
                            pickedUpAt: now,
                            driverId: userId,
                            vehicleId: input.vehicleId,
                        },
                    });

                    // Update bin status
                    await tx.bin.update({
                        where: { id: cycle.binId },
                        data: { status: 'IN_TRANSIT' },
                    });

                    // Append event
                    await tx.eventLog.create({
                        data: {
                            cycleId: cycle.id,
                            eventType: 'PICKED_UP',
                            driverId: userId,
                            timestamp: now,
                            locationLat: input.lat,
                            locationLng: input.lng,
                        },
                    });

                    return {
                        ...updated,
                        ...calculateCountdown(updated.deadline, now),
                    };
                },
                { isolationLevel: 'Serializable' },
            );
        } catch (error) {
            handlePrismaError(error);
        }
    },

    /**
     * Deliver (Scan 3 — Driver)
     * Transition: IN_TRANSIT → COMPLETED + Bin reset to IDLE
     */
    async deliver(input: CycleDeliverInput, userId: string, userRole: string) {
        try {
            return await prisma.$transaction(
                async (tx: Prisma.TransactionClient) => {
                    const cycle = await tx.binCycle.findUnique({
                        where: { id: input.cycleId },
                        include: {
                            facility: { select: { id: true } },
                        },
                    });

                    if (!cycle) {
                        throw new TRPCError({ code: 'NOT_FOUND', message: 'Cycle not found' });
                    }

                    if (cycle.status !== 'IN_TRANSIT') {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: `Cannot deliver — cycle is ${cycle.status.toLowerCase()}, expected IN_TRANSIT`,
                        });
                    }

                    // Verify driver is assigned (unless ADMIN)
                    if (userRole !== 'ADMIN' && cycle.driverId !== userId) {
                        throw new TRPCError({
                            code: 'FORBIDDEN',
                            message: 'You are not the assigned driver for this cycle',
                        });
                    }

                    // CRITICAL FIX: Validate destinationId exists and is RENDERING facility
                    const destination = await tx.facility.findUnique({
                        where: { id: input.destinationId },
                    });

                    if (!destination || destination.deletedAt) {
                        throw new TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Destination facility not found',
                        });
                    }

                    if (destination.type !== 'RENDERING') {
                        throw new TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'Destination must be a RENDERING facility',
                        });
                    }

                    const now = new Date();
                    const complianceResult = calculateCompliance(now, cycle.deadline);

                    // Complete cycle with compliance result
                    const updated = await tx.binCycle.update({
                        where: { id: cycle.id },
                        data: {
                            status: 'COMPLETED',
                            deliveredAt: now,
                            complianceResult,
                            destinationId: input.destinationId,
                        },
                    });

                    // Reset bin to IDLE
                    await tx.bin.update({
                        where: { id: cycle.binId },
                        data: { status: 'IDLE' },
                    });

                    // Append event
                    await tx.eventLog.create({
                        data: {
                            cycleId: cycle.id,
                            eventType: 'DELIVERED',
                            driverId: userId,
                            timestamp: now,
                            locationLat: input.lat,
                            locationLng: input.lng,
                        },
                    });

                    return updated;
                },
                { isolationLevel: 'Serializable' },
            );
        } catch (error) {
            handlePrismaError(error);
        }
    },

    /** Get cycle by ID with countdown */
    async getById(id: string, userId: string, userRole: string) {
        const cycle = await prisma.binCycle.findUnique({
            where: { id },
            include: {
                bin: {
                    include: {
                        binType: { select: { organType: true, dkHours: true, urgency: true } },
                    },
                },
                facility: { select: { id: true, name: true } },
                destination: { select: { id: true, name: true } },
                events: { orderBy: { timestamp: 'asc' } },
            },
        });

        if (!cycle) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Cycle not found' });
        }

        // Verify facility access (unless ADMIN)
        if (userRole !== 'ADMIN') {
            const hasAccess = await prisma.userFacility.findUnique({
                where: {
                    userId_facilityId: {
                        userId,
                        facilityId: cycle.facilityId,
                    },
                },
            });

            if (!hasAccess) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this cycle',
                });
            }
        }

        return {
            ...cycle,
            ...calculateCountdown(cycle.deadline),
        };
    },

    /** List active cycles with countdown and pagination */
    async listActive(input: CycleListInput, facilityIds: string[], userRole: string) {
        const facilityFilter = userRole === 'ADMIN' ? {} : { facilityId: { in: facilityIds } };

        const where = {
            ...(input.status ? { status: input.status } : { status: { in: ['ACTIVE' as const, 'IN_TRANSIT' as const] } }),
            ...(input.facilityId && { facilityId: input.facilityId }),
            ...(input.binId && { binId: input.binId }),
            ...(input.complianceResult && { complianceResult: input.complianceResult }),
            ...facilityFilter,
        };

        const [items, totalCount] = await Promise.all([
            prisma.binCycle.findMany({
                where,
                include: {
                    bin: {
                        include: {
                            binType: { select: { organType: true, dkHours: true, urgency: true } },
                        },
                    },
                    facility: { select: { id: true, name: true } },
                    destination: { select: { id: true, name: true } },
                },
                take: input.limit + 1,
                ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
                orderBy: { deadline: 'asc' },
            }),
            prisma.binCycle.count({ where }),
        ]);

        const hasMore = items.length > input.limit;
        if (hasMore) items.pop();

        return {
            items: items.map((cycle) => ({
                ...cycle,
                ...calculateCountdown(cycle.deadline),
            })),
            nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
            totalCount,
        };
    },

    /** Get cycle history for a bin (all past cycles) */
    async getHistory(input: CycleHistoryInput, userId: string, userRole: string) {
        // First get the bin to check facility access
        const bin = await prisma.bin.findUnique({
            where: { id: input.binId },
            select: { currentFacilityId: true },
        });

        if (!bin) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Bin not found' });
        }

        // Verify facility access (unless ADMIN)
        if (userRole !== 'ADMIN') {
            const hasAccess = await prisma.userFacility.findUnique({
                where: {
                    userId_facilityId: {
                        userId,
                        facilityId: bin.currentFacilityId,
                    },
                },
            });

            if (!hasAccess) {
                throw new TRPCError({
                    code: 'FORBIDDEN',
                    message: 'You do not have access to this bin',
                });
            }
        }

        const [items, totalCount] = await Promise.all([
            prisma.binCycle.findMany({
                where: { binId: input.binId },
                include: {
                    facility: { select: { id: true, name: true } },
                    destination: { select: { id: true, name: true } },
                    events: { orderBy: { timestamp: 'asc' } },
                },
                take: input.limit + 1,
                ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
                orderBy: { startedAt: 'desc' },
            }),
            prisma.binCycle.count({ where: { binId: input.binId } }),
        ]);

        const hasMore = items.length > input.limit;
        if (hasMore) items.pop();

        return {
            items,
            nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
            totalCount,
        };
    },
};
