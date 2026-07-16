import { Link, useParams } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { ConditionBadge } from './ShipmentsDashboardPage';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { Icon } from '../../components/ui/Icon';
import { Card } from '../../components/ui/primitives';

function formatDateTime(value: string | Date | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function ShipmentDetailPage() {
    const { id = '' } = useParams();
    const query = trpc.shipment.getById.useQuery({ id }, { enabled: id.length > 0 });
    const { hasModule, isLoading } = useSubscription();

    if (isLoading) {
        return (
            <div className="mx-auto max-w-2xl">
                <Card className="p-8 text-center text-muted">Loading…</Card>
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

    return (
        <div className="mx-auto max-w-2xl">
            <Link to="/app/shipments" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-olive-deep">
                <Icon name="arrow" width={14} height={14} className="rotate-180" /> Back to shipments
            </Link>

            {query.isLoading ? (
                <Card className="p-8 text-center text-muted">Loading…</Card>
            ) : query.isError ? (
                <Card className="p-8 text-center text-rust">{query.error.message}</Card>
            ) : query.data ? (
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-olive-deep text-bone-light">
                                <Icon name="box" width={22} height={22} />
                            </span>
                            <div>
                                <h1 className="font-display text-xl font-extrabold text-olive-deep">{query.data.supplier}</h1>
                                <p className="font-mono text-sm text-muted">{query.data.shipmentCode}</p>
                            </div>
                        </div>
                        <ConditionBadge condition={query.data.condition} />
                    </div>

                    <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                        <Detail label="Tracking / PO" value={query.data.reference} />
                        <Detail label="Destination facility" value={query.data.facilityName} />
                        <Detail label="Quantity" value={query.data.quantity != null ? String(query.data.quantity) : null} />
                        <Detail label="Weight" value={query.data.weightKg != null ? `${query.data.weightKg} kg` : null} />
                        <Detail label="Received by" value={query.data.receivedBy} />
                        <Detail label="Expected arrival" value={formatDateTime(query.data.expectedAt)} />
                        <Detail label="Received at" value={formatDateTime(query.data.receivedAt)} />
                        <Detail label="Logged at" value={formatDateTime(query.data.createdAt)} />
                    </dl>

                    {query.data.contents && (
                        <div className="mt-6">
                            <p className="kicker">Contents</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{query.data.contents}</p>
                        </div>
                    )}

                    {query.data.conditionNote && (
                        <div className="mt-4 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3">
                            <p className="kicker text-warn">Condition note</p>
                            <p className="mt-1 text-sm text-ink">{query.data.conditionNote}</p>
                        </div>
                    )}
                </Card>
            ) : null}
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <dt className="kicker">{label}</dt>
            <dd className="mt-0.5 font-medium text-ink">{value ?? '—'}</dd>
        </div>
    );
}
