import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { trpc, type RouterOutputs } from '../../lib/trpc';
import { Icon } from '../../components/ui/Icon';
import { Card, Badge } from '../../components/ui/primitives';
import { ScanPanel } from '../../components/app/ScanPanel';

type BinOption = RouterOutputs['bin']['getActiveDynamicMatches'][number];


function ScanResult({
    code,
    reset,
}: {
    code: string;
    reset: () => void;
}) {
    const [binOptions, setBinOptions] = useState<BinOption[]>([]);
    const [selectedBinId, setSelectedBinId] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');

    const renderingFacilitiesQuery = trpc.facility.list.useQuery({ type: 'RENDERING', limit: 50 }, { staleTime: 60_000 });
    const renderingFacilities = renderingFacilitiesQuery.data?.items ?? [];

    useEffect(() => {
        if (renderingFacilities.length > 0 && !selectedDestinationId) {
            setSelectedDestinationId(renderingFacilities[0]!.id);
        }
    }, [renderingFacilities, selectedDestinationId]);

    const trpcContext = trpc.useUtils();
    const pickupMutation = trpc.cycle.pickup.useMutation();
    const deliverMutation = trpc.cycle.deliver.useMutation();

    useEffect(() => {
        let cancelled = false;
        setIsFetching(true);
        setFetchError(null);
        setBinOptions([]);
        setSelectedBinId(null);

        trpcContext.bin.getActiveDynamicMatches
            .fetch({ qrCode: code })
            .then((options) => {
                if (cancelled) return;
                if (options.length === 0) {
                    setFetchError('No accessible active bins found for this code.');
                } else if (options.length === 1) {
                    setBinOptions(options);
                    setSelectedBinId(options[0]!.id);
                } else {
                    setBinOptions(options);
                }
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                const message = error instanceof Error ? error.message : 'Failed to find bin';
                setFetchError(message);
            })
            .finally(() => {
                if (!cancelled) setIsFetching(false);
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code]);

    const binInfo = binOptions.find((b) => b.id === selectedBinId);

    const handlePickup = async () => {
        if (!binInfo?.activeCycle?.id) return;
        try {
            const result = await pickupMutation.mutateAsync({
                cycleId: binInfo.activeCycle.id,
                vehicleId: undefined,
            });
            setBinOptions((prev) =>
                prev.map((b) => (b.id === selectedBinId ? { ...b, status: 'IN_TRANSIT', activeCycle: { ...b.activeCycle, ...result } } : b)),
            );
            await trpcContext.bin.getActiveDynamicMatches.invalidate();
            setActionSuccess('PICKED_UP');
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeliver = async () => {
        if (!binInfo?.activeCycle?.id || !selectedDestinationId) return;
        try {
            await deliverMutation.mutateAsync({
                cycleId: binInfo.activeCycle.id,
                destinationId: selectedDestinationId,
            });
            setBinOptions((prev) => prev.map((b) => (b.id === selectedBinId ? { ...b, status: 'IDLE', activeCycle: null } : b)));
            await trpcContext.bin.getActiveDynamicMatches.invalidate();
            setActionSuccess('DELIVERED');
        } catch (error) {
            console.error(error);
        }
    };

    if (actionSuccess) {
        return (
            <Card className="flex flex-col items-center p-8 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-olive/15 text-olive">
                    <Icon name="check" width={32} height={32} />
                </div>
                <h3 className="font-display text-xl font-extrabold text-olive-deep">Success!</h3>
                <p className="mt-2 text-sm text-muted">Bin marked as {actionSuccess.replace('_', ' ')}</p>
                <button onClick={reset} className="mt-6 rounded-xl bg-olive-deep px-5 py-2.5 text-sm font-semibold text-bone-light hover:bg-olive-deep/90">
                    Done — Scan Next Bin
                </button>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-edge/60 bg-bone-light/50 p-5">
                <div>
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">{code}</p>
                    <h2 className="mt-1 font-display text-xl font-extrabold text-olive-deep">Scanned bin</h2>
                </div>
                <button onClick={reset} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-muted hover:text-olive-deep">
                    Cancel
                </button>
            </div>

            <div className="p-5">
                {isFetching && (
                    <div className="flex flex-col items-center py-8 text-muted">
                        <span className="mb-3 h-2 w-2 animate-blink rounded-full bg-rust" />
                        <p className="text-sm">Fetching bin details…</p>
                    </div>
                )}

                {fetchError && (
                    <div className="rounded-xl border border-rust/30 bg-rust/10 p-4 text-sm text-rust">
                        <p className="font-semibold">Error finding bin</p>
                        <p className="mt-1">{fetchError}</p>
                    </div>
                )}

                {!isFetching && !fetchError && binOptions.length > 1 && !selectedBinId && (
                    <div className="space-y-3">
                        <p className="text-sm font-medium text-ink">Multiple active cycles found. Select the physical bin you are holding:</p>
                        {binOptions.map((bin, index) => (
                            <button
                                key={bin.id}
                                onClick={() => setSelectedBinId(bin.id)}
                                className="w-full rounded-xl border border-edge bg-white p-4 text-left transition-colors hover:border-rust"
                            >
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="font-semibold text-olive-deep">Option {index + 1}</span>
                                    <Badge tone={bin.status === 'ACTIVE' ? 'active' : 'good'}>{bin.status}</Badge>
                                </div>
                                <div className="flex flex-col gap-1 text-sm text-muted">
                                    <span>Facility: {bin.currentFacility?.name || 'Unknown'}</span>
                                    <span className="font-mono text-xs opacity-70">ID: {bin.qrCode}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {binInfo && (
                    <div className="space-y-5">
                        {binOptions.length > 1 && (
                            <button onClick={() => setSelectedBinId(null)} className="text-sm font-medium text-rust hover:underline">
                                &larr; Back to selection
                            </button>
                        )}

                        <div className="grid grid-cols-2 gap-4 rounded-xl border border-edge/70 bg-bone-light/40 p-4">
                            <div>
                                <p className="mb-1 text-xs text-muted">Assigned ID</p>
                                <span className="font-mono text-xs font-semibold text-ink">{binInfo.qrCode}</span>
                            </div>
                            <div>
                                <p className="mb-1 text-xs text-muted">Status</p>
                                <Badge tone={binInfo.status === 'ACTIVE' ? 'active' : binInfo.status === 'IN_TRANSIT' ? 'good' : 'idle'}>
                                    {binInfo.status.replace('_', ' ')}
                                </Badge>
                            </div>
                        </div>

                        {binInfo.status === 'ACTIVE' && (
                            <button
                                onClick={() => void handlePickup()}
                                disabled={pickupMutation.isPending}
                                className="w-full rounded-xl bg-olive-deep px-4 py-3.5 text-sm font-semibold text-bone-light transition-colors hover:bg-olive-deep/90 disabled:opacity-50"
                            >
                                {pickupMutation.isPending ? 'Processing…' : 'Mark picked up'}
                            </button>
                        )}

                        {binInfo.status === 'IN_TRANSIT' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-olive-deep">Deliver to (rendering facility)</label>
                                    {renderingFacilitiesQuery.isLoading ? (
                                        <p className="text-sm text-muted">Loading facilities…</p>
                                    ) : renderingFacilities.length === 0 ? (
                                        <p className="text-sm text-rust">No rendering facilities found. Contact admin.</p>
                                    ) : renderingFacilities.length === 1 ? (
                                        <p className="rounded-lg bg-bone-light/60 p-2.5 text-sm font-semibold text-ink">{renderingFacilities[0]!.name}</p>
                                    ) : (
                                        <select
                                            value={selectedDestinationId}
                                            onChange={(e) => setSelectedDestinationId(e.target.value)}
                                            className="w-full rounded-xl border border-edge bg-white px-3 py-2.5 text-sm text-ink focus:border-rust focus:outline-none"
                                        >
                                            {renderingFacilities.map((f) => (
                                                <option key={f.id} value={f.id}>{f.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <button
                                    onClick={() => void handleDeliver()}
                                    disabled={deliverMutation.isPending || !selectedDestinationId}
                                    className="w-full rounded-xl bg-rust px-4 py-3.5 text-sm font-semibold text-canvas transition-colors hover:bg-rust/90 disabled:opacity-50"
                                >
                                    {deliverMutation.isPending ? 'Processing…' : 'Mark delivered'}
                                </button>
                            </div>
                        )}

                        {['IDLE', 'DELIVERED'].includes(binInfo.status) && (
                            <div className="rounded-xl bg-bone-light/50 p-4 text-center text-sm text-muted">
                                This bin is currently {binInfo.status}. No action required.
                            </div>
                        )}

                        {(pickupMutation.isError || deliverMutation.isError) && (
                            <div className="rounded-lg bg-rust/10 p-3 text-center text-sm font-medium text-rust">
                                Action failed: {pickupMutation.error?.message || deliverMutation.error?.message || 'Please try again'}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}

export function DriverPage() {
    return (
        <div className="mx-auto max-w-2xl">
            <header className="flex items-center justify-between rounded-2xl border border-edge/70 bg-white p-4 shadow-card">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-olive-deep text-bone-light">
                        <Icon name="truck" width={22} height={22} />
                    </span>
                    <div>
                        <h1 className="font-display text-lg font-extrabold text-olive-deep">Driver Portal</h1>
                        <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">Facility floor</p>
                    </div>
                </div>
                <Link to="/app/bin" className="rounded-lg border border-edge bg-white px-3 py-2 text-sm font-semibold text-muted hover:text-olive-deep">
                    Bin
                </Link>
            </header>

            <div className="mt-6">
                <ScanPanel
                    title="Scan a bin"
                    subtitle="Ready to pick up or deliver? Scan the QR code on the bin to continue."
                    icon="box"
                    placeholder="Enter QR code manually"
                    defaultMode="camera"
                    makeCode={() => ''}
                    renderResult={(code, reset) => <ScanResult code={code} reset={reset} />}
                />
            </div>
        </div>
    );
}

export default DriverPage;
