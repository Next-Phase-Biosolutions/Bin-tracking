import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@bin-tracker/db';
import type {
    PayrollPeriodInput,
    PayrollListInput,
    PayrollResolveExceptionInput,
} from '@bin-tracker/validators';
import type { PayrollRunView, PayrollRunSummary } from '@bin-tracker/types';

const MINUTES_PER_HOUR = 60;

/**
 * The payroll view needs exactly two employee fields (code + name), so the
 * relation is SELECTED rather than included whole. That keeps whole employee
 * rows — including the encrypted bank columns — out of every payroll query's
 * result set entirely, rather than relying on the global omit in
 * packages/db/src/client.ts to strip them afterwards. Defence in depth on the
 * one endpoint that fans an employee record out per line item.
 */
const EMPLOYEE_REF_SELECT = { employeeCode: true, fullName: true } as const;

const SESSION_REF_SELECT = { checkInAt: true } as const;

type RunWithRelations = Prisma.PayrollRunGetPayload<{
    include: {
        lineItems: { include: { employee: { select: typeof EMPLOYEE_REF_SELECT } } };
        exceptions: {
            include: {
                employee: { select: typeof EMPLOYEE_REF_SELECT };
                session: { select: typeof SESSION_REF_SELECT };
            };
        };
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
            note: ex.note,
            checkInAt: ex.session.checkInAt,
        })),
    };
}

