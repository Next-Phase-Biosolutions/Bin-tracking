import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Wiring test: metering runs before the AssemblyAI/Claude calls ─────────
// transcribeAndExtract must look up the org's plan and call
// usageService.checkAndIncrement with the 'voice_transcribe' metric BEFORE
// any AssemblyAI call — a pre-loaded counter at the plan limit must reject
// with TOO_MANY_REQUESTS without ever reaching the network call (no
// ASSEMBLYAI_API_KEY is set in this test, so reaching the network call would
// fail differently, which is how we know metering ran first).

interface FakeRegistration {
    id: string;
    animalType: string;
    breed: string | null;
    ownerName: string;
    organizationId: string;
    createdAt: Date;
}

const store = vi.hoisted(() => {
    return {
        subscription: null as { plan: 'STARTER' | 'PRO' | 'ENTERPRISE' } | null,
        counters: new Map<string, { orgId: string; metric: string; period: string; count: number }>(),
        registrations: [] as FakeRegistration[],
    };
});

function key(orgId: string, metric: string, period: string): string {
    return `${orgId}|${metric}|${period}`;
}

vi.mock('@bin-tracker/db', () => {
    const subscription = { findUnique: () => Promise.resolve(store.subscription) };
    const usageCounter = {
        upsert: ({
            where,
            create,
            update,
        }: {
            where: { orgId_metric_period: { orgId: string; metric: string; period: string } };
            create: { orgId: string; metric: string; period: string; count: number };
            update: { count: { increment: number } };
        }) => {
            const { orgId, metric, period } = where.orgId_metric_period;
            const k = key(orgId, metric, period);
            const existing = store.counters.get(k);
            if (!existing) {
                const created = { orgId, metric, period, count: create.count };
                store.counters.set(k, created);
                return Promise.resolve({ ...created });
            }
            existing.count += update.count.increment;
            return Promise.resolve({ ...existing });
        },
    };
    // usage.service.ts runs increment + limit-check in one transaction; model
    // real rollback so "does not consume a slot when rejected" tests the same
    // property the DB provides.
    // Minimal list/count/groupBy/deleteMany fake for the records-dashboard
    // methods. Search filtering mirrors Prisma's contains/insensitive OR.
    const matches = (r: { animalType: string; breed: string | null; ownerName: string }, search?: string) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            r.animalType.toLowerCase().includes(s) ||
            (r.breed?.toLowerCase().includes(s) ?? false) ||
            r.ownerName.toLowerCase().includes(s)
        );
    };
    const animalRegistration = {
        findMany: ({
            where,
            take,
        }: {
            where: { organizationId: string; OR?: Array<Record<string, { contains: string }>> };
            take: number;
        }) => {
            const search = where.OR?.[0]?.['animalType']?.contains;
            return Promise.resolve(
                store.registrations
                    .filter((r) => r.organizationId === where.organizationId && matches(r, search))
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .slice(0, take),
            );
        },
        count: ({ where }: { where: { organizationId: string; createdAt?: { gte: Date } } }) =>
            Promise.resolve(
                store.registrations.filter(
                    (r) =>
                        r.organizationId === where.organizationId &&
                        (!where.createdAt || r.createdAt >= where.createdAt.gte),
                ).length,
            ),
        groupBy: ({ where }: { where: { organizationId: string } }) => {
            const counts = new Map<string, number>();
            for (const r of store.registrations) {
                if (r.organizationId !== where.organizationId) continue;
                counts.set(r.animalType, (counts.get(r.animalType) ?? 0) + 1);
            }
            return Promise.resolve(
                [...counts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([animalType, n]) => ({ animalType, _count: { _all: n } })),
            );
        },
        deleteMany: ({ where }: { where: { id: string; organizationId: string } }) => {
            const before = store.registrations.length;
            store.registrations = store.registrations.filter(
                (r) => !(r.id === where.id && r.organizationId === where.organizationId),
            );
            return Promise.resolve({ count: before - store.registrations.length });
        },
    };
    interface FakePrisma {
        subscription: typeof subscription;
        usageCounter: typeof usageCounter;
        animalRegistration: typeof animalRegistration;
        $transaction: <T>(fn: (tx: FakePrisma) => Promise<T>) => Promise<T>;
    }
    const prisma: FakePrisma = {
        subscription,
        usageCounter,
        animalRegistration,
        $transaction: async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => {
            const snapshot = new Map([...store.counters].map(([k, v]) => [k, { ...v }]));
            try {
                return await fn(prisma);
            } catch (error) {
                store.counters.clear();
                for (const [k, v] of snapshot) store.counters.set(k, v);
                throw error;
            }
        },
    };
    return { prisma };
});

