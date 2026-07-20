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
     * and both slip past the limit. The increment and the limit check run in
     * ONE transaction — throwing rolls the increment back, so a rejected call
     * nets to zero effect on the counter, and there is no crash window between
     * an increment and a compensating decrement (the previous two-statement
     * version could permanently consume a slot if the process died between them).
     */
    async checkAndIncrement(orgId: string, metric: string, limit: number): Promise<void> {
        if (limit === -1) return;

        const period = currentPeriod();
        const where = { orgId_metric_period: { orgId, metric, period } };

        await prisma.$transaction(async (tx) => {
            const row = await tx.usageCounter.upsert({
                where,
                create: { orgId, metric, period, count: 1 },
                update: { count: { increment: 1 } },
            });

            if (row.count > limit) {
                throw new TRPCError({
                    code: 'TOO_MANY_REQUESTS',
                    message: `Monthly limit for ${metric} reached (${limit}). Upgrade your plan for more.`,
                });
            }
        });
    },

    /**
     * Read-only limit check — throws TOO_MANY_REQUESTS if the org has ALREADY
     * reached `limit` this month, without touching the counter. Pair with
     * increment() after the metered work succeeds, so a failed operation (bad
     * audio, upstream API error) never consumes a slot the way the atomic
     * checkAndIncrement would.
     */
    async check(orgId: string, metric: string, limit: number): Promise<void> {
        if (limit === -1) return;
        const period = currentPeriod();
        const row = await prisma.usageCounter.findUnique({
            where: { orgId_metric_period: { orgId, metric, period } },
            select: { count: true },
        });
        if ((row?.count ?? 0) >= limit) {
            throw new TRPCError({
                code: 'TOO_MANY_REQUESTS',
                message: `Monthly limit for ${metric} reached (${limit}). Upgrade your plan for more.`,
            });
        }
    },

    /**
     * Atomically +1 the org's monthly counter for `metric`. No limit check —
     * call check() BEFORE the metered work and increment() only AFTER it
     * succeeds.
     *
     * ponytail: check-then-increment is not atomic, so N concurrent calls that
     * all pass check() at count=limit-1 can push the counter a few over the
     * cap. Acceptable for a soft monthly cost guard; if a hard cap is ever
     * needed, go back to the atomic checkAndIncrement and refund on failure.
     */
    async increment(orgId: string, metric: string): Promise<void> {
        const period = currentPeriod();
        await prisma.usageCounter.upsert({
            where: { orgId_metric_period: { orgId, metric, period } },
            create: { orgId, metric, period, count: 1 },
            update: { count: { increment: 1 } },
        });
    },
};
