import { Link } from 'react-router-dom';
import { Package, PackagePlus, AlertTriangle, Boxes, RefreshCw } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';

const ACCENT = '#043F2E';

function formatDateTime(value: string | Date): string {
    return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function ShipmentsDashboardPage() {
    const listQuery = trpc.shipment.list.useQuery({ limit: 100 }, { staleTime: 10_000 });
    const { hasModule, isLoading } = useSubscription();

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-400">
                Loading…
            </div>
        );
    }

    if (!hasModule('SHIPMENTS')) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <UpgradePrompt module="SHIPMENTS" />
            </div>
        );
    }

    const rows = listQuery.data ?? [];

    const totals = rows.reduce(
        (acc, s) => {
            acc.count += 1;
            if (s.condition === 'DAMAGED') acc.damaged += 1;
            acc.items += s.quantity ?? 0;
            return acc;
        },
        { count: 0, damaged: 0, items: 0 },
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-6xl">
                <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Supplier Shipments</h1>
                        <p className="mt-1 text-sm text-gray-600">Inbound packages recorded on arrival</p>
                    </div>
                    <Link
                        to="/app/shipments/new"
                        className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
                        style={{ backgroundColor: ACCENT }}
                    >
                        <PackagePlus className="h-4 w-4" /> Record Shipment
                    </Link>
                </header>

                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard icon={<Package className="h-6 w-6" />} label="Total shipments" value={String(totals.count)} />
                    <StatCard icon={<Boxes className="h-6 w-6" />} label="Total items" value={String(totals.items)} />
                    <StatCard
                        icon={<AlertTriangle className="h-6 w-6" />}
                        label="Damaged"
                        value={String(totals.damaged)}
                        danger={totals.damaged > 0}
                    />
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                        <h2 className="font-semibold text-gray-900">All shipments</h2>
                        <button
                            onClick={() => void listQuery.refetch()}
                            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
                        >
                            <RefreshCw className={`h-4 w-4 ${listQuery.isFetching ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase tracking-wider text-gray-400">
                                <tr>
                                    <th className="px-5 py-3">Shipment</th>
                                    <th className="px-5 py-3">Supplier</th>
                                    <th className="px-5 py-3">Facility</th>
                                    <th className="px-5 py-3 text-right">Qty</th>
                                    <th className="px-5 py-3">Received</th>
                                    <th className="px-5 py-3 text-right">Condition</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {listQuery.isLoading ? (
                                    <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No shipments recorded yet.</td></tr>
                                ) : (
                                    rows.map((s) => (
                                        <tr key={s.id} className="cursor-pointer hover:bg-gray-50">
                                            <td className="px-5 py-3">
                                                <Link to={`/app/shipments/${s.id}`} className="block">
                                                    <span className="font-mono text-xs text-gray-500">{s.shipmentCode}</span>
                                                    {s.reference && (
                                                        <span className="block text-xs text-gray-400">{s.reference}</span>
                                                    )}
                                                </Link>
                                            </td>
                                            <td className="px-5 py-3 font-medium text-gray-900">
                                                <Link to={`/app/shipments/${s.id}`} className="block">{s.supplier}</Link>
                                            </td>
                                            <td className="px-5 py-3 text-gray-600">{s.facilityName ?? '—'}</td>
                                            <td className="px-5 py-3 text-right text-gray-600">{s.quantity ?? '—'}</td>
                                            <td className="px-5 py-3 text-gray-600">{formatDateTime(s.receivedAt)}</td>
                                            <td className="px-5 py-3 text-right">
                                                <ConditionBadge condition={s.condition} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ConditionBadge({ condition }: { condition: 'GOOD' | 'DAMAGED' }) {
    if (condition === 'DAMAGED') {
        return (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                Damaged
            </span>
        );
    }
    return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
            Good
        </span>
    );
}

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    danger?: boolean;
}

function StatCard({ icon, label, value, danger }: StatCardProps) {
    return (
        <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    danger ? 'bg-red-100 text-red-600' : 'bg-[#043F2E]/10 text-[#043F2E]'
                }`}
            >
                {icon}
            </div>
            <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
        </div>
    );
}