const { farmerService } = await import('./farmer.service.js');

function currentPeriod(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

beforeEach(() => {
    store.subscription = null;
    store.counters.clear();
    store.registrations = [];
});

function reg(overrides: Partial<FakeRegistration>): FakeRegistration {
    return {
        id: `reg-${Math.random().toString(36).slice(2, 8)}`,
        animalType: 'Cow',
        breed: null,
        ownerName: 'Owner',
        organizationId: 'org-a',
        createdAt: new Date(),
        ...overrides,
    };
}

describe('farmerService.transcribeAndExtract metering', () => {
    it('rejects with TOO_MANY_REQUESTS once the org is at its plan monthlyTranscribe limit', async () => {
        store.subscription = { plan: 'PRO' }; // monthlyTranscribe: 50
        store.counters.set(key('org-a', 'voice_transcribe', currentPeriod()), {
            orgId: 'org-a',
            metric: 'voice_transcribe',
            period: currentPeriod(),
            count: 50,
        });

        await expect(
            farmerService.transcribeAndExtract({ audioBase64: 'abc' } as never, 'org-a'),
        ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    });

    it('does not consume a slot when the call is rejected', async () => {
        store.subscription = { plan: 'PRO' };
        store.counters.set(key('org-a', 'voice_transcribe', currentPeriod()), {
            orgId: 'org-a',
            metric: 'voice_transcribe',
            period: currentPeriod(),
            count: 50,
        });

        await expect(
            farmerService.transcribeAndExtract({ audioBase64: 'abc' } as never, 'org-a'),
        ).rejects.toBeDefined();

        expect(store.counters.get(key('org-a', 'voice_transcribe', currentPeriod()))?.count).toBe(50);
    });
});

describe('farmerService.list — org scoping and search', () => {
    it('returns only the calling org\'s registrations, newest first', async () => {
        const older = reg({ id: 'r1', createdAt: new Date('2026-01-01') });
        const newer = reg({ id: 'r2', createdAt: new Date('2026-06-01') });
        const foreign = reg({ id: 'r3', organizationId: 'org-b' });
        store.registrations.push(older, newer, foreign);

        const result = await farmerService.list('org-a', { limit: 100 });

        expect(result.map((r) => r.id)).toEqual(['r2', 'r1']);
    });

    it('matches search against animalType, breed, and ownerName case-insensitively', async () => {
        store.registrations.push(
            reg({ id: 'r1', animalType: 'Goat' }),
            reg({ id: 'r2', breed: 'Boer goat' }),
            reg({ id: 'r3', ownerName: 'Goatherd Ali' }),
            reg({ id: 'r4', animalType: 'Cow', ownerName: 'Someone' }),
        );

        const result = await farmerService.list('org-a', { search: 'goat', limit: 100 });

        expect(result.map((r) => r.id).sort()).toEqual(['r1', 'r2', 'r3']);
    });
});

describe('farmerService.stats', () => {
    it('counts totals, this-week, and per-type for the org only', async () => {
        const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        store.registrations.push(
            reg({ animalType: 'Cow', createdAt: old }),
            reg({ animalType: 'Cow' }),
            reg({ animalType: 'Goat' }),
            reg({ animalType: 'Sheep', organizationId: 'org-b' }),
        );

        const result = await farmerService.stats('org-a');

        expect(result.total).toBe(3);
        expect(result.thisWeek).toBe(2);
        expect(result.byType).toEqual([
            { animalType: 'Cow', count: 2 },
            { animalType: 'Goat', count: 1 },
        ]);
    });
});

describe('farmerService.remove — cross-org ownership', () => {
    it('deletes a registration belonging to the calling org', async () => {
        store.registrations.push(reg({ id: 'r1' }));

        await expect(farmerService.remove('org-a', 'r1')).resolves.toEqual({ id: 'r1' });
        expect(store.registrations).toHaveLength(0);
    });

    it('reports NOT_FOUND for another org\'s registration and leaves it intact', async () => {
        store.registrations.push(reg({ id: 'r1', organizationId: 'org-b' }));

        await expect(farmerService.remove('org-a', 'r1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
        expect(store.registrations).toHaveLength(1);
    });
});
