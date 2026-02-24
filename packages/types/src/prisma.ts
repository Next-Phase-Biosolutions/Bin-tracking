import { Prisma } from '@prisma/client';

/**
 * Shared Prisma type definitions for consistent type safety across the app
 * Uses Prisma.validator to ensure types match actual Prisma queries
 */

// Facility with details (for list/display)
export const facilityWithDetails = Prisma.validator<Prisma.FacilityDefaultArgs>()({
    include: {
        stations: { select: { id: true, label: true } },
        _count: { select: { bins: true, cycles: true } },
    },
});

export type FacilityWithDetails = Prisma.FacilityGetPayload<typeof facilityWithDetails>;

// Cycle with full details (for detailed views)
export const cycleWithDetails = Prisma.validator<Prisma.BinCycleDefaultArgs>()({
    include: {
        bin: {
            include: {
                binType: { select: { organType: true, dkHours: true, urgency: true } },
                currentFacility: { select: { id: true, name: true } },
            },
        },
        facility: { select: { id: true, name: true } },
        destination: { select: { id: true, name: true } },
    },
});

export type CycleWithDetails = Prisma.BinCycleGetPayload<typeof cycleWithDetails>;

// Facility with cycle counts (for dashboard stats)
export const facilityWithCycleCounts = Prisma.validator<Prisma.FacilityDefaultArgs>()({
    select: {
        id: true,
        name: true,
        _count: {
            select: {
                cycles: true,
            },
        },
    },
});

export type FacilityWithCycleCounts = Prisma.FacilityGetPayload<typeof facilityWithCycleCounts>;

// Bin with active cycle (for bin details)
export const binWithActiveCycle = Prisma.validator<Prisma.BinDefaultArgs>()({
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

export type BinWithActiveCycle = Prisma.BinGetPayload<typeof binWithActiveCycle>;
