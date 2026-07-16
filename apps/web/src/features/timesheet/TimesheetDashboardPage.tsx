import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Card, Badge, Button, Stat } from '../../components/ui/primitives';

function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
}

function formatHours(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export default function TimesheetDashboardPage() {
    const [fromDate, setFromDate] = useState<string>(todayStr());
    const [toDate, setToDate] = useState<string>(todayStr());

    const range = useMemo(() => {
        const from = new Date(`${fromDate}T00:00:00`).toISOString();
        // Inclusive end-of-day: bump `to` to the start of the next day.
        const toEnd = new Date(`${toDate}T00:00:00`);
        toEnd.setDate(toEnd.getDate() + 1);
        return { from, to: toEnd.toISOString() };
    }, [fromDate, toDate]);

    const summaryQuery = trpc.attendance.summary.useQuery(range, { staleTime: 10_000 });
    const recentQuery = trpc.attendance.recent.useQuery({ limit: 20 }, { staleTime: 10_000 });
    const { hasModule, isLoading } = useSubscription();

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center text-muted">
                <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
            </div>
        );
    }

    if (!hasModule('WORKFORCE')) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <UpgradePrompt module="WORKFORCE" />
            </div>
        );
    }

    const rows = (summaryQuery.data ?? [])
        .filter((r) => r.sessionCount > 0)
        .sort((a, b) => b.totalMinutes - a.totalMinutes);

    const totals = rows.reduce(
        (acc, r) => {
            acc.minutes += r.totalMinutes;
            if (r.openSession) acc.onSite += 1;
            return acc;
        },
        { minutes: 0, onSite: 0 },
    );

    const refresh = () => {
        void summaryQuery.refetch();
        void recentQuery.refetch();
    };

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                title="Timesheet Dashboard"
                subtitle="Hours worked per employee."
                icon={<Icon name="clock" width={22} height={22} />}
                actions={
                    <>
                        <Link to="/app/employees/register">
                            <Button variant="secondary">
                                <Icon name="users" width={15} height={15} /> Register
                            </Button>
                        </Link>
                        <Link to="/app/guard">
                            <Button variant="secondary">
                                <Icon name="scan" width={15} height={15} /> Scanner
                            </Button>
                        </Link>
                    </>
                }
            />

            {/* Filters + summary cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="p-4">
                    <label className="mb-1 block text-xs font-medium text-muted">From</label>
                    <input
                        type="date"
                        value={fromDate}
                        max={toDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="mb-3 w-full rounded-lg border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-rust"
                    />
                    <label className="mb-1 block text-xs font-medium text-muted">To</label>
                    <input
                        type="date"
                        value={toDate}
                        min={fromDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full rounded-lg border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-rust"
                    />
                </Card>
                <Stat label="total_hours_logged" value={formatHours(totals.minutes)} icon={<Icon name="clock" width={18} height={18} />} />
                <Stat label="currently_on_site" value={totals.onSite} icon={<Icon name="users" width={18} height={18} />} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Employee hours table */}
                <Card className="overflow-hidden lg:col-span-2">
                    <div className="flex items-center justify-between border-b border-edge/60 px-5 py-3.5">
                        <h2 className="font-display font-bold text-olive-deep">Hours by employee</h2>
                        <button onClick={refresh} className="flex items-center gap-1.5 text-sm text-muted hover:text-olive-deep">
                            <Icon name="refresh" width={15} height={15} className={summaryQuery.isFetching ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-edge/60">
                                    <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Employee</th>
                                    <th className="px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Department</th>
                                    <th className="px-5 py-2.5 text-right font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Sessions</th>
                                    <th className="px-5 py-2.5 text-right font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Hours</th>
                                    <th className="px-5 py-2.5 text-right font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-edge/40">
                                {summaryQuery.isLoading ? (
                                    <tr><td colSpan={5} className="px-5 py-8 text-center text-muted">Loading…</td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={5} className="px-5 py-8 text-center text-muted">No attendance recorded for this range.</td></tr>
                                ) : (
                                    rows.map((row) => (
                                        <tr key={row.employeeId} className="hover:bg-bone-light/40">
                                            <td className="px-5 py-3">
                                                <div className="font-medium text-ink">{row.fullName}</div>
                                                <div className="font-mono text-xs text-muted">{row.employeeCode}</div>
                                            </td>
                                            <td className="px-5 py-3 text-muted">{row.department ?? '—'}</td>
                                            <td className="px-5 py-3 text-right text-muted">{row.sessionCount}</td>
                                            <td className="px-5 py-3 text-right font-semibold text-ink">{formatHours(row.totalMinutes)}</td>
                                            <td className="px-5 py-3 text-right">
                                                <Badge tone={row.openSession ? 'good' : 'idle'}>{row.openSession ? 'On site' : 'Off'}</Badge>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Recent scans feed */}
                <Card className="overflow-hidden">
                    <div className="border-b border-edge/60 px-5 py-3.5">
                        <h2 className="font-display font-bold text-olive-deep">Recent scans</h2>
                    </div>
                    <ul className="divide-y divide-edge/40">
                        {recentQuery.isLoading ? (
                            <li className="px-5 py-8 text-center text-muted">Loading…</li>
                        ) : (recentQuery.data ?? []).length === 0 ? (
                            <li className="px-5 py-8 text-center text-muted">No scans yet.</li>
                        ) : (
                            (recentQuery.data ?? []).map((event) => {
                                const isIn = event.eventType === 'CHECK_IN';
                                return (
                                    <li key={event.id} className="flex items-center gap-3 px-5 py-3">
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isIn ? 'bg-live/15 text-live' : 'bg-olive/15 text-olive'}`}>
                                            <Icon name={isIn ? 'check' : 'arrow'} width={15} height={15} className={isIn ? '' : 'rotate-90'} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-ink">{event.employeeName}</p>
                                            <p className="text-xs text-muted">
                                                {isIn ? 'Checked in' : 'Checked out'} · {new Date(event.scannedAt).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </Card>
            </div>
        </div>
    );
}
