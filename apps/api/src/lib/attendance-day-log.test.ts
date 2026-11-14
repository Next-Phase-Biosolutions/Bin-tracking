import { describe, expect, it } from 'vitest';
import { buildDayLog, type LogSessionRow } from './attendance-day-log.js';

const TZ = 'America/Toronto';
const NOW = new Date('2026-01-20T18:00:00Z');
const at = (iso: string) => new Date(iso);
let n = 0;
/** A session row; times are given in UTC (Toronto is UTC-5 in January). */
function row(employeeId: string, name: string, inUtc: string, outUtc: string | null, over: Partial<LogSessionRow> = {}): LogSessionRow {
    n += 1;
    return {
        id: `s${String(n).padStart(3, '0')}`,
        employeeId,
        fullName: name,
        employeeCode: `EMP-${employeeId}`,
        checkInAt: at(inUtc),
        checkOutAt: outUtc ? at(outUtc) : null,
        durationMin: outUtc ? Math.round((at(outUtc).getTime() - at(inUtc).getTime()) / 60_000) : null,
        autoClosed: false,
        approvedAt: null,
        ...over,
    };
}
const log = (rows: LogSessionRow[], date = '2026-01-14', now = NOW) => buildDayLog(rows, date, TZ, now);

describe('buildDayLog: one simple shift', () => {
    it('gives first in, last out and the minutes worked', () => {
        const d = log([row('1', 'Alice', '2026-01-14T13:55:00Z', '2026-01-14T22:03:00Z')]);

        expect(d.rows).toHaveLength(1);
        expect(d.rows[0]).toMatchObject({ fullName: 'Alice', totalMinutes: 488, sessionCount: 1, breakMinutes: 0, status: 'COMPLETE', lastOutDayOffset: 0 });
        expect(d.rows[0]!.firstIn).toEqual(at('2026-01-14T13:55:00Z'));
        expect(d.rows[0]!.lastOut).toEqual(at('2026-01-14T22:03:00Z'));
    });

    it('is empty for a day with no sessions', () => {
        const d = log([]);

        expect(d.rows).toEqual([]);
        expect(d.summary).toEqual({ employees: 0, totalMinutes: 0, stillIn: 0, overdue: 0, awaitingApproval: 0 });
    });
});

describe('buildDayLog: several clock-ins in a day (the total is the SUM, not last out minus first in)', () => {
    const bob = [
        row('2', 'Bob', '2026-01-14T12:58:00Z', '2026-01-14T17:02:00Z'), // 4h 04m
        row('2', 'Bob', '2026-01-14T17:47:00Z', '2026-01-14T22:01:00Z'), // 4h 14m, after a 45 minute break
    ];

    it('shows the first clock-in and the last clock-out but totals the sessions: 8h 18m, not 9h 03m', () => {
        const [r] = log(bob).rows;

        expect(r!.firstIn).toEqual(at('2026-01-14T12:58:00Z'));
        expect(r!.lastOut).toEqual(at('2026-01-14T22:01:00Z'));
        expect(r!.totalMinutes).toBe(498); // 8h 18m
        expect(r!.totalMinutes).not.toBe(543); // the 9h 03m between first in and last out
        expect(r!.sessionCount).toBe(2);
    });

    it('reports the break between sessions', () => {
        expect(log(bob).rows[0]!.breakMinutes).toBe(45);
    });

    it('sorts the sessions by clock-in even when they arrive out of order', () => {
        const [r] = log([bob[1]!, bob[0]!]).rows;

        expect(r!.sessions.map((s) => s.checkInAt.toISOString())).toEqual(['2026-01-14T12:58:00.000Z', '2026-01-14T17:47:00.000Z']);
        expect(r!.firstIn).toEqual(at('2026-01-14T12:58:00Z'));
    });

    it('three sessions: break time is the sum of both gaps', () => {
        const [r] = log([
            row('3', 'Cy', '2026-01-14T13:00:00Z', '2026-01-14T15:00:00Z'),
            row('3', 'Cy', '2026-01-14T15:30:00Z', '2026-01-14T18:00:00Z'), // 30 min break
            row('3', 'Cy', '2026-01-14T19:00:00Z', '2026-01-14T21:00:00Z'), // 60 min break
        ]).rows;

        expect(r!.breakMinutes).toBe(90);
        expect(r!.totalMinutes).toBe(120 + 150 + 120);
    });
});

