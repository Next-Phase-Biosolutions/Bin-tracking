import type { DayData } from './DayLog';

type Row = DayData['rows'][number];
type Session = Row['sessions'][number];

const d = (iso: string) => new Date(iso);
let seq = 0;

export function session(inIso: string, outIso: string | null, over: Partial<Session> = {}): Session {
    seq += 1;
    const minutes = outIso ? Math.round((d(outIso).getTime() - d(inIso).getTime()) / 60_000) : null;
    return { id: `s${seq}`, checkInAt: d(inIso), checkOutAt: outIso ? d(outIso) : null, minutes, countedMinutes: minutes, state: outIso ? 'COMPLETE' : 'IN_PROGRESS', checkOutDayOffset: 0, ...over };
}

export function row(name: string, code: string, sessions: Session[], over: Partial<Row> = {}): Row {
    const last = sessions[sessions.length - 1]!;
    const total = sessions.reduce((sum, s) => sum + (s.countedMinutes ?? 0), 0);
    let breakMinutes = 0;
    for (let i = 1; i < sessions.length; i++) if (sessions[i - 1]!.checkOutAt) breakMinutes += Math.round((sessions[i]!.checkInAt.getTime() - sessions[i - 1]!.checkOutAt!.getTime()) / 60_000);
    return {
        employeeId: `id-${code}`,
        fullName: name,
        employeeCode: code,
        firstIn: sessions[0]!.checkInAt,
        lastOut: last.checkOutAt,
        lastOutDayOffset: last.checkOutDayOffset,
        totalMinutes: total,
        sessionCount: sessions.length,
        breakMinutes,
        status: 'COMPLETE',
        sessions,
        ...over,
    } as Row;
}

/** The example day from the design mockup (Wednesday 14 January 2026, Toronto, UTC-5). */
export function exampleDay(): DayData {
    const alice = row('Alice Tremblay', 'EMP-100001', [session('2026-01-14T13:55:00Z', '2026-01-14T22:03:00Z')]);
    const bob = row('Bob Okafor', 'EMP-100002', [session('2026-01-14T12:58:00Z', '2026-01-14T17:02:00Z'), session('2026-01-14T17:47:00Z', '2026-01-14T22:01:00Z')]);
    const carol = row('Carol Singh', 'EMP-100003', [session('2026-01-14T14:02:00Z', null)], { status: 'IN_PROGRESS' });
    const evan = row('Evan Park', 'EMP-100005', [session('2026-01-15T03:05:00Z', '2026-01-15T11:10:00Z', { checkOutDayOffset: 1 })], { lastOutDayOffset: 1 });
    const frank = row('Frank Lee', 'EMP-100006', [session('2026-01-14T13:30:00Z', '2026-01-15T05:30:00Z', { state: 'AUTO_CLOSED', countedMinutes: null, checkOutDayOffset: 1 })], { status: 'AUTO_CLOSED', totalMinutes: 0, lastOutDayOffset: 1 });
    return {
        date: '2026-01-14',
        timezone: 'America/Toronto',
        summary: { employees: 5, totalMinutes: 488 + 498 + 485, stillIn: 1, overdue: 0, awaitingApproval: 1 },
        rows: [alice, bob, carol, evan, frank],
    } as DayData;
}

export const emptyDay = (date = '2026-01-04'): DayData => ({ date, timezone: 'America/Toronto', summary: { employees: 0, totalMinutes: 0, stillIn: 0, overdue: 0, awaitingApproval: 0 }, rows: [] });

export const monthData = (year: number, month: number, days: Array<[string, number]>, today = '2026-02-10') => ({
    timezone: 'America/Toronto',
    today,
    year,
    month,
    days: days.map(([date, employees]) => ({ date, employees })),
});
