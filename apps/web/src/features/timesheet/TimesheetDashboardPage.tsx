import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Users, LogIn, LogOut, RefreshCw, UserPlus, ScanLine } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';

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
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-400">
                Loading…
            </div>
        );
    }

    if (!hasModule('WORKFORCE')) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
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
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-6xl">
                <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Timesheet Dashboard</h1>
                        <p className="mt-1 text-sm text-gray-600">Hours worked per employee</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            to="/app/employees/register"
                            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                        >
                            <UserPlus className="h-4 w-4" /> Register
                        </Link>
                        <Link
                            to="/app/guard"
                            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                        >
                            <ScanLine className="h-4 w-4" /> Scanner
                        </Link>
                    </div>
                </header>

                {/* Filters + summary cards */}
                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
                        <input
                            type="date"
                            value={fromDate}
                            max={toDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                        <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
                        <input
                            type="date"
                            value={toDate}
                            min={fromDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                    </div>
                    <StatCard
                        icon={<Clock className="h-6 w-6" />}
                        label="Total hours logged"
                        value={formatHours(totals.minutes)}
                    />
                    <StatCard
                        icon={<Users className="h-6 w-6" />}
                        label="Currently on site"
                        value={String(totals.onSite)}
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Employee hours table */}
                    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm lg:col-span-2">
                        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                            <h2 className="font-semibold text-gray-900">Hours by employee</h2>
                            <button
                                onClick={refresh}
                                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
                            >
                                <RefreshCw className={`h-4 w-4 ${summaryQuery.isFetching ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs uppercase tracking-wider text-gray-400">
                                    <tr>
                                        <th className="px-5 py-3">Employee</th>
                                        <th className="px-5 py-3">Department</th>
                                        <th className="px-5 py-3 text-right">Sessions</th>
                                        <th className="px-5 py-3 text-right">Hours</th>
                                        <th className="px-5 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {summaryQuery.isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                                                Loading…
                                            </td>
                                        </tr>
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                                                No attendance recorded for this range.
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((row) => (
                                            <tr key={row.employeeId} className="hover:bg-gray-50">
                                                <td className="px-5 py-3">
                                                    <div className="font-medium text-gray-900">{row.fullName}</div>
                                                    <div className="font-mono text-xs text-gray-400">{row.employeeCode}</div>
                                                </td>
                                                <td className="px-5 py-3 text-gray-600">{row.department ?? '—'}</td>
                                                <td className="px-5 py-3 text-right text-gray-600">{row.sessionCount}</td>
                                                <td className="px-5 py-3 text-right font-semibold text-gray-900">
                                                    {formatHours(row.totalMinutes)}
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    {row.openSession ? (
                                                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                                                            On site
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                                                            Off
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent scans feed */}
                    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="border-b border-gray-100 px-5 py-3">
                            <h2 className="font-semibold text-gray-900">Recent scans</h2>
                        </div>
                        <ul className="divide-y divide-gray-100">
                            {recentQuery.isLoading ? (
                                <li className="px-5 py-8 text-center text-gray-400">Loading…</li>
                            ) : (recentQuery.data ?? []).length === 0 ? (
                                <li className="px-5 py-8 text-center text-gray-400">No scans yet.</li>
                            ) : (
                                (recentQuery.data ?? []).map((event) => {
                                    const isIn = event.eventType === 'CHECK_IN';
                                    return (
                                        <li key={event.id} className="flex items-center gap-3 px-5 py-3">
                                            <span
                                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                                    isIn ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                                }`}
                                            >
                                                {isIn ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-gray-900">
                                                    {event.employeeName}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {isIn ? 'Checked in' : 'Checked out'} ·{' '}
                                                    {new Date(event.scannedAt).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
}

function StatCard({ icon, label, value }: StatCardProps) {
    return (
        <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#3d5aa8]/10 text-[#3d5aa8]">
                {icon}
            </div>
            <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
        </div>
    );
}
