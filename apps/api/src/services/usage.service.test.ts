import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── In-memory Prisma fake for usage_counters ──────────────────────
// Mirrors only the usageCounter.upsert/update calls usage.service.ts
// actually issues, including Prisma's atomic { increment } / { decrement }
// update operators (not a plain read-modify-write), so a test that races
// two calls exercises the same atomicity the real DB row lock provides.

interface FakeCounter {
    orgId: string;
    metric: string;
    period: string;
    count: number;
}

function key(orgId: string, metric: string, period: string): string {
    return `${orgId}|${metric}|${period}`;
}

const store = vi.hoisted(() => {
    return { counters: new Map<string, FakeCounter>() };
});

vi.mock('@bin-tracker/db', () => {
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
        update: ({
            where,
            data,
        }: {
            where: { orgId_metric_period: { orgId: string; metric: string; period: string } };
            data: { count: { decrement: number } };
        }) => {
            const { orgId, metric, period } = where.orgId_metric_period;
            const k = key(orgId, metric, period);
            const existing = store.counters.get(k);
            if (!existing) throw new Error('counter not found');
            existing.count -= data.count.decrement;
            return Promise.resolve({ ...existing });
        },
    };
    return { prisma: { usageCounter } };
});

const { usageService } = await import('./usage.service.js');

beforeEach(() => {
    store.counters.clear();
});

describe('usageService.checkAndIncrement', () => {
    it('increments the counter on successive calls', async () => {
        await usageService.checkAndIncrement('org-a', 'form_digitize', 20);
        await usageService.checkAndIncrement('org-a', 'form_digitize', 20);

        const row = [...store.counters.values()][0];
        expect(row?.count).toBe(2);
    });

    it('allows a call one below the limit', async () => {
        for (let i = 0; i < 19; i += 1) {
            await usageService.checkAndIncrement('org-a', 'form_digitize', 20);
        }

        await expect(usageService.checkAndIncrement('org-a', 'form_digitize', 20)).resolves.toBeUndefined();
    });

    it('blocks the call that would push the count past the limit (boundary: exactly at limit)', async () => {
        for (let i = 0; i < 20; i += 1) {
            await usageService.checkAndIncrement('org-a', 'form_digitize', 20);
        }

        await expect(usageService.checkAndIncrement('org-a', 'form_digitize', 20)).rejects.toMatchObject({
            code: 'TOO_MANY_REQUESTS',
        });
    });

    it('does not consume a slot when a call is rejected', async () => {
        for (let i = 0; i < 20; i += 1) {
            await usageService.checkAndIncrement('org-a', 'form_digitize', 20);
        }

        await expect(usageService.checkAndIncrement('org-a', 'form_digitize', 20)).rejects.toMatchObject({
            code: 'TOO_MANY_REQUESTS',
        });

        const row = [...store.counters.values()][0];
        expect(row?.count).toBe(20);
    });

    it('treats limit === -1 as unlimited and never touches the counter', async () => {
        for (let i = 0; i < 500; i += 1) {
            await usageService.checkAndIncrement('org-a', 'voice_transcribe', -1);
        }

        expect(store.counters.size).toBe(0);
    });

    it('tracks separate orgs independently', async () => {
        await usageService.checkAndIncrement('org-a', 'form_digitize', 20);
        await usageService.checkAndIncrement('org-b', 'form_digitize', 20);

        const rows = [...store.counters.values()];
        expect(rows.find((r) => r.orgId === 'org-a')?.count).toBe(1);
        expect(rows.find((r) => r.orgId === 'org-b')?.count).toBe(1);
    });
});
