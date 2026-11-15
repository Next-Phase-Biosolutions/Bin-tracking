import { MAX_SHIFT_MS } from '../services/attendance-punch.js';
import { dayDiff, localDateOf } from './period.js';

/** One work session as read from the database for the day being viewed. */
export interface LogSessionRow {
    id: string;
    employeeId: string;
    fullName: string;
    employeeCode: string;
    checkInAt: Date;
    checkOutAt: Date | null;
    durationMin: number | null;
    autoClosed: boolean;
    approvedAt: Date | null;
}

/**
 * COMPLETE      checked out (or an auto-closed shift a manager approved): counts towards pay.
 * IN_PROGRESS   no check-out yet, under the 16 h cap.
 * OVERDUE       no check-out and open 16 h or more: a forgotten check-out the system will close on the next tap or payroll run.
 * AUTO_CLOSED   closed by the system at 16 h and not yet approved: shown, but NOT counted (payroll holds it too).
 */
export type SessionState = 'COMPLETE' | 'IN_PROGRESS' | 'OVERDUE' | 'AUTO_CLOSED';
export type RowStatus = SessionState;

export interface LogSession {
    id: string;
    checkInAt: Date;
    checkOutAt: Date | null;
    /** Minutes this session contributes to the day total; null when it is not (yet) counted. */
    countedMinutes: number | null;
    /** What the session lasted, even if it is not counted (an unapproved auto-closed shift is 960). */
    minutes: number | null;
    state: SessionState;
    /** The clock-out fell on a later calendar day than the day being viewed (an overnight shift). */
    checkOutDayOffset: number;
}

export interface LogEmployeeRow {
    employeeId: string;
    fullName: string;
    employeeCode: string;
    /** Earliest clock-in of the day. */
    firstIn: Date;
    /** Clock-out of the LAST session, or null while that session is still open. */
    lastOut: Date | null;
    lastOutDayOffset: number;
    /** Sum of the counted sessions. NOT last-out minus first-in: breaks are not worked time. */
    totalMinutes: number;
    sessionCount: number;
    /** Time between one session ending and the next starting. */
    breakMinutes: number;
    status: RowStatus;
    sessions: LogSession[];
}

export interface DayLog {
    date: string;
    timezone: string;
    summary: { employees: number; totalMinutes: number; stillIn: number; overdue: number; awaitingApproval: number };
    rows: LogEmployeeRow[];
}

const diffMinutes = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));

/** How a single session counts, using the same rule payroll uses to decide what it pays. */
function classify(row: LogSessionRow, now: Date): { state: SessionState; minutes: number | null; counted: number | null } {
    if (!row.checkOutAt) {
        const overdue = now.getTime() - row.checkInAt.getTime() >= MAX_SHIFT_MS;
        return { state: overdue ? 'OVERDUE' : 'IN_PROGRESS', minutes: null, counted: null };
    }
    const minutes = row.durationMin ?? diffMinutes(row.checkInAt, row.checkOutAt);
    if (row.autoClosed && !row.approvedAt) return { state: 'AUTO_CLOSED', minutes, counted: null };
    return { state: 'COMPLETE', minutes, counted: minutes };
}

const STATUS_PRIORITY: SessionState[] = ['AUTO_CLOSED', 'OVERDUE', 'IN_PROGRESS', 'COMPLETE'];

/**
 * Builds one day's log from that day's sessions (those whose CLOCK-IN falls on `date` in the company timezone).
 *
 * One row per employee. A day with several clock-ins shows the first clock-in and the last clock-out, but the total
 * is the SUM of the counted sessions, so it always equals what payroll pays (an 8:00 to 12:00 and 12:45 to 17:15 day is
 * 8h 30m, not the 9h 15m between first in and last out). Pure: no database, no clock except `now`.
 */
export function buildDayLog(rows: LogSessionRow[], date: string, timezone: string, now: Date): DayLog {
    const byEmployee = new Map<string, LogSessionRow[]>();
    for (const r of rows) {
        const list = byEmployee.get(r.employeeId);
        if (list) list.push(r);
        else byEmployee.set(r.employeeId, [r]);
    }

    const result: LogEmployeeRow[] = [];
    for (const list of byEmployee.values()) {
        list.sort((a, b) => a.checkInAt.getTime() - b.checkInAt.getTime() || a.id.localeCompare(b.id));
        const sessions: LogSession[] = list.map((r) => {
            const c = classify(r, now);
            return {
                id: r.id,
                checkInAt: r.checkInAt,
                checkOutAt: r.checkOutAt,
                countedMinutes: c.counted,
                minutes: c.minutes,
                state: c.state,
                checkOutDayOffset: r.checkOutAt ? Math.max(0, dayDiff(date, localDateOf(r.checkOutAt, timezone))) : 0,
            };
        });

        let breakMinutes = 0;
        for (let i = 1; i < sessions.length; i++) {
            const prevOut = sessions[i - 1]!.checkOutAt;
            if (prevOut) breakMinutes += diffMinutes(prevOut, sessions[i]!.checkInAt);
        }
        const last = sessions[sessions.length - 1]!;
        const first = list[0]!;
        result.push({
            employeeId: first.employeeId,
            fullName: first.fullName,
            employeeCode: first.employeeCode,
            firstIn: sessions[0]!.checkInAt,
            lastOut: last.checkOutAt,
            lastOutDayOffset: last.checkOutDayOffset,
            totalMinutes: sessions.reduce((sum, s) => sum + (s.countedMinutes ?? 0), 0),
            sessionCount: sessions.length,
            breakMinutes,
            status: STATUS_PRIORITY.find((st) => sessions.some((s) => s.state === st)) ?? 'COMPLETE',
            sessions,
        });
    }
    result.sort((a, b) => a.fullName.localeCompare(b.fullName) || a.employeeCode.localeCompare(b.employeeCode));

    return {
        date,
        timezone,
        summary: {
            employees: result.length,
            totalMinutes: result.reduce((sum, r) => sum + r.totalMinutes, 0),
            stillIn: result.filter((r) => r.sessions.some((s) => s.state === 'IN_PROGRESS')).length,
            overdue: result.filter((r) => r.sessions.some((s) => s.state === 'OVERDUE')).length,
            awaitingApproval: result.filter((r) => r.sessions.some((s) => s.state === 'AUTO_CLOSED')).length,
        },
        rows: result,
    };
}
