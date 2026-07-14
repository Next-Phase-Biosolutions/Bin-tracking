import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the binCycle.findMany/count queries dashboard.service.ts's
// getOverdue actually uses.
//
// Regression focus: before this batch, the ADMIN branch of cycleFilter in
// dashboard.service.ts was an unconditional `{}` — no facilityIds filter AND
// no organizationId filter — so an ADMIN's dashboard aggregated cycles from
// every org, not just their own. getPriorityQueue and getStats had the same
// bug (same `cycleFilter` pattern); getOverdue is exercised here as the
// simplest representative of the fix (a plain findMany/count, no groupBy or
// raw SQL to fake).

type CycleStatus = 'ACTIVE' | 'IN_TRANSIT' | 'COMPLETED';

interface FakeCycle {
    id: string;
    organizationId: string;
    facilityId: string;
    status: CycleStatus;
    deadline: Date;
}

const store = vi.hoisted(() => {
    return { cycles: [] as FakeCycle[], seq: 0 };
});

function nextId(prefix: string): string {
    store.seq += 1;
    return `${prefix}-${store.seq}`;
}

interface WhereClause {
    organizationId?: string;
    facilityId?: { in: string[] };
    status?: { in: CycleStatus[] };
    deadline?: { lt: Date };
}

function matches(cycle: FakeCycle, where: WhereClause): boolean {
    if (where.organizationId !== undefined && cycle.organizationId !== where.organizationId) return false;
    if (where.facilityId && !where.facilityId.in.includes(cycle.facilityId)) return false;
    if (where.status && !where.status.in.includes(cycle.status)) return false;
    if (where.deadline && !(cycle.deadline < where.deadline.lt)) return false;
    return true;
}

vi.mock('@bin-tracker/db', () => {
    const binCycle = {
        findMany: ({ where }: { where: WhereClause }) =>
            Promise.resolve(store.cycles.filter((c) => matches(c, where))),
        count: ({ where }: { where: WhereClause }) =>
            Promise.resolve(store.cycles.filter((c) => matches(c, where)).length),
    };

    return { prisma: { binCycle } };
});

const { dashboardService } = await import('./dashboard.service.js');

function seedCycle(overrides: Partial<FakeCycle> = {}): FakeCycle {
    const cycle: FakeCycle = {
        id: nextId('cycle'),
        organizationId: 'org-1',
        facilityId: 'fac-1',
        status: 'ACTIVE',
        deadline: new Date(Date.now() - 60 * 60 * 1000), // overdue by default
        ...overrides,
    };
    store.cycles.push(cycle);
    return cycle;
}

describe('dashboardService.getOverdue — ADMIN cross-org isolation', () => {
    beforeEach(() => {
        store.cycles.length = 0;
        store.seq = 0;
    });

    it('does not include another org\'s overdue cycles for an ADMIN caller', async () => {
        seedCycle({ organizationId: 'org-1' });
        seedCycle({ organizationId: 'org-2' }); // must never show up for org-1's ADMIN

        const result = await dashboardService.getOverdue('org-1', { limit: 20 }, [], 'ADMIN');

        expect(result.totalCount).toBe(1);
        expect(result.items.every((i) => i.organizationId === 'org-1')).toBe(true);
    });

    it('still excludes non-overdue and completed cycles for an ADMIN caller', async () => {
        seedCycle({ organizationId: 'org-1', deadline: new Date(Date.now() + 60 * 60 * 1000) }); // not overdue
        seedCycle({ organizationId: 'org-1', status: 'COMPLETED' });
        const overdue = seedCycle({ organizationId: 'org-1' });

        const result = await dashboardService.getOverdue('org-1', { limit: 20 }, [], 'ADMIN');

        expect(result.totalCount).toBe(1);
        expect(result.items[0]?.id).toBe(overdue.id);
    });
});
