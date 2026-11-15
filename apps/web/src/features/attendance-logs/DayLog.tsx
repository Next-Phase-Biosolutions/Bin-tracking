import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RouterOutputs } from '../../lib/trpc';
import { Badge, Button, Card } from '../../components/ui/primitives';
import { buildCsv, downloadTextFile } from './csv';
import { dayOffsetLabel, formatClock, formatLongDate, formatMinutes, formatShort } from './format';

export type DayData = RouterOutputs['attendance']['logsDay'];
type Row = DayData['rows'][number];
type Session = Row['sessions'][number];

const th = 'px-3 py-2.5 text-left font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted';

/** What a row's total column says. A total is the SUM of the counted sessions; unfinished and unapproved time is explained, not added. */
function Total({ row }: { row: Row }) {
    const held = row.sessions.filter((s) => s.state === 'AUTO_CLOSED').reduce((sum, s) => sum + (s.minutes ?? 0), 0);
    const open = row.sessions.some((s) => s.state === 'IN_PROGRESS' || s.state === 'OVERDUE');
    if (row.totalMinutes === 0 && held === 0) {
        return <span className="text-muted">{row.status === 'OVERDUE' ? 'Open' : 'In progress'}</span>;
    }
    return (
        <span>
            <span className="font-semibold text-ink">{formatMinutes(row.totalMinutes)}</span>
            {open && <span className="block text-xs text-muted">more still open</span>}
            {held > 0 && <span className="block text-xs text-warn" title="Not counted until a manager approves it">+ {formatMinutes(held)} held</span>}
        </span>
    );
}

function StatusBadges({ row }: { row: Row }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {row.status === 'COMPLETE' && <Badge tone="good">Complete</Badge>}
            {row.status === 'IN_PROGRESS' && <Badge tone="active">● Still in</Badge>}
            {row.status === 'OVERDUE' && <Badge tone="pending">Forgotten check-out</Badge>}
            {row.status === 'AUTO_CLOSED' && <Badge tone="warn">Auto-closed · not paid until approved</Badge>}
            {row.sessionCount > 1 && (
                <Badge tone="idle">
                    {row.sessionCount} sessions{row.breakMinutes > 0 ? ` · break ${formatShort(row.breakMinutes)}` : ''}
                </Badge>
            )}
            {(row.status === 'OVERDUE' || row.status === 'AUTO_CLOSED') && (
                <Link to="/app/live-status" className="text-xs font-semibold text-rust hover:underline">
                    Review
                </Link>
            )}
        </div>
    );
}

const SESSION_NOTE: Record<Session['state'], string> = { COMPLETE: '', IN_PROGRESS: 'still in', OVERDUE: 'forgotten check-out', AUTO_CLOSED: 'auto-closed, held' };

