import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import type { Prisma } from '@prisma/client';
import type { BinStartInput, BinListInput } from '@bin-tracker/validators';
import { calculateCountdown } from '../lib/countdown.js';

export const binService = {
    /**
     * Start a bin cycle (Scan 1 — Facility Tablet)
     *
     * Concurrency protection:
     * - Transaction with Serializable isolation prevents TOCTOU
     * - @@unique([binId, status]) prevents duplicate active cycles at DB level
     */
    async start(input: BinStartInput, stationId: string) {
        return prisma.$transaction(
            async (tx: Prisma.TransactionClient) => {
                // 1. Find bin by QR code (with bin type for DK hours)
                const bin = await tx.bin.findUnique({
                    where: { qrCode: input.qrCode },
                    include: { binType: true },
                });

                if (!bin) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Bin with QR code "${input.qrCode}" not found`,
                    });
                }

                if (bin.deletedAt) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: 'This bin has been decommissioned',
                    });
                }

                if (bin.status !== 'IDLE') {
                    throw new TRPCError({
                        code: 'CONFLICT',
                        message: `Bin is already ${bin.status.toLowerCase()}. Cannot start a new cycle.`,
                    });
                }

                // 2. Calculate deadline from DK hours
                const now = new Date();
                const deadline = new Date(now.getTime() + bin.binType.dkHours * 60 * 60 * 1000);

                // 3. Create cycle (unique constraint guards against concurrent duplicates)
                const cycle = await tx.binCycle.create({
                    data: {
                        binId: bin.id,
                        facilityId: bin.currentFacilityId,
                        startedAt: now,
                        deadline,
                    },
                });

                // 4. Update bin status to ACTIVE
                await tx.bin.update({
                    where: { id: bin.id },
                    data: { status: 'ACTIVE' },
                });

                // 5. Append event (immutable audit log)
                await tx.eventLog.create({
                    data: {
                        cycleId: cycle.id,
                        eventType: 'BIN_STARTED',
                        stationId,
                        timestamp: now,
                    },
                });

                // 6. Return cycle with countdown
                const countdown = calculateCountdown(deadline, now);
                return {
                    ...cycle,
                    ...countdown,
                    bin: {
                        id: bin.id,
                        qrCode: bin.qrCode,
                        binType: {
                            organType: bin.binType.organType,
                            dkHours: bin.binType.dkHours,
                            urgency: bin.binType.urgency,
                        },
                    },
                };
            },
            { isolationLevel: 'Serializable' },
        );
    },

    /** Get bin by ID with active cycle and countdown */
    async getById(id: string, userId: string, userRole: string) {
        const bin = await prisma.bin.findUnique({
            where: { id },
            include: {
                binType: true,
                currentFacility: { select: { id: true, name: true, type: true } },
                cycles: {
                    where: { status: { in: ['ACTIVE', 'IN_TRANSIT'] } },
                    take: 1,
                    orderBy: { startedAt: 'desc' },
                },
            },
        });

        if (!bin || bin.deletedAt) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Bin not found' });
        }

        if (userRole !== 'ADMIN') {
            const hasAccess = await prisma.userFacility.findUnique({
                where: { userId_facilityId: { userId, facilityId: bin.currentFacilityId } },
            });
            if (!hasAccess) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this bin' });
            }
        }

        const activeCycle = bin.cycles[0];
        return {
            ...bin,
            activeCycle: activeCycle
                ? { ...activeCycle, ...calculateCountdown(activeCycle.deadline) }
                : null,
        };
    },

    /** Get bin by QR code */
    async getByQrCode(qrCode: string, userId: string, userRole: string) {
        const bin = await prisma.bin.findUnique({
            where: { qrCode },
            include: {
                binType: true,
                currentFacility: { select: { id: true, name: true, type: true } },
                cycles: {
                    where: { status: { in: ['ACTIVE', 'IN_TRANSIT'] } },
                    take: 1,
                    orderBy: { startedAt: 'desc' },
                },
            },
        });

        if (!bin || bin.deletedAt) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Bin not found' });
        }

        if (userRole !== 'ADMIN') {
            const hasAccess = await prisma.userFacility.findUnique({
                where: { userId_facilityId: { userId, facilityId: bin.currentFacilityId } },
            });
            if (!hasAccess) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this bin' });
            }
        }

        const activeCycle = bin.cycles[0];
        return {
            ...bin,
            activeCycle: activeCycle
                ? { ...activeCycle, ...calculateCountdown(activeCycle.deadline) }
                : null,
        };
    },

    /** List bins with filters and cursor pagination */
    async list(input: BinListInput, facilityIds: string[], userRole: string) {
        const facilityFilter = userRole === 'ADMIN' ? {} : { currentFacilityId: { in: facilityIds } };

        const where = {
            deletedAt: null,
            ...(input.facilityId && { currentFacilityId: input.facilityId }),
            ...(input.status && { status: input.status }),
            ...(input.binTypeId && { binTypeId: input.binTypeId }),
            ...facilityFilter,
        };

        const [items, totalCount] = await Promise.all([
            prisma.bin.findMany({
                where,
                include: {
                    binType: true,
                    currentFacility: { select: { id: true, name: true, type: true } },
                },
                take: input.limit + 1, // Fetch one extra to check if next page exists
                ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
                orderBy: { createdAt: 'desc' },
            }),
            prisma.bin.count({ where }),
        ]);

        const hasMore = items.length > input.limit;
        if (hasMore) items.pop(); // Remove the extra item

        return {
            items,
            nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
            totalCount,
        };
    },
};
