import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Wiring test: metering runs before the AssemblyAI/Claude calls ─────────
// transcribeAndExtract must look up the org's plan and call
// usageService.checkAndIncrement with the 'voice_transcribe' metric BEFORE
// any AssemblyAI call — a pre-loaded counter at the plan limit must reject
// with TOO_MANY_REQUESTS without ever reaching the network call (no
// ASSEMBLYAI_API_KEY is set in this test, so reaching the network call would
// fail differently, which is how we know metering ran first).

const store = vi.hoisted(() => {
    return {
        subscription: null as { plan: 'STARTER' | 'PRO' | 'ENTERPRISE' } | null,
        counters: new Map<string, { orgId: string; metric: string; period: string; count: number }>(),
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
    interface FakePrisma {
        subscription: typeof subscription;
        usageCounter: typeof usageCounter;
        $transaction: <T>(fn: (tx: FakePrisma) => Promise<T>) => Promise<T>;
    }
    const prisma: FakePrisma = {
        subscription,
        usageCounter,
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
});

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
