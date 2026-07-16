import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake ────────────────────────────────────
// Mirrors only the binCycle.findMany/updateMany queries blockchain.service.ts
// actually uses.
//
// Regression focus: getDailySummary's fetchCycles() and confirmAnchor()'s
// updateMany() must both filter by organizationId — before this batch neither
// did, so an admin could anchor CIP-25 metadata for another org's cycles, or
// mark another org's cycle IDs as anchored via confirmAnchor.

interface FakeCycle {
    id: string;
    organizationId: string;
    status: 'ACTIVE' | 'COMPLETED';
    deliveredAt: Date | null;
    anchored: boolean;
    anchorTxHash: string | null;
    binId: string;
    facilityId: string;
    destinationId: string | null;
    startedAt: Date;
    deadline: Date;
    pickedUpAt: Date | null;
    complianceResult: string | null;
}

const store = vi.hoisted(() => {
    return { cycles: [] as FakeCycle[] };
});

const FAKE_BIN = { qrCode: 'QR-1', binType: { organType: 'LIVER', dkHours: 24 } };
const FAKE_FACILITY = { id: 'fac-1', name: 'Facility 1' };

vi.mock('@bin-tracker/db', () => {
    const binCycle = {
        findMany: ({ where }: { where: { organizationId: string; status: string; deliveredAt: { gte: Date; lte: Date } } }) =>
            Promise.resolve(
                store.cycles
                    .filter(
                        (c) =>
                            c.organizationId === where.organizationId &&
                            c.status === where.status &&
                            c.deliveredAt !== null &&
                            c.deliveredAt >= where.deliveredAt.gte &&
                            c.deliveredAt <= where.deliveredAt.lte,
                    )
                    .map((c) => ({ ...c, bin: FAKE_BIN, facility: FAKE_FACILITY, destination: null })),
            ),
        updateMany: ({
            where,
            data,
        }: {
            where: { id: { in: string[] }; organizationId: string; anchored: boolean };
            data: { anchored: boolean; anchorTxHash: string };
        }) => {
            let count = 0;
            for (const cycle of store.cycles) {
                if (
                    where.id.in.includes(cycle.id) &&
                    cycle.organizationId === where.organizationId &&
                    cycle.anchored === where.anchored
                ) {
                    cycle.anchored = data.anchored;
                    cycle.anchorTxHash = data.anchorTxHash;
                    count += 1;
                }
            }
            return Promise.resolve({ count });
        },
    };

    return { prisma: { binCycle } };
});

const { blockchainService } = await import('./blockchain.service.js');

function makeCycle(overrides: Partial<FakeCycle>): FakeCycle {
    return {
        id: overrides.id ?? 'cycle-1',
        organizationId: overrides.organizationId ?? 'org-a',
        status: 'COMPLETED',
        deliveredAt: new Date('2026-07-10T12:00:00.000Z'),
        anchored: false,
        anchorTxHash: null,
        binId: 'bin-1',
        facilityId: 'fac-1',
        destinationId: null,
        startedAt: new Date('2026-07-09T12:00:00.000Z'),
        deadline: new Date('2026-07-10T18:00:00.000Z'),
        pickedUpAt: new Date('2026-07-10T00:00:00.000Z'),
        complianceResult: 'ON_TIME',
        ...overrides,
    };
}

beforeEach(() => {
    store.cycles = [];
});

describe('blockchainService.getDailySummary', () => {
    it('only includes cycles belonging to the requesting org', async () => {
        store.cycles.push(
            makeCycle({ id: 'cycle-a', organizationId: 'org-a' }),
            makeCycle({ id: 'cycle-b', organizationId: 'org-b' }),
        );

        const summary = await blockchainService.getDailySummary('org-a', '2026-07-10', '2026-07-10');

        expect(summary.totalCycles).toBe(1);
        expect(summary.cycleIds).toEqual(['cycle-a']);
    });

    it('returns an empty summary when the org has no completed cycles in range', async () => {
        store.cycles.push(makeCycle({ id: 'cycle-b', organizationId: 'org-b' }));

        const summary = await blockchainService.getDailySummary('org-a', '2026-07-10', '2026-07-10');

        expect(summary.totalCycles).toBe(0);
        expect(summary.merkleRoot).toBeNull();
    });
});

describe('blockchainService.confirmAnchor', () => {
    it('only anchors cycle IDs belonging to the requesting org', async () => {
        store.cycles.push(
            makeCycle({ id: 'cycle-a', organizationId: 'org-a', anchored: false }),
            makeCycle({ id: 'cycle-b', organizationId: 'org-b', anchored: false }),
        );

        const result = await blockchainService.confirmAnchor(
            'org-a',
            ['cycle-a', 'cycle-b'],
            'a'.repeat(64),
        );

        expect(result.updated).toBe(1);
        expect(store.cycles.find((c) => c.id === 'cycle-a')?.anchored).toBe(true);
        // cross-org cycle must remain untouched
        expect(store.cycles.find((c) => c.id === 'cycle-b')?.anchored).toBe(false);
    });
});