describe('buildDayLog: still in, and forgotten check-outs', () => {
    it('an open shift under 16 h is IN_PROGRESS: no clock-out, nothing counted yet', () => {
        const d = log([row('4', 'Carol', '2026-01-20T14:02:00Z', null)], '2026-01-20');

        expect(d.rows[0]).toMatchObject({ lastOut: null, totalMinutes: 0, status: 'IN_PROGRESS' });
        expect(d.rows[0]!.sessions[0]).toMatchObject({ state: 'IN_PROGRESS', minutes: null, countedMinutes: null });
        expect(d.summary).toMatchObject({ stillIn: 1, overdue: 0 });
    });

    it('an open shift of exactly 16 h is OVERDUE (a forgotten check-out), 15 h 59 m is not', () => {
        const edge = log([row('5', 'Dan', '2026-01-20T02:00:00Z', null)], '2026-01-19').rows[0]!; // 16 h before NOW
        const under = log([row('5', 'Dan', '2026-01-20T02:01:00Z', null)], '2026-01-19').rows[0]!;

        expect(edge.status).toBe('OVERDUE');
        expect(under.status).toBe('IN_PROGRESS');
    });

    it('an auto-closed shift nobody has approved is shown but NOT counted, and is flagged for approval', () => {
        const d = log([row('6', 'Frank', '2026-01-14T13:30:00Z', '2026-01-15T05:30:00Z', { autoClosed: true, durationMin: 960 })]);

        expect(d.rows[0]).toMatchObject({ totalMinutes: 0, status: 'AUTO_CLOSED' });
        expect(d.rows[0]!.sessions[0]).toMatchObject({ state: 'AUTO_CLOSED', minutes: 960, countedMinutes: null });
        expect(d.summary).toMatchObject({ totalMinutes: 0, awaitingApproval: 1 });
    });

    it('once a manager approves it, it counts like any other shift', () => {
        const d = log([row('6', 'Frank', '2026-01-14T13:30:00Z', '2026-01-15T05:30:00Z', { autoClosed: true, durationMin: 960, approvedAt: at('2026-01-16T10:00:00Z') })]);

        expect(d.rows[0]).toMatchObject({ totalMinutes: 960, status: 'COMPLETE' });
        expect(d.summary.awaitingApproval).toBe(0);
    });

    it('a day with a good shift and a forgotten one totals only the good one, and the row is flagged', () => {
        const [r] = log([
            row('7', 'Gus', '2026-01-14T13:00:00Z', '2026-01-14T17:00:00Z'), // 4 h
            row('7', 'Gus', '2026-01-14T18:00:00Z', '2026-01-15T10:00:00Z', { autoClosed: true, durationMin: 960 }),
        ]).rows;

        expect(r!.totalMinutes).toBe(240);
        expect(r!.status).toBe('AUTO_CLOSED');
    });

    it('a finished morning shift and an afternoon shift still open: total is the morning, clock-out is blank', () => {
        const [r] = log([
            row('8', 'Hal', '2026-01-20T13:00:00Z', '2026-01-20T17:00:00Z'),
            row('8', 'Hal', '2026-01-20T17:45:00Z', null),
        ], '2026-01-20').rows;

        expect(r).toMatchObject({ totalMinutes: 240, lastOut: null, status: 'IN_PROGRESS', breakMinutes: 45 });
    });

    it('status priority: forgotten beats overdue beats in progress beats complete', () => {
        const [r] = log([
            row('9', 'Ivy', '2026-01-14T13:00:00Z', '2026-01-14T17:00:00Z'),
            row('9', 'Ivy', '2026-01-14T18:00:00Z', '2026-01-15T10:00:00Z', { autoClosed: true, durationMin: 960 }),
            row('9', 'Ivy', '2026-01-14T20:00:00Z', null),
        ]).rows;

        expect(r!.status).toBe('AUTO_CLOSED');
    });
});

