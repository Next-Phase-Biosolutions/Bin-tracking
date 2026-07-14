import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';

/** 'YYYY-MM' for the current UTC month — the bucket a usage counter belongs to. */
function currentPeriod(): string {
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${now.getUTCFullYear()}-${month}`;
}

export const usageService = {
    /**
     * Atomically increments the org's usage counter for `metric` this month,
     * throwing TOO_MANY_REQUESTS if that increment pushes it past `limit`.
     * `limit === -1` (ENTERPRISE / unlimited) skips metering entirely.
     *
     * Atomicity: the increment is a single DB-level atomic upsert (Postgres
     * serializes concurrent `count: { increment: 1 }` writes to the same row),
     * so two concurrent calls can never both read the same pre-increment count
     * and both slip past the limit. A call that turns out to be over the limit
     * is rolled back with a matching atomic decrement, so a rejected call nets
     * to zero effect on the counter instead of silently consuming a slot.
     */
    async checkAndIncrement(orgId: string, metric: string, limit: number): Promise<void> {
        if (limit === -1) return;

        const period = currentPeriod();
        const where = { orgId_metric_period: { orgId, metric, period } };

        const row = await prisma.usageCounter.upsert({
            where,
            create: { orgId, metric, period, count: 1 },
            update: { count: { increment: 1 } },
        });

        if (row.count > limit) {
            await prisma.usageCounter.update({ where, data: { count: { decrement: 1 } } });
            throw new TRPCError({
                code: 'TOO_MANY_REQUESTS',
                message: `Monthly limit for ${metric} reached (${limit}). Upgrade your plan for more.`,
            });
        }
    },
};