function Name({ row, expanded, onToggle }: { row: Row; expanded: boolean; onToggle: () => void }) {
    const multi = row.sessionCount > 1;
    return (
        <div className="flex min-w-0 items-start gap-2">
            {multi ? (
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Hide' : 'Show'} the ${row.sessionCount} sessions for ${row.fullName}`}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-edge/40 hover:text-olive-deep"
                >
                    {expanded ? '▾' : '▸'}
                </button>
            ) : (
                <span className="w-5 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 break-words">
                <span className="font-semibold text-ink">{row.fullName}</span>
                <span className="block font-mono text-[0.7rem] text-muted">{row.employeeCode}</span>
            </span>
        </div>
    );
}

/** One day's log: a row per employee (first in, last out, summed total), sessions on demand, with a CSV export. */
export function DayLog({ day }: { day: DayData }) {
    const tz = day.timezone;
    const clock = (d: Date) => formatClock(d, tz);
    const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
    const multiIds = day.rows.filter((r) => r.sessionCount > 1).map((r) => r.employeeId);
    const toggle = (id: string) =>
        setOpen((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const allOpen = multiIds.length > 0 && multiIds.every((id) => open.has(id));
    const { summary } = day;

    return (
        <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge/60 px-5 py-3.5">
                <h2 className="font-display text-lg font-extrabold text-olive-deep">{formatLongDate(day.date)}</h2>
                <div className="flex items-center gap-2">
                    {multiIds.length > 0 && (
                        <button type="button" className="text-sm font-medium text-olive-deep hover:underline" onClick={() => setOpen(allOpen ? new Set() : new Set(multiIds))}>
                            {allOpen ? 'Collapse all' : 'Expand all'}
                        </button>
                    )}
                    <Button variant="secondary" disabled={day.rows.length === 0} onClick={() => downloadTextFile(`attendance-${day.date}.csv`, buildCsv(day, clock))}>
                        ⬇ Export CSV
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-edge/60 bg-bone-light/50 px-5 py-2.5 text-sm text-muted">
                <span><b className="text-ink">{summary.employees}</b> {summary.employees === 1 ? 'employee' : 'employees'}</span>
                <span><b className="text-ink">{formatMinutes(summary.totalMinutes)}</b> worked <span className="text-xs">(finished shifts, the same basis as payroll)</span></span>
                {summary.stillIn > 0 && <span><b className="text-ink">{summary.stillIn}</b> still in</span>}
                {summary.overdue > 0 && <span><b className="text-rust">{summary.overdue}</b> forgotten check-out{summary.overdue === 1 ? '' : 's'} still open</span>}
                {summary.awaitingApproval > 0 && <span><b className="text-warn">{summary.awaitingApproval}</b> awaiting approval</span>}
            </div>

            {day.rows.length === 0 ? (
                <div className="px-5 py-14 text-center">
                    <p className="font-display font-bold text-olive-deep">No one clocked in on {formatLongDate(day.date)}</p>
                    <p className="mt-1 text-sm text-muted">Records appear here once employees clock in.</p>
                </div>
            ) : (
                <>
                    {/* Desktop and tablet: a table */}
                    <div className="hidden overflow-x-auto md:block">
                        {/* table-fixed: the columns share the width they are given (side by side with the calendar that is only about 700 px), so the table never pushes past its card. */}
                        <table className="w-full table-fixed text-sm">
                            <colgroup>
                                <col className="w-[30%]" />
                                <col className="w-[14%]" />
                                <col className="w-[16%]" />
                                <col className="w-[13%]" />
                                <col className="w-[27%]" />
                            </colgroup>
                            <thead>
                                <tr className="border-b border-edge/60">
                                    <th className={th}>Employee</th>
                                    <th className={th}>Clock in</th>
                                    <th className={th}>Clock out</th>
                                    <th className={`${th} text-right`}>Total hours</th>
                                    <th className={th}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {day.rows.map((row) => {
                                    const expanded = open.has(row.employeeId);
                                    return (
                                        <Fragment key={row.employeeId}>
                                            <tr className="border-b border-edge/40 align-top">
                                                <td className="px-3 py-3"><Name row={row} expanded={expanded} onToggle={() => toggle(row.employeeId)} /></td>
                                                <td className="px-3 py-3 tabular-nums"><span className="whitespace-nowrap">{clock(row.firstIn)}</span></td>
                                                <td className="px-3 py-3 tabular-nums">
                                                    {row.lastOut ? <span className="whitespace-nowrap">{clock(row.lastOut)}</span> : <span className="text-muted">—</span>}
                                                    {row.lastOutDayOffset > 0 && <span className="ml-1.5 text-[0.7rem] font-bold text-olive">{dayOffsetLabel(row.lastOutDayOffset)}</span>}
                                                </td>
                                                <td className="px-3 py-3 text-right tabular-nums"><Total row={row} /></td>
                                                <td className="px-3 py-3"><StatusBadges row={row} /></td>
                                            </tr>
                                            {expanded &&
                                                row.sessions.map((s, i) => (
                                                    <tr key={s.id} className="border-b border-dashed border-edge/40 bg-bone-light/40 text-[0.82rem] text-muted">
                                                        <td className="py-2 pl-10 pr-3">Session {i + 1}{SESSION_NOTE[s.state] && <span className="ml-2 text-xs italic">{SESSION_NOTE[s.state]}</span>}</td>
                                                        <td className="px-3 py-2 tabular-nums"><span className="whitespace-nowrap">{clock(s.checkInAt)}</span></td>
                                                        <td className="px-3 py-2 tabular-nums">
                                                            {s.checkOutAt ? <span className="whitespace-nowrap">{clock(s.checkOutAt)}</span> : '—'}
                                                            {s.checkOutDayOffset > 0 && <span className="ml-1.5 text-[0.7rem] font-bold text-olive">{dayOffsetLabel(s.checkOutDayOffset)}</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">{s.minutes !== null ? formatMinutes(s.minutes) : '—'}</td>
                                                        <td />
                                                    </tr>
                                                ))}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Phone: one card per employee */}
                    <ul className="divide-y divide-edge/40 md:hidden">
                        {day.rows.map((row) => {
                            const expanded = open.has(row.employeeId);
                            return (
                                <li key={row.employeeId} className="px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <Name row={row} expanded={expanded} onToggle={() => toggle(row.employeeId)} />
                                        <div className="text-right text-sm tabular-nums"><Total row={row} /></div>
                                    </div>
                                    <p className="mt-1 pl-7 text-xs text-muted">
                                        In {clock(row.firstIn)} · Out {row.lastOut ? clock(row.lastOut) : '—'}
                                        {row.lastOutDayOffset > 0 ? ` ${dayOffsetLabel(row.lastOutDayOffset)}` : ''}
                                    </p>
                                    <div className="mt-2 pl-7"><StatusBadges row={row} /></div>
                                    {expanded && (
                                        <ul className="mt-2 space-y-1 border-t border-dashed border-edge/50 pt-2 pl-7 text-xs text-muted">
                                            {row.sessions.map((s, i) => (
                                                <li key={s.id}>
                                                    Session {i + 1} · {clock(s.checkInAt)} – {s.checkOutAt ? clock(s.checkOutAt) : '—'}
                                                    {s.checkOutDayOffset > 0 ? ` ${dayOffsetLabel(s.checkOutDayOffset)}` : ''} · {s.minutes !== null ? formatMinutes(s.minutes) : 'open'}
                                                    {SESSION_NOTE[s.state] ? ` (${SESSION_NOTE[s.state]})` : ''}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </Card>
    );
}
