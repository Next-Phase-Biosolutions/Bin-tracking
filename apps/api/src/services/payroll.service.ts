import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@bin-tracker/db';
import type { PayrollPeriodInput, PayrollListInput } from '@bin-tracker/validators';
import type { PayrollRunView, PayrollRunSummary } from '@bin-tracker/types';

const MINUTES_PER_HOUR = 60;

type RunWithRelations = Prisma.PayrollRunGetPayload<{
    include: {
        lineItems: { include: { employee: true } };
        exceptions: { include: { employee: true } };
    };
}>;

interface PeriodBounds {
    /** Local (company-timezone) start of the month, e.g. '2026-06-01 00:00:00'. */
    start: string;
    /** Local start of the following month (exclusive). */
    end: string;
}

/** Computes the local month boundaries for a 'YYYY-MM' period. */
function periodBounds(period: string): PeriodBounds {
    const [yearStr, monthStr] = period.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr); // 1-12
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const pad = (n: number, width: number): string => String(n).padStart(width, '0');
    return {
        start: `${period}-01 00:00:00`,
        end: `${pad(nextYear, 4)}-${pad(nextMonth, 2)}-01 00:00:00`,
    };
}

function toView(run: RunWithRelations): PayrollRunView {
    return {
        id: run.id,
        period: run.period,
        status: run.status,
        rateCents: run.rateCents,
        currency: run.currency,
        totalEmployees: run.totalEmployees,
        totalMinutes: run.totalMinutes,
        totalGrossCents: run.totalGrossCents,
        computedAt: run.computedAt,
        createdAt: run.createdAt,
        lineItems: run.lineItems.map((li) => ({
            id: li.id,
            employeeId: li.employeeId,
            employeeCode: li.employee.employeeCode,
            fullName: li.employee.fullName,
            minutes: li.minutes,
            hours: li.hours,
            rateCents: li.rateCents,
            grossCents: li.grossCents,
            payoutStatus: li.payoutStatus,
            payoutRef: li.payoutRef,
            paidAt: li.paidAt,
        })),
        exceptions: run.exceptions.map((ex) => ({
            id: ex.id,
            employeeId: ex.employeeId,
            employeeCode: ex.employee.employeeCode,
            fullName: ex.employee.fullName,
            sessionId: ex.sessionId,
            type: ex.type,
            resolved: ex.resolved,
        })),
    };
}

async function loadRunView(period: string): Promise<PayrollRunView> {
    const run = await prisma.payrollRun.findUnique({
        where: { period },
        include: {
            lineItems: {
                include: { employee: true },
                orderBy: { employee: { fullName: 'asc' } },
            },
            exceptions: {
                include: { employee: true },
                orderBy: { employee: { fullName: 'asc' } },
            },
        },
    });

    if (!run) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `No payroll run for ${period}.` });
    }

    return toView(run);
}

export const payrollService = {
    /**
     * Build (or rebuild) a month's payroll from recorded work sessions.
     *
     * - Sessions are bucketed by check-in time converted UTC -> company timezone,
     *   so a late-night shift lands in the correct calendar month (DST-aware,
     *   done in Postgres).
     * - Clean sessions (checked out, not auto-closed) sum into a per-employee
     *   line item; gross = round(hours * flat rate). Inactive employees are
     *   still paid for hours they worked.
     * - Dirty sessions (no check-out, or auto-closed) become exceptions and are
     *   excluded from pay until resolved.
     * - Idempotent while the run is DRAFT; recomputing replaces line items and
     *   exceptions. A run that is APPROVED/PAID/CANCELLED cannot be recomputed.
     * - The flat rate is snapshotted onto the run so later rate changes never
     *   rewrite history.
     */
    async computeRun(input: PayrollPeriodInput): Promise<PayrollRunView> {
        const { period } = input;

        const settings = await prisma.settings.findFirst();
        if (!settings) {
            throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: 'Payroll settings are not configured. Set the hourly rate first.',
            });
        }

        const rateCents = settings.flatHourlyRateCents;
        const tz = settings.companyTimezone;
        const currency = settings.currency;
        const { start, end } = periodBounds(period);

        const existing = await prisma.payrollRun.findUnique({ where: { period } });
        if (existing && existing.status !== 'DRAFT') {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `Payroll for ${period} is ${existing.status} and can no longer be recomputed.`,
            });
        }

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const run = await tx.payrollRun.upsert({
                where: { period },
                create: { period, rateCents, currency },
                update: {},
            });

            // Idempotent recompute: clear prior results for this run.
            await tx.payrollLineItem.deleteMany({ where: { runId: run.id } });
            await tx.payrollException.deleteMany({ where: { runId: run.id } });

            // Payable sessions: checked out and not auto-closed, bucketed by
            // local check-in month.
            const cleanRows = await tx.$queryRaw<Array<{ employeeId: string; minutes: number }>>(
                Prisma.sql`
                    SELECT "employeeId", COALESCE(SUM("durationMin"), 0)::int AS minutes
                    FROM "work_sessions"
                    WHERE "checkOutAt" IS NOT NULL
                      AND "autoClosed" = false
                      AND ("checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= ${start}::timestamp
                      AND ("checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) <  ${end}::timestamp
                    GROUP BY "employeeId"
                `,
            );

            let totalMinutes = 0;
            let totalGrossCents = 0;
            for (const row of cleanRows) {
                const minutes = row.minutes;
                const hours = minutes / MINUTES_PER_HOUR;
                const grossCents = Math.round(hours * rateCents);
                totalMinutes += minutes;
                totalGrossCents += grossCents;
                await tx.payrollLineItem.create({
                    data: { runId: run.id, employeeId: row.employeeId, minutes, hours, rateCents, grossCents },
                });
            }

            // Dirty sessions: no check-out, or auto-closed. Held back from pay.
            const exceptionRows = await tx.$queryRaw<
                Array<{ id: string; employeeId: string; checkOutAt: Date | null }>
            >(
                Prisma.sql`
                    SELECT "id", "employeeId", "checkOutAt"
                    FROM "work_sessions"
                    WHERE ("checkOutAt" IS NULL OR "autoClosed" = true)
                      AND ("checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= ${start}::timestamp
                      AND ("checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) <  ${end}::timestamp
                `,
            );

            for (const row of exceptionRows) {
                await tx.payrollException.create({
                    data: {
                        runId: run.id,
                        employeeId: row.employeeId,
                        sessionId: row.id,
                        type: row.checkOutAt === null ? 'NO_CHECKOUT' : 'AUTO_CLOSED',
                    },
                });
            }

            await tx.payrollRun.update({
                where: { id: run.id },
                data: {
                    rateCents,
                    currency,
                    totalEmployees: cleanRows.length,
                    totalMinutes,
                    totalGrossCents,
                    computedAt: new Date(),
                },
            });
        });

        return loadRunView(period);
    },

    /** Fetch a single run with its line items and exceptions. */
    async getRun(input: PayrollPeriodInput): Promise<PayrollRunView> {
        return loadRunView(input.period);
    },

    /** List recent runs, newest period first. */
    async listRuns(input: PayrollListInput): Promise<PayrollRunSummary[]> {
        const runs = await prisma.payrollRun.findMany({
            orderBy: { period: 'desc' },
            take: input.limit,
        });

        return runs.map((run) => ({
            id: run.id,
            period: run.period,
            status: run.status,
            totalEmployees: run.totalEmployees,
            totalGrossCents: run.totalGrossCents,
            currency: run.currency,
            computedAt: run.computedAt,
            createdAt: run.createdAt,
        }));
    },
};
