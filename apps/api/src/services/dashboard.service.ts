import { Prisma } from '@prisma/client';
import { prisma } from '@bin-tracker/db';
import { calculateCountdown } from '../lib/countdown.js';
import type { PaginationInput } from '@bin-tracker/validators';
import type { FacilityWithCycleCounts } from '@bin-tracker/types';
import type { UserRole } from '@prisma/client';

export const dashboardService = {
    /**
     * Aggregate stats for the ops dashboard
     * @param facilityIds - List of facility IDs user has access to
     * @param userRole - User's role (ADMIN gets all facilities)
     */
    async getStats(facilityIds: string[], userRole: UserRole) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Build facility filter
        const facilityFilter = userRole === 'ADMIN' ? { type: 'PROCESSING' as const } : { type: 'PROCESSING' as const, id: { in: facilityIds } };

        const cycleFilter = userRole === 'ADMIN' ? {} : { facilityId: { in: facilityIds } };

        const [totalActiveBins, totalOverdue, totalCompletedToday, totalCompletedOnTime, byFacility, byUrgency] =
            await Promise.all([
                // Active bins (ACTIVE or IN_TRANSIT)
                prisma.binCycle.count({
                    where: {
                        status: { in: ['ACTIVE', 'IN_TRANSIT'] },
                        ...cycleFilter,
                    },
                }),
                // Overdue (active + past deadline)
                prisma.binCycle.count({
                    where: {
                        status: { in: ['ACTIVE', 'IN_TRANSIT'] },
                        deadline: { lt: now },
                        ...cycleFilter,
                    },
                }),
                // Completed today
                prisma.binCycle.count({
                    where: {
                        status: 'COMPLETED',
                        deliveredAt: { gte: todayStart },
                        ...cycleFilter,
                    },
                }),
                // Completed on time today (for compliance rate)
                prisma.binCycle.count({
                    where: {
                        status: 'COMPLETED',
                        deliveredAt: { gte: todayStart },
                        complianceResult: 'ON_TIME',
                        ...cycleFilter,
                    },
                }),
                // By facility
                prisma.facility.findMany({
                    where: { deletedAt: null, ...facilityFilter },
                    select: {
                        id: true,
                        name: true,
                        _count: {
                            select: {
                                cycles: {
                                    where: { status: { in: ['ACTIVE', 'IN_TRANSIT'] } },
                                },
                            },
                        },
                    },
                }),
                // By urgency - FIXED: Now groups by bin type urgency, not cycle status
                prisma.$queryRaw<Array<{ urgency: string; count: bigint }>>`
                    SELECT bt.urgency, COUNT(*)::bigint as count
                    FROM bin_cycles bc
                    INNER JOIN bins b ON bc."binId" = b.id
                    INNER JOIN bin_types bt ON b."binTypeId" = bt.id
                    WHERE bc.status IN ('ACTIVE', 'IN_TRANSIT')
                    ${userRole !== 'ADMIN' ? Prisma.sql`AND bc."facilityId" IN (${Prisma.join(facilityIds)})` : Prisma.empty}
                    GROUP BY bt.urgency
                `,
            ]);

        // FIXED: Calculate actual overdue count per facility
        const overdueByFacility = await prisma.binCycle.groupBy({
            by: ['facilityId'],
            where: {
                status: { in: ['ACTIVE', 'IN_TRANSIT'] },
                deadline: { lt: now },
                ...cycleFilter,
            },
            _count: true,
        });

        const overdueMap = new Map(overdueByFacility.map((item) => [item.facilityId, item._count]));

        const complianceRate =
            totalCompletedToday > 0 ? Math.round((totalCompletedOnTime / totalCompletedToday) * 100) : 100;

        return {
            totalActiveBins,
            totalOverdue,
            totalCompletedToday,
            complianceRate,
            byFacility: byFacility.map((f: FacilityWithCycleCounts) => ({
                facilityId: f.id,
                facilityName: f.name,
                activeBins: f._count.cycles,
                overdueBins: overdueMap.get(f.id) ?? 0, // FIXED: Now returns actual count
            })),
            byUrgency: byUrgency.map((g) => ({
                urgency: g.urgency, // FIXED: Now correctly labeled as "urgency"
                count: Number(g.count),
            })),
        };
    },

    /** Priority queue — active cycles sorted by deadline (most urgent first) */
    async getPriorityQueue(input: PaginationInput, facilityIds: string[], userRole: UserRole) {
        const cycleFilter = userRole === 'ADMIN' ? {} : { facilityId: { in: facilityIds } };

        const where = {
            status: { in: ['ACTIVE' as const, 'IN_TRANSIT' as const] },
            ...cycleFilter,
        };

        const [items, totalCount] = await Promise.all([
            prisma.binCycle.findMany({
                where,
                include: {
                    bin: {
                        include: {
                            binType: { select: { organType: true, dkHours: true, urgency: true } },
                            currentFacility: { select: { id: true, name: true } },
                        },
                    },
                    facility: { select: { id: true, name: true } },
                },
                take: (input.limit ?? 20) + 1,
                ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
                orderBy: { deadline: 'asc' },
            }),
            prisma.binCycle.count({ where }),
        ]);

        const limit = input.limit ?? 20;
        const hasMore = items.length > limit;
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

    /** Overdue cycles — past deadline and still active */
    async getOverdue(input: PaginationInput, facilityIds: string[], userRole: UserRole) {
        const now = new Date();

        const cycleFilter = userRole === 'ADMIN' ? {} : { facilityId: { in: facilityIds } };

        const where = {
            status: { in: ['ACTIVE' as const, 'IN_TRANSIT' as const] },
            deadline: { lt: now },
            ...cycleFilter,
        };

        const [items, totalCount] = await Promise.all([
            prisma.binCycle.findMany({
                where,
                include: {
                    bin: {
                        include: {
                            binType: { select: { organType: true, dkHours: true, urgency: true } },
                            currentFacility: { select: { id: true, name: true } },
                        },
                    },
                    facility: { select: { id: true, name: true } },
                },
                take: (input.limit ?? 20) + 1,
                ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
                orderBy: { deadline: 'asc' },
            }),
            prisma.binCycle.count({ where }),
        ]);

        const limit = input.limit ?? 20;
        const hasMore = items.length > limit;
        if (hasMore) items.pop();

        return {
            items: items.map((cycle) => ({
                ...cycle,
                ...calculateCountdown(cycle.deadline, now),
            })),
            nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
            totalCount,
        };
    },
};
