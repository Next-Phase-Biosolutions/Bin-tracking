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

    /**
     * Start a dynamic bin cycle (Scan 1 — Facility Tablet, Option B MVP)
     * 
     * Creates a new generic Bin on the fly from a Master QR Code and immediately starts a cycle for it.
     */
    async startDynamic(input: import('@bin-tracker/validators').BinStartDynamicInput, stationId: string) {
        return prisma.$transaction(
            async (tx: Prisma.TransactionClient) => {
                // 1. Find the parent BinType by the scanned Master QR code (normailze case/spaces for fuzzy matching)
                const normalizedQr = input.masterQrCode.trim().toUpperCase().replace(/\s+/g, '-');
                const binType = await tx.binType.findUnique({
                    where: { masterQrCode: normalizedQr },
                });

                if (!binType) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Master QR code "${input.masterQrCode}" not found in system`,
                    });
                }

                // Get the physical facility location of the station scanning the QR
                const station = await tx.station.findUnique({
                    where: { id: stationId },
                    select: { facilityId: true }
                });

                if (!station) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Scanning station not found`,
                    });
                }

                const now = new Date();
                const deadline = new Date(now.getTime() + binType.dkHours * 60 * 60 * 1000);

                // 2. Dynamically Generate a physical bin tracker identity.
                // Format: HRT-cycle-<timestamp>
                const dynamicQrCode = `${binType.prefix}-cycle-${Date.now().toString().slice(-6)}`;

                // 3. Create the physical Bin representation
                const bin = await tx.bin.create({
                    data: {
                        qrCode: dynamicQrCode,
                        binTypeId: binType.id,
                        currentFacilityId: station.facilityId,
                        status: 'ACTIVE',
                    }
                });

                // 4. Create cycle 
                const cycle = await tx.binCycle.create({
                    data: {
                        binId: bin.id,
                        facilityId: bin.currentFacilityId,
                        startedAt: now,
                        deadline,
                    },
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
                            organType: binType.organType,
                            dkHours: binType.dkHours,
                            urgency: binType.urgency,
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
        let bin = await prisma.bin.findUnique({
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

        // MVP Fallback: if scanning a Master QR code (e.g. TYPE-HEART), find the oldest active dynamic bin of that type
        if (!bin) {
            const normalizedQr = qrCode.trim().toUpperCase().replace(/\s+/g, '-');
            const binType = await prisma.binType.findUnique({
                where: { masterQrCode: normalizedQr },
            });

            if (binType) {
                const activeBins = await prisma.bin.findMany({
                    where: {
                        binTypeId: binType.id,
                        status: { in: ['ACTIVE', 'IN_TRANSIT'] },
                        deletedAt: null,
                    },
                    include: {
                        binType: true,
                        currentFacility: { select: { id: true, name: true, type: true } },
                        cycles: {
                            where: { status: { in: ['ACTIVE', 'IN_TRANSIT'] } },
                            take: 1,
                            orderBy: { startedAt: 'desc' },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                    take: 1,
                });
                if (activeBins.length > 0) {
                    bin = activeBins[0] || null;
                }
            }
        }

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

    /** 
     * Get all active bins associated with a scanned QR Code (or Master QR Code).
     * Used by the driver portal to resolve dynamic ambiguity and guarantee access. 
     */
    async getActiveDynamicMatches(qrCode: string, userId: string, userRole: string) {
        // 1. Resolve permitted facility IDs first (Drivers only see bins physically at their facilities)
        let permittedFacilityIds: string[] | undefined = undefined;
        if (userRole !== 'ADMIN') {
            const userFacilities = await prisma.userFacility.findMany({
                where: { userId },
                select: { facilityId: true }
            });
            permittedFacilityIds = userFacilities.map(uf => uf.facilityId);
        }

        const facilityFilter = permittedFacilityIds ? { currentFacilityId: { in: permittedFacilityIds } } : {};

        // 2. Check if the QR code is an exact physical Bin match
        const exactBin = await prisma.bin.findUnique({
            where: { qrCode },
            include: {
                binType: true,
                currentFacility: { select: { id: true, name: true, type: true } },
                cycles: {
                    where: { status: { in: ['ACTIVE', 'IN_TRANSIT'] } },
                    take: 1,
                    orderBy: { startedAt: 'desc' }
                }
            }
        });

        // If it's an exact match, verify it's active and accessible
        if (exactBin && !exactBin.deletedAt && ['ACTIVE', 'IN_TRANSIT'].includes(exactBin.status)) {
            if (permittedFacilityIds && !permittedFacilityIds.includes(exactBin.currentFacilityId)) {
                return []; // Cannot access this specific bin
            }

            const activeCycle = exactBin.cycles[0];
            return [{
                ...exactBin,
                activeCycle: activeCycle ? { ...activeCycle, ...calculateCountdown(activeCycle.deadline) } : null
            }];
        }

        // 3. Fallback: Check if it's a Master QR code to find dynamic bins
        const normalizedQr = qrCode.trim().toUpperCase().replace(/\s+/g, '-');
        const binType = await prisma.binType.findUnique({
            where: { masterQrCode: normalizedQr }
        });

        if (!binType) {
            return []; // Not a known master QR or exact QR
        }

        // 4. Find ALL active bins of this type that the user has access to
        const activeBins = await prisma.bin.findMany({
            where: {
                binTypeId: binType.id,
                status: { in: ['ACTIVE', 'IN_TRANSIT'] },
                deletedAt: null,
                ...facilityFilter
            },
            include: {
                binType: true,
                currentFacility: { select: { id: true, name: true, type: true } },
                cycles: {
                    where: { status: { in: ['ACTIVE', 'IN_TRANSIT'] } },
                    take: 1,
                    orderBy: { startedAt: 'desc' },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        return activeBins.map(b => {
            const activeCycle = b.cycles[0];
            return {
                ...b,
                activeCycle: activeCycle ? { ...activeCycle, ...calculateCountdown(activeCycle.deadline) } : null
            };
        });
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
