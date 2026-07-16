import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Wiring test: metering runs before the Gemini call ─────────────
// Verifies digitizeFromPhoto/refineFromRegion look up the org's plan and
// call usageService.checkAndIncrement with the 'form_digitize' metric BEFORE
// any Gemini call is attempted — a pre-loaded counter at the plan limit must
// reject with TOO_MANY_REQUESTS without ever reaching the network call (no
// GEMINI_API_KEY is set in this test, so reaching the network call would
// instead throw PRECONDITION_FAILED, which is how we know metering ran first).

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

const { formDigitizeService } = await import('./form-digitize.service.js');

function currentPeriod(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

beforeEach(() => {
    store.subscription = null;
    store.counters.clear();
});

describe('formDigitizeService metering', () => {
    it('digitizeFromPhoto rejects with TOO_MANY_REQUESTS once the org is at its plan monthlyDigitize limit', async () => {
        store.subscription = { plan: 'PRO' }; // monthlyDigitize: 20
        store.counters.set(key('org-a', 'form_digitize', currentPeriod()), {
            orgId: 'org-a',
            metric: 'form_digitize',
            period: currentPeriod(),
            count: 20,
        });

        await expect(formDigitizeService.digitizeFromPhoto('base64img', 'org-a')).rejects.toMatchObject({
            code: 'TOO_MANY_REQUESTS',
        });
    });

    it('refineFromRegion rejects with TOO_MANY_REQUESTS once the org is at its plan monthlyDigitize limit', async () => {
        store.subscription = { plan: 'PRO' };
        store.counters.set(key('org-a', 'form_digitize', currentPeriod()), {
            orgId: 'org-a',
            metric: 'form_digitize',
            period: currentPeriod(),
            count: 20,
        });
        const draft = { title: 't', description: null, formType: 'standard' as const, schema: { formType: 'standard' as const, sections: [] } };

        await expect(formDigitizeService.refineFromRegion('base64img', draft, 'org-a')).rejects.toMatchObject({
            code: 'TOO_MANY_REQUESTS',
        });
    });

    it('does not consume a slot when the call is rejected', async () => {
        store.subscription = { plan: 'PRO' };
        store.counters.set(key('org-a', 'form_digitize', currentPeriod()), {
            orgId: 'org-a',
            metric: 'form_digitize',
            period: currentPeriod(),
            count: 20,
        });

        await expect(formDigitizeService.digitizeFromPhoto('base64img', 'org-a')).rejects.toBeDefined();

        expect(store.counters.get(key('org-a', 'form_digitize', currentPeriod()))?.count).toBe(20);
    });
});
