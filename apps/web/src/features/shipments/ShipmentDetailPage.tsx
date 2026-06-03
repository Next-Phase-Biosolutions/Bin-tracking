import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, PackageCheck } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ConditionBadge } from './ShipmentsDashboardPage';

const ACCENT = '#043F2E';

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

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-2xl">
                <Link
                    to="/app/shipments"
                    className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to shipments
                </Link>

                {query.isLoading ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-400 shadow-sm">
                        Loading…
                    </div>
                ) : query.isError ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-red-600 shadow-sm">
                        {query.error.message}
                    </div>
                ) : query.data ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
                                    style={{ backgroundColor: ACCENT }}
                                >
                                    <PackageCheck className="h-6 w-6" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">{query.data.supplier}</h1>
                                    <p className="font-mono text-sm text-gray-500">{query.data.shipmentCode}</p>
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
                                <p className="text-xs uppercase tracking-wider text-gray-400">Contents</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{query.data.contents}</p>
                            </div>
                        )}

                        {query.data.conditionNote && (
                            <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3">
                                <p className="text-xs uppercase tracking-wider text-amber-700">Condition note</p>
                                <p className="mt-1 text-sm text-amber-900">{query.data.conditionNote}</p>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <dt className="text-xs uppercase tracking-wider text-gray-400">{label}</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{value ?? '—'}</dd>
        </div>
    );
}