async function loadRunView(orgId: string, period: string): Promise<PayrollRunView> {
    const run = await prisma.payrollRun.findUnique({
        where: { organizationId_period: { organizationId: orgId, period } },
        include: {
            lineItems: {
                include: { employee: { select: EMPLOYEE_REF_SELECT } },
                orderBy: { employee: { fullName: 'asc' } },
            },
            exceptions: {
                include: {
                    employee: { select: EMPLOYEE_REF_SELECT },
                    session: { select: SESSION_REF_SELECT },
                },
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
    async computeRun(orgId: string, input: PayrollPeriodInput): Promise<PayrollRunView> {
        const { period } = input;

        const settings = await prisma.settings.findUnique({ where: { organizationId: orgId } });
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

        const existing = await prisma.payrollRun.findUnique({
            where: { organizationId_period: { organizationId: orgId, period } },
        });
        if (existing && existing.status !== 'DRAFT') {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `Payroll for ${period} is ${existing.status} and can no longer be recomputed.`,
            });
        }

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Atomic create-or-update on the compound key — avoids the
            // find-then-create race where two concurrent calls for the same
            // org+period both see "not found" and the second throws P2002.
            const run = await tx.payrollRun.upsert({
                where: { organizationId_period: { organizationId: orgId, period } },
                create: { period, rateCents, currency, organizationId: orgId },
                update: {},
            });

            // Idempotent recompute: clear prior line items. Exceptions are
            // cleared EXCEPT resolved ones — a DISMISSed exception's session is
            // still dirty by definition, so a full wipe would resurrect it as
            // unresolved and lose the dismissal note. Resolved rows survive and
            // their sessions are skipped when exceptions are recreated below.
            await tx.payrollLineItem.deleteMany({ where: { runId: run.id } });
            const resolvedExceptions = await tx.payrollException.findMany({
                where: { runId: run.id, resolved: true },
                select: { sessionId: true },
            });
            const resolvedSessionIds = new Set(resolvedExceptions.map((e) => e.sessionId));
            await tx.payrollException.deleteMany({ where: { runId: run.id, resolved: false } });

            // Payable sessions: checked out and not auto-closed, bucketed by
            // local check-in month. WorkSession has no organizationId column of
            // its own, so the org boundary is enforced by joining employees.
            // hourlyRateCents is per-employee (functionally dependent on
            // employeeId, so grouping by both keeps one row per employee); NULL
            // means "use the org flat rate" resolved per line item below.
            const cleanRows = await tx.$queryRaw<
                Array<{ employeeId: string; minutes: number; hourlyRateCents: number | null }>
            >(
                Prisma.sql`
                    SELECT ws."employeeId",
                           COALESCE(SUM(ws."durationMin"), 0)::int AS minutes,
                           e."hourlyRateCents"
                    FROM "work_sessions" ws
                    JOIN "employees" e ON e."id" = ws."employeeId"
                    WHERE e."organizationId" = ${orgId}
                      AND ws."checkOutAt" IS NOT NULL
                      AND ws."autoClosed" = false
                      AND (ws."checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= ${start}::timestamp
                      AND (ws."checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) <  ${end}::timestamp
                    GROUP BY ws."employeeId", e."hourlyRateCents"
                `,
            );

            let totalMinutes = 0;
            let totalGrossCents = 0;
            for (const row of cleanRows) {
                const minutes = row.minutes;
                const hours = minutes / MINUTES_PER_HOUR;
                // Per-employee override wins; the org flat rate is the fallback.
                // The effective rate is snapshotted onto the line item so later
                // rate changes never rewrite this run's history.
                const effectiveRateCents = row.hourlyRateCents ?? rateCents;
                const grossCents = Math.round(hours * effectiveRateCents);
                totalMinutes += minutes;
                totalGrossCents += grossCents;
                await tx.payrollLineItem.create({
                    data: {
                        runId: run.id,
                        employeeId: row.employeeId,
                        minutes,
                        hours,
                        rateCents: effectiveRateCents,
                        grossCents,
                    },
                });
            }

            // Dirty sessions: no check-out, or auto-closed. Held back from pay.
            const exceptionRows = await tx.$queryRaw<
                Array<{ id: string; employeeId: string; checkOutAt: Date | null }>
            >(
                Prisma.sql`
                    SELECT ws."id", ws."employeeId", ws."checkOutAt"
                    FROM "work_sessions" ws
                    JOIN "employees" e ON e."id" = ws."employeeId"
                    WHERE e."organizationId" = ${orgId}
                      AND (ws."checkOutAt" IS NULL OR ws."autoClosed" = true)
                      AND (ws."checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) >= ${start}::timestamp
                      AND (ws."checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) <  ${end}::timestamp
                `,
            );

            for (const row of exceptionRows) {
                if (resolvedSessionIds.has(row.id)) continue; // dismissed — stays resolved
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

        return loadRunView(orgId, period);
    },

    /** Fetch a single run with its line items and exceptions. */
    async getRun(orgId: string, input: PayrollPeriodInput): Promise<PayrollRunView> {
        return loadRunView(orgId, input.period);
    },

    /**
     * Resolve one held-back exception on a DRAFT run.
     *
     * - DISMISS: acknowledged, hours stay unpaid (note records why).
     * - FIX_CHECKOUT: supplies the missing checkout time and clears autoClosed,
     *   so the session becomes clean — the caller then RECOMPUTES the run to
     *   pull the hours into pay (compute is the single source of pay math;
     *   resolution never edits line items directly).
     *
     * Restricted to DRAFT: once APPROVED/PAID the run is frozen history, and a
     * session fix would silently diverge from what was approved.
     */
    async resolveException(
        orgId: string,
        input: PayrollResolveExceptionInput,
    ): Promise<{ resolved: true; requiresRecompute: boolean }> {
        const exception = await prisma.payrollException.findUnique({
            where: { id: input.exceptionId },
            include: { run: true, session: true },
        });
        // Same discipline as getEmployeeInOrg: "someone else's" and "doesn't
        // exist" are indistinguishable.
        if (!exception || exception.run.organizationId !== orgId) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Exception not found' });
        }
        if (exception.resolved) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'This exception is already resolved.' });
        }
        if (exception.run.status !== 'DRAFT') {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: `Payroll for ${exception.run.period} is ${exception.run.status} — exceptions can only be resolved while the run is a draft.`,
            });
        }

        if (input.action === 'DISMISS') {
            await prisma.payrollException.update({
                where: { id: exception.id },
                data: { resolved: true, resolvedAt: new Date(), note: input.note ?? null },
            });
            return { resolved: true, requiresRecompute: false };
        }

        // FIX_CHECKOUT — validated present by the schema refine.
        const checkOutAt = new Date(input.checkOutAt!);
        const checkInAt = exception.session.checkInAt;
        const MAX_SHIFT_MS = 16 * 60 * 60 * 1000; // matches the auto-close policy
        if (checkOutAt.getTime() <= checkInAt.getTime()) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Checkout must be after the check-in time.' });
        }
        if (checkOutAt.getTime() - checkInAt.getTime() > MAX_SHIFT_MS) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Shifts longer than 16 hours cannot be entered — split the session instead.',
            });
        }

        const durationMin = Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60_000);
        await prisma.$transaction([
            prisma.workSession.update({
                where: { id: exception.sessionId },
                data: { checkOutAt, durationMin, autoClosed: false },
            }),
            prisma.payrollException.update({
                where: { id: exception.id },
                data: { resolved: true, resolvedAt: new Date(), note: input.note ?? null },
            }),
        ]);
        return { resolved: true, requiresRecompute: true };
    },

    /** List recent runs, newest period first. */
    async listRuns(orgId: string, input: PayrollListInput): Promise<PayrollRunSummary[]> {
        const runs = await prisma.payrollRun.findMany({
            where: { organizationId: orgId },
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