describe('buildDayLog: overnight shifts and the company timezone', () => {
    it('a shift that ends after local midnight stays on the clock-in day and says so (+1 day)', () => {
        // 10:05 PM to 6:10 AM Toronto
        const [r] = log([row('10', 'Evan', '2026-01-15T03:05:00Z', '2026-01-15T11:10:00Z')]).rows;

        expect(r).toMatchObject({ totalMinutes: 485, lastOutDayOffset: 1 });
        expect(r!.sessions[0]!.checkOutDayOffset).toBe(1);
    });

    it('is judged in the company timezone, not UTC: 11:30 PM local is still the same day, 00:30 local is the next', () => {
        const before = log([row('11', 'Jo', '2026-01-14T22:00:00Z', '2026-01-15T04:30:00Z')]).rows[0]!; // out 23:30 Toronto, Jan 14
        const after = log([row('11', 'Jo', '2026-01-14T22:00:00Z', '2026-01-15T05:30:00Z')]).rows[0]!; // out 00:30 Toronto, Jan 15

        expect(before.lastOutDayOffset).toBe(0);
        expect(after.lastOutDayOffset).toBe(1);
    });

    it('works across a month end (Jan 31 to Feb 1)', () => {
        const [r] = log([row('12', 'Kim', '2026-02-01T03:00:00Z', '2026-02-01T11:00:00Z')], '2026-01-31').rows;

        expect(r!.lastOutDayOffset).toBe(1);
    });
});

describe('buildDayLog: several employees and the summary', () => {
    const rows = [
        row('2', 'Bob', '2026-01-14T12:58:00Z', '2026-01-14T17:02:00Z'),
        row('2', 'Bob', '2026-01-14T17:47:00Z', '2026-01-14T22:01:00Z'),
        row('1', 'Alice', '2026-01-14T13:55:00Z', '2026-01-14T22:03:00Z'),
        row('4', 'Carol', '2026-01-14T14:02:00Z', null),
        row('6', 'Frank', '2026-01-14T13:30:00Z', '2026-01-15T05:30:00Z', { autoClosed: true, durationMin: 960 }),
        row('10', 'Evan', '2026-01-15T03:05:00Z', '2026-01-15T11:10:00Z'),
    ];

    it('lists one row per employee, sorted by name', () => {
        expect(log(rows).rows.map((r) => r.fullName)).toEqual(['Alice', 'Bob', 'Carol', 'Evan', 'Frank']);
    });

    it('totals only what counts (the same basis as payroll) and counts who is in or awaiting approval', () => {
        const sameDay = at('2026-01-14T20:00:00Z'); // Carol clocked in six hours ago, so she is simply still in
        expect(log(rows, '2026-01-14', sameDay).summary).toEqual({ employees: 5, totalMinutes: 488 + 498 + 485, stillIn: 1, overdue: 0, awaitingApproval: 1 });
    });

    it('two employees with the same name stay separate rows (grouped by id, then ordered by code)', () => {
        const d = log([row('21', 'Sam Lee', '2026-01-14T13:00:00Z', '2026-01-14T17:00:00Z'), row('20', 'Sam Lee', '2026-01-14T13:00:00Z', '2026-01-14T17:00:00Z')]);

        expect(d.rows.map((r) => r.employeeCode)).toEqual(['EMP-20', 'EMP-21']);
    });
});

describe('buildDayLog: defensive cases', () => {
    it('uses the clock times when durationMin is missing', () => {
        const [r] = log([row('1', 'Alice', '2026-01-14T13:00:00Z', '2026-01-14T17:30:00Z', { durationMin: null })]).rows;

        expect(r!.totalMinutes).toBe(270);
    });

    it('never reports a negative break or duration if clocks disagree', () => {
        const [r] = log([
            row('1', 'Alice', '2026-01-14T13:00:00Z', '2026-01-14T17:00:00Z'),
            row('1', 'Alice', '2026-01-14T16:00:00Z', '2026-01-14T18:00:00Z'), // overlaps the first (bad data)
        ]).rows;

        expect(r!.breakMinutes).toBeGreaterThanOrEqual(0);
    });

    it('an unknown timezone falls back to UTC instead of throwing', () => {
        expect(() => buildDayLog([row('1', 'Alice', '2026-01-14T13:00:00Z', '2026-01-14T17:00:00Z')], '2026-01-14', 'Not/AZone', NOW)).not.toThrow();
    });
});
