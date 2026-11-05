import { prisma } from '@bin-tracker/db';
import type { Prisma } from '@prisma/client';
import type {
    AttendanceApproveSessionInput,
    AttendanceScanInput,
    AttendanceSummaryInput,
    AttendanceRecentInput,
} from '@bin-tracker/validators';
import type {
    AttendanceScanResult,
    EmployeeHoursSummary,
} from '@bin-tracker/types';
import { TRPCError } from '@trpc/server';
import { AppError } from '../lib/app-error.js';
import { periodOf } from '../lib/period.js';
import { withLock } from '../lib/with-lock.js';
import { assertAttendanceMethod } from '../lib/attendance-method.js';
import { MAX_SHIFT_MS, closeIfStale, punchInTx, type PunchResult } from './attendance-punch.js';

function diffMinutes(start: Date, end: Date): number {
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

/** A QR scan uses a BOTH card's rule, so it can only check in or out. */
function toScanResult(
    employee: { fullName: string; employeeCode: string },
    result: PunchResult,
): AttendanceScanResult {
    if (result.status !== 'CHECK_IN' && result.status !== 'CHECK_OUT') {
        throw new Error(`Unexpected punch outcome ${result.status} for a QR scan`);
    }
    return {
        action: result.status,
        employeeName: employee.fullName,
        employeeCode: employee.employeeCode,
        sessionId: result.sessionId,
        occurredAt: result.at,
        durationMin: result.status === 'CHECK_OUT' ? result.durationMin : null,
        debounced: result.debounced,
    };
}

export const attendanceService = {
    /**
     * Toggle attendance on a QR scan.
     *
     * - No open session -> opens one (CHECK_IN).
     * - Open session exists -> closes it and records duration (CHECK_OUT).
     * - A scan within the debounce window echoes the previous result.
     * - An open session 16 h or older is auto-closed first (held for manager
     *   approval) and the scan then opens a fresh shift.
     *
     * Runs through the same core as the NFC tap (attendance-punch.ts): a
     * per-employee lock plus the one-open-shift unique index, so a double-tap or
     * a rush cannot open two sessions.
     */
    async scan(orgId: string, input: AttendanceScanInput): Promise<AttendanceScanResult> {
        // QR scanning is the original method: kept, but only usable while the organization is on QR.
        await assertAttendanceMethod(orgId, 'QR');
        // qrCode is unique per-organization — look up via the compound key so a
        // badge from another org's namespace can never resolve here.
        const employee = await prisma.employee.findUnique({
            where: { organizationId_qrCode: { organizationId: orgId, qrCode: input.qrCode } },
        });

        if (!employee) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Unrecognized QR code. This badge is not registered.',
            });
        }

        if (employee.status !== 'ACTIVE') {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'This employee is inactive and cannot be scanned.',
            });
        }

        const result = await withLock(
            `employee:${employee.id}`,
            (tx) =>
                punchInTx(tx, {
                    employeeId: employee.id,
                    direction: 'BOTH',
                    now: new Date(),
                    source: input.source ?? null,
                    debounceOn: ['CHECK_IN', 'CHECK_OUT'],
                }),
            { retryOn: ['P2002'] },
        );
        return toScanResult(employee, result);
    },

    /**
     * Per-employee total hours over an optional window (by check-in time).
     * Closed sessions use their recorded duration; an open session counts
     * elapsed time up to "now".
     */
    async summary(orgId: string, input: AttendanceSummaryInput): Promise<EmployeeHoursSummary[]> {
        const now = new Date();
        const from = input.from ? new Date(input.from) : undefined;
        const to = input.to ? new Date(input.to) : undefined;

        const checkInFilter: Prisma.WorkSessionWhereInput['checkInAt'] | undefined =
            from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } : undefined;

        const employees = await prisma.employee.findMany({
            where: { organizationId: orgId },
            orderBy: { fullName: 'asc' },
            include: {
                sessions: {
                    where: checkInFilter ? { checkInAt: checkInFilter } : undefined,
                },
            },
        });

        return employees.map((employee): EmployeeHoursSummary => {
            let totalMinutes = 0;
            let openSession = false;

            for (const session of employee.sessions) {
                if (session.checkOutAt) {
                    totalMinutes += session.durationMin ?? diffMinutes(session.checkInAt, session.checkOutAt);
                } else {
                    openSession = true;
                    totalMinutes += diffMinutes(session.checkInAt, now);
                }
            }

            return {
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                fullName: employee.fullName,
                department: employee.department,
                totalMinutes,
                sessionCount: employee.sessions.length,
                openSession,
            };
        });
    },

    /** Recent scan feed for the dashboard. */
    async recent(orgId: string, input: AttendanceRecentInput) {
        // AttendanceEvent has no organizationId column of its own — it chains
        // through Employee, so the org boundary is enforced via relation filter.
        // NFC bookkeeping rows (DEBOUNCED / REJECTED / REGISTERED) are not scans.
        const events = await prisma.attendanceEvent.findMany({
            where: { employee: { organizationId: orgId }, eventType: { in: ['CHECK_IN', 'CHECK_OUT'] } },
            orderBy: { scannedAt: 'desc' },
            take: input.limit,
            include: { employee: true },
        });

        return events.map((event) => ({
            id: event.id,
            eventType: event.eventType,
            scannedAt: event.scannedAt,
            employeeName: event.employee.fullName,
            employeeCode: event.employee.employeeCode,
            source: event.source,
        }));
    },

    /**
     * Closes this organization's forgotten check-outs (open longer than the max
     * shift): capped at the max, flagged autoClosed, no approvedAt — so payroll
     * reports them as AUTO_CLOSED exceptions until a manager approves. Scoped to
     * one org, one employee at a time under that employee's lock, so it never
     * touches another tenant and never races a live tap. Called lazily before a
     * payroll run; there is deliberately no background job.
     */
    async closeStaleSessions(orgId: string, now: Date = new Date()): Promise<{ closed: number }> {
        const cutoff = new Date(now.getTime() - MAX_SHIFT_MS);
        const stale = await prisma.workSession.findMany({ where: { checkOutAt: null, checkInAt: { lte: cutoff }, employee: { organizationId: orgId } }, select: { employeeId: true }, distinct: ['employeeId'] });

        let closed = 0;
        for (const { employeeId } of stale) {
            const didClose = await withLock(`employee:${employeeId}`, async (tx) => {
                const open = await tx.workSession.findFirst({
                    where: { employeeId, checkOutAt: null },
                    orderBy: { checkInAt: 'desc' },
                    select: { id: true, checkInAt: true },
                });
                return closeIfStale(tx, employeeId, open, now);
            });
            if (didClose) closed++;
        }
        return { closed };
    },

    /**
     * Who is in the building right now, derived from open shifts. Read-only (it
     * never auto-closes anything). Every ACTIVE employee falls in exactly one
     * bucket: checkedIn (open shift under the max), overdue (open shift at or
     * over it — almost certainly a forgotten check-out, so not counted as
     * "in the building"), or checkedOut. Inactive employees are only counted.
     *
     * Selects names and codes only: no pay rate and no QR code leave this method.
     */
    async facilityStatus(orgId: string, now: Date = new Date()) {
        const employees = await prisma.employee.findMany({
            where: { organizationId: orgId },
            orderBy: { fullName: 'asc' },
            select: {
                id: true,
                fullName: true,
                employeeCode: true,
                status: true,
                sessions: { where: { checkOutAt: null }, orderBy: { checkInAt: 'desc' }, take: 1, select: { checkInAt: true } },
                deviceSessions: { where: { revokedAt: null }, take: 1, select: { id: true } },
            },
        });

        const active = employees.filter((e) => e.status === 'ACTIVE');
        const outIds = active.filter((e) => e.sessions.length === 0).map((e) => e.id);
        const lastOut = outIds.length
            ? await prisma.workSession.groupBy({ by: ['employeeId'], where: { employee: { organizationId: orgId }, employeeId: { in: outIds }, checkOutAt: { not: null } }, _max: { checkOutAt: true } })
            : [];
        const lastOutById = new Map(lastOut.map((g) => [g.employeeId, g._max.checkOutAt]));

        type Present = { employeeId: string; fullName: string; employeeCode: string; since: Date };
        const checkedIn: Present[] = [];
        const overdue: Present[] = [];
        const checkedOut: Array<{ employeeId: string; fullName: string; employeeCode: string; lastCheckOutAt: Date | null }> = [];
        for (const e of active) {
            const open = e.sessions[0];
            if (open) {
                const isOverdue = now.getTime() - open.checkInAt.getTime() >= MAX_SHIFT_MS;
                (isOverdue ? overdue : checkedIn).push({ employeeId: e.id, fullName: e.fullName, employeeCode: e.employeeCode, since: open.checkInAt });
            } else {
                checkedOut.push({ employeeId: e.id, fullName: e.fullName, employeeCode: e.employeeCode, lastCheckOutAt: lastOutById.get(e.id) ?? null });
            }
        }
        const longestFirst = (a: Present, b: Present) => a.since.getTime() - b.since.getTime();
        checkedIn.sort(longestFirst);
        overdue.sort(longestFirst);

        return {
            asOf: now,
            totals: {
                employees: employees.length,
                active: active.length,
                inactive: employees.length - active.length,
                checkedIn: checkedIn.length,
                overdue: overdue.length,
                checkedOut: checkedOut.length,
                /** Active employees with no registered phone: they cannot tap yet. */
                unregistered: active.filter((e) => e.deviceSessions.length === 0).length,
            },
            checkedIn,
            overdue,
            checkedOut,
        };
    },

    /** Auto-closed sessions waiting for a manager, newest first. */
    async listPendingApprovals(orgId: string) {
        return prisma.workSession.findMany({
            where: { autoClosed: true, approvedAt: null, employee: { organizationId: orgId } },
            orderBy: { checkInAt: 'desc' },
            select: {
                id: true,
                checkInAt: true,
                checkOutAt: true,
                durationMin: true,
                employee: { select: { id: true, fullName: true, employeeCode: true } },
            },
        });
    },

    /**
     * Manager review of an auto-closed session — NOT a general "edit any session"
     * tool. Without `checkOutAt` the capped shift is approved as-is; with a later
     * (or earlier) real one, that time is used. Until approved, payroll holds it
     * as an exception. Runs under the employee's lock so a concurrent tap or a
     * second approver cannot interleave.
     */
    async approveWorkSession(orgId: string, actorId: string | null, input: AttendanceApproveSessionInput, now: Date = new Date()) {
        const found = await prisma.workSession.findFirst({ where: { id: input.id, employee: { organizationId: orgId } }, select: { employeeId: true } });
        if (!found) throw new AppError('WORK_SESSION_NOT_FOUND', 'NOT_FOUND');

        return withLock(`employee:${found.employeeId}`, async (tx) => {
            const session = await tx.workSession.findUnique({ where: { id: input.id } });
            if (!session) throw new AppError('WORK_SESSION_NOT_FOUND', 'NOT_FOUND');
            if (!session.autoClosed) throw new AppError('NOT_AUTO_CLOSED', 'BAD_REQUEST');
            if (session.approvedAt) throw new AppError('ALREADY_APPROVED', 'CONFLICT');

            // Approving adds hours to a payroll period. If that period's run has already
            // left DRAFT it can never be recomputed (computeRun refuses), so the hours
            // would silently never be paid. Refuse, so the manager knows to handle it.
            const settings = await tx.settings.findUnique({ where: { organizationId: orgId }, select: { companyTimezone: true } });
            const period = periodOf(session.checkInAt, settings?.companyTimezone ?? 'UTC');
            const run = await tx.payrollRun.findUnique({ where: { organizationId_period: { organizationId: orgId, period } }, select: { status: true } });
            if (run && run.status !== 'DRAFT') {
                throw new AppError('PAYROLL_RUN_FROZEN', 'CONFLICT', `Payroll for ${period} is already ${run.status}, so these hours cannot be added to it.`);
            }

            const data: Prisma.WorkSessionUpdateInput = { approvedAt: now };
            let checkOutAt = session.checkOutAt;
            if (input.checkOutAt) {
                checkOutAt = new Date(input.checkOutAt);
                if (checkOutAt.getTime() <= session.checkInAt.getTime() || checkOutAt.getTime() > now.getTime()) {
                    throw new AppError('INVALID_CHECK_OUT', 'BAD_REQUEST', 'Check-out must be after check-in and not in the future');
                }
                // The same 16 h cap as the auto-close and as Payroll's "Fix checkout": one policy, two doors.
                if (checkOutAt.getTime() - session.checkInAt.getTime() > MAX_SHIFT_MS) {
                    throw new AppError('SHIFT_TOO_LONG', 'BAD_REQUEST', 'A shift longer than 16 hours cannot be approved. Split it instead.');
                }
                data.checkOutAt = checkOutAt;
                data.durationMin = diffMinutes(session.checkInAt, checkOutAt);
            }

            // The (possibly unchanged) check-out must not run into the employee's NEXT shift,
            // open or closed, or those minutes would be paid twice. Ending exactly when the next
            // shift begins is fine. Checked on the as-is path too: it is not only the manager's
            // typed time that can overlap (e.g. older duplicates closed by the migration).
            if (checkOutAt) {
                const next = await tx.workSession.findFirst({
                    where: { employeeId: session.employeeId, checkInAt: { gt: session.checkInAt } },
                    orderBy: { checkInAt: 'asc' },
                    select: { checkInAt: true },
                });
                if (next && checkOutAt.getTime() > next.checkInAt.getTime()) {
                    throw new AppError('OVERLAPS_NEXT_SESSION', 'BAD_REQUEST', "Check-out overlaps the employee's next shift");
                }
            }

            const updated = await tx.workSession.update({ where: { id: session.id }, data });
            // Approving unpaid hours into payroll is a money decision: leave a trail.
            if (actorId) {
                await tx.payrollAuditLog.create({
                    data: {
                        orgId,
                        actorId,
                        action: 'attendance.approveSession',
                        targetId: session.id,
                        oldValue: { checkOutAt: session.checkOutAt, durationMin: session.durationMin },
                        newValue: { checkOutAt: updated.checkOutAt, durationMin: updated.durationMin },
                    },
                });
            }
            return { id: updated.id, checkOutAt: updated.checkOutAt, durationMin: updated.durationMin, approvedAt: updated.approvedAt };
        });
    },
};
