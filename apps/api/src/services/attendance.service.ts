import { TRPCError } from '@trpc/server';
import { prisma } from '@bin-tracker/db';
import type { Prisma } from '@prisma/client';
import type {
    AttendanceScanInput,
    AttendanceSummaryInput,
    AttendanceRecentInput,
} from '@bin-tracker/validators';
import type {
    AttendanceScanResult,
    EmployeeHoursSummary,
} from '@bin-tracker/types';

/** Repeated scans within this window are treated as accidental duplicates. */
const DEBOUNCE_MS = 5_000;
/** Sessions left open longer than this are auto-closed by the maintenance job. */
const MAX_SHIFT_MS = 16 * 60 * 60 * 1000;

function diffMinutes(start: Date, end: Date): number {
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

export const attendanceService = {
    /**
     * Toggle attendance on a QR scan.
     *
     * - No open session -> opens one (CHECK_IN).
     * - Open session exists -> closes it and records duration (CHECK_OUT).
     * - A scan within DEBOUNCE_MS of the previous one is ignored (idempotent).
     *
     * Runs Serializable to prevent a double-tap from opening two sessions.
     */
    async scan(orgId: string, input: AttendanceScanInput): Promise<AttendanceScanResult> {
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

        return prisma.$transaction(
            async (tx: Prisma.TransactionClient): Promise<AttendanceScanResult> => {
                const now = new Date();

                // Debounce: ignore an accidental re-scan of the same badge.
                const lastEvent = await tx.attendanceEvent.findFirst({
                    where: { employeeId: employee.id },
                    orderBy: { scannedAt: 'desc' },
                    include: { session: true },
                });

                if (
                    lastEvent &&
                    now.getTime() - lastEvent.scannedAt.getTime() < DEBOUNCE_MS
                ) {
                    return {
                        action: lastEvent.eventType,
                        employeeName: employee.fullName,
                        employeeCode: employee.employeeCode,
                        sessionId: lastEvent.sessionId,
                        occurredAt: lastEvent.scannedAt,
                        durationMin: lastEvent.session.durationMin,
                        debounced: true,
                    };
                }

                const openSession = await tx.workSession.findFirst({
                    where: { employeeId: employee.id, checkOutAt: null },
                    orderBy: { checkInAt: 'desc' },
                });

                if (openSession) {
                    const durationMin = diffMinutes(openSession.checkInAt, now);
                    const closed = await tx.workSession.update({
                        where: { id: openSession.id },
                        data: { checkOutAt: now, durationMin },
                    });
                    await tx.attendanceEvent.create({
                        data: {
                            employeeId: employee.id,
                            sessionId: closed.id,
                            eventType: 'CHECK_OUT',
                            scannedAt: now,
                            source: input.source ?? null,
                        },
                    });

                    return {
                        action: 'CHECK_OUT',
                        employeeName: employee.fullName,
                        employeeCode: employee.employeeCode,
                        sessionId: closed.id,
                        occurredAt: now,
                        durationMin,
                        debounced: false,
                    };
                }

                const session = await tx.workSession.create({
                    data: { employeeId: employee.id, checkInAt: now },
                });
                await tx.attendanceEvent.create({
                    data: {
                        employeeId: employee.id,
                        sessionId: session.id,
                        eventType: 'CHECK_IN',
                        scannedAt: now,
                        source: input.source ?? null,
                    },
                });

                return {
                    action: 'CHECK_IN',
                    employeeName: employee.fullName,
                    employeeCode: employee.employeeCode,
                    sessionId: session.id,
                    occurredAt: now,
                    durationMin: null,
                    debounced: false,
                };
            },
            { isolationLevel: 'Serializable' },
        );
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
        const events = await prisma.attendanceEvent.findMany({
            where: { employee: { organizationId: orgId } },
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
     * Close sessions left open beyond MAX_SHIFT_MS (forgotten check-outs).
     * Caps duration at the max shift and flags the session as auto-closed.
     * Intended to be run on a schedule.
     */
    async autoCloseStaleSessions(): Promise<{ closed: number }> {
        const now = new Date();
        const cutoff = new Date(now.getTime() - MAX_SHIFT_MS);
        const maxShiftMinutes = Math.round(MAX_SHIFT_MS / 60_000);

        const stale = await prisma.workSession.findMany({
            where: { checkOutAt: null, checkInAt: { lt: cutoff } },
        });

        for (const session of stale) {
            const closeAt = new Date(session.checkInAt.getTime() + MAX_SHIFT_MS);
            await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                await tx.workSession.update({
                    where: { id: session.id },
                    data: {
                        checkOutAt: closeAt,
                        durationMin: maxShiftMinutes,
                        autoClosed: true,
                    },
                });
                await tx.attendanceEvent.create({
                    data: {
                        employeeId: session.employeeId,
                        sessionId: session.id,
                        eventType: 'CHECK_OUT',
                        scannedAt: closeAt,
                        source: 'auto-close',
                    },
                });
            });
        }

        return { closed: stale.length };
    },
};
