import { Link } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Card, Badge, Button, Stat } from '../../components/ui/primitives';

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
            <div className="flex min-h-[60vh] items-center justify-center text-muted">
                <span className="h-2 w-2 animate-blink rounded-full bg-rust" />
            </div>
        );
    }

    if (!hasModule('SHIPMENTS')) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
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
        <div className="mx-auto max-w-6xl">
            <PageHeader
                title="Supplier Shipments"
                subtitle="Inbound packages recorded on arrival."
                icon={<Icon name="box" width={22} height={22} />}
                actions={
                    <Link to="/app/shipments/new">
                        <Button variant="rust">
                            <Icon name="box" width={15} height={15} /> Record Shipment
                        </Button>
                    </Link>
                }
            />

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Stat label="total_shipments" value={totals.count} icon={<Icon name="box" width={18} height={18} />} />
                <Stat label="total_items" value={totals.items} icon={<Icon name="grid" width={18} height={18} />} />
                <Stat label="damaged" value={totals.damaged} icon={<Icon name="thermo" width={18} height={18} />} accent={totals.damaged > 0} />
            </div>

            <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-edge/60 px-5 py-3.5">
                    <h2 className="font-display font-bold text-olive-deep">All shipments</h2>
                    <button onClick={() => void listQuery.refetch()} className="flex items-center gap-1.5 text-sm text-muted hover:text-olive-deep">
                        <Icon name="refresh" width={15} height={15} className={listQuery.isFetching ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-edge/60">
                                {['Shipment', 'Supplier', 'Facility', 'Qty', 'Received', 'Condition'].map((h) => (
                                    <th key={h} className={`px-5 py-2.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted ${h === 'Qty' || h === 'Condition' ? 'text-right' : ''}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-edge/40">
                            {listQuery.isLoading ? (
                                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">Loading…</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">No shipments recorded yet.</td></tr>
                            ) : (
                                rows.map((s) => (
                                    <tr key={s.id} className="cursor-pointer hover:bg-bone-light/40">
                                        <td className="px-5 py-3">
                                            <Link to={`/app/shipments/${s.id}`} className="block">
                                                <span className="font-mono text-xs text-muted">{s.shipmentCode}</span>
                                                {s.reference && <span className="block text-xs text-muted/70">{s.reference}</span>}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3 font-medium text-ink">
                                            <Link to={`/app/shipments/${s.id}`} className="block">{s.supplier}</Link>
                                        </td>
                                        <td className="px-5 py-3 text-muted">{s.facilityName ?? '—'}</td>
                                        <td className="px-5 py-3 text-right text-muted">{s.quantity ?? '—'}</td>
                                        <td className="px-5 py-3 text-muted">{formatDateTime(s.receivedAt)}</td>
                                        <td className="px-5 py-3 text-right">
                                            <ConditionBadge condition={s.condition} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

export function ConditionBadge({ condition }: { condition: 'GOOD' | 'DAMAGED' }) {
    return <Badge tone={condition === 'DAMAGED' ? 'alert' : 'good'}>{condition === 'DAMAGED' ? 'Damaged' : 'Good'}</Badge>;
}
