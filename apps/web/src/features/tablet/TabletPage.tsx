import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createStationTRPCClient } from '../../lib/trpc';
import { Icon } from '../../components/ui/Icon';
import { Card, Button } from '../../components/ui/primitives';
import { CameraScanner } from '../../components/app/CameraScanner';

const TABLET_STATION_ID = import.meta.env.VITE_STATION_LABEL || 'Facility Scanner';
const TABLET_STATION_TOKEN = import.meta.env.VITE_TEST_STATION_TOKEN || '';

export function TabletPage() {
    const [scannedBinId, setScannedBinId] = useState<string | null>(null);
    const [manualQr, setManualQr] = useState<string>('');
    // Gate the scanner so it doesn't auto-re-trigger after a success or cancel
    const [isScannerActive, setIsScannerActive] = useState(true);
    const [scanError, setScanError] = useState<string | null>(null);

    // Mutation states
    const [isPending, setIsPending] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<{ message: string } | null>(null);

    const handleScan = (decodedText: string) => {
        // Only update if it's a new bin to avoid constant re-renders
        if (decodedText !== scannedBinId) {
            setScannedBinId(decodedText);
            setIsSuccess(false);
            setError(null);
        }
    };

    const handleStart = async () => {
        if (!scannedBinId) return;

        setIsPending(true);
        setError(null);
        setIsSuccess(false);

        try {
            const stationClient = createStationTRPCClient(TABLET_STATION_TOKEN);
            await stationClient.bin.startDynamic.mutate({
                masterQrCode: scannedBinId,
            });

            setIsSuccess(true);
            // Turn scanner OFF after success — prevent auto re-trigger
            setIsScannerActive(false);
        } catch (err: unknown) {
            let errorMessage = err instanceof Error ? err.message : 'Failed to start bin';
            try {
                const parsed = JSON.parse(errorMessage);
                if (Array.isArray(parsed) && parsed[0]?.message) {
                    errorMessage = parsed[0].message;
                }
            } catch {
                // Not JSON, use as is
            }
            setError({ message: errorMessage });
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas p-4">
            <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg opacity-40" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 rounded-b-[40px] bg-olive-deep shadow-panel" />

            <Card className="relative z-10 flex w-full max-w-lg flex-col items-center p-6 md:p-8">
                <div className="mb-6 w-full text-center">
                    <h1 className="font-display text-3xl font-extrabold tracking-tight text-olive-deep md:text-4xl">Facility Scanner</h1>
                    <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-rust">Station: {TABLET_STATION_ID}</p>

                    <div className="mt-6 flex items-center justify-center gap-3">
                        <Link to="/app/dashboard">
                            <Button variant="secondary">Dashboard</Button>
                        </Link>
                        <Link to="/app/driver">
                            <Button variant="secondary">Driver</Button>
                        </Link>
                    </div>

                    {/* Fill a Form shortcut */}
                    <Link
                        to="/app/forms"
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-edge bg-bone-light/50 px-4 py-3 text-sm font-semibold text-olive-deep transition-colors hover:bg-bone-light"
                    >
                        <Icon name="form" width={18} height={18} />
                        Fill a Form
                    </Link>
                </div>

                {!scannedBinId ? (
                    <div className="flex w-full flex-col items-center">
                        <div className="mb-6 flex items-center justify-center rounded-full bg-bone-light/60 p-4">
                            <Icon name="scan" width={36} height={36} className="text-olive-deep" />
                        </div>
                        <h2 className="mb-4 text-center font-display text-xl font-bold text-olive-deep">Scan Bin QR Code</h2>

                        {isScannerActive ? (
                            <div className="w-full">
                                <CameraScanner onScan={handleScan} onError={setScanError} />
                                {scanError && <p className="mt-3 rounded-lg bg-rust/[0.08] px-3 py-2 text-center text-xs text-rust">{scanError}</p>}
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsScannerActive(true)}
                                className="flex w-full items-center justify-center gap-3 rounded-xl bg-olive-deep py-4 text-lg font-bold text-bone-light transition-colors hover:bg-olive-deep/90"
                            >
                                Tap to Scan Next Bin
                            </button>
                        )}

                        {/* Manual entry fallback */}
                        <div className="mt-6 flex w-full max-w-sm gap-2">
                            <input
                                type="text"
                                placeholder="Enter QR code manually"
                                value={manualQr}
                                onChange={(e) => setManualQr(e.target.value)}
                                className="flex-1 rounded-xl border border-edge bg-white px-4 py-2.5 text-sm text-ink focus:border-rust focus:outline-none"
                            />
                            <button
                                onClick={() => { if (manualQr) { setIsScannerActive(true); handleScan(manualQr); } }}
                                disabled={!manualQr}
                                className="rounded-xl bg-rust px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-rust/90 disabled:opacity-50"
                            >
                                Simulate Scan
                            </button>
                        </div>

                        <p className="mt-6 max-w-xs text-center text-sm text-muted">
                            Hold the bin&apos;s QR code in front of the camera until it registers.
                        </p>
                    </div>
                ) : (
                    <div className="flex w-full flex-col items-center">
                        {isSuccess ? (
                            <div className="flex flex-col items-center py-8">
                                <span className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-live/15 text-live">
                                    <Icon name="check" width={48} height={48} />
                                </span>
                                <h2 className="mb-2 font-display text-3xl font-extrabold text-olive-deep">Cycle Started!</h2>
                                <p className="text-center text-lg text-muted">
                                    Bin <span className="font-bold text-rust">{scannedBinId}</span> is now active.
                                </p>
                                <button
                                    onClick={() => {
                                        setScannedBinId(null);
                                        setIsSuccess(false);
                                        setIsScannerActive(true);
                                    }}
                                    className="mt-8 rounded-xl bg-olive-deep px-8 py-3 text-lg font-bold text-bone-light transition-colors hover:bg-olive-deep/90"
                                >
                                    Scan Next Bin
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="mb-8 w-full rounded-2xl border border-edge/70 bg-bone-light/40 p-6">
                                    <h3 className="kicker mb-1">Scanned Bin</h3>
                                    <p className="truncate font-display text-2xl font-extrabold text-olive-deep">{scannedBinId}</p>
                                    <div className="mt-4 flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-live" />
                                        <span className="font-medium text-live">Ready to start cycle</span>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-6 flex w-full items-start gap-3 rounded-xl border border-rust/30 bg-rust/10 p-4">
                                        <Icon name="thermo" width={20} height={20} className="mt-0.5 shrink-0 text-rust" />
                                        <div>
                                            <p className="font-semibold text-rust">Could not start bin</p>
                                            <p className="mt-1 text-sm text-rust">{error.message}</p>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => void handleStart()}
                                    disabled={isPending}
                                    className="flex w-full transform items-center justify-center gap-3 rounded-2xl bg-olive-deep py-6 text-2xl font-bold uppercase tracking-wider text-bone-light shadow-panel transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                                >
                                    {isPending ? (
                                        <>
                                            <span className="h-6 w-6 animate-spin rounded-full border-4 border-bone-light border-t-transparent" />
                                            Processing…
                                        </>
                                    ) : (
                                        'BIN STARTED'
                                    )}
                                </button>

                                <button
                                    onClick={() => {
                                        setScannedBinId(null);
                                        setError(null);
                                        setIsSuccess(false);
                                        setIsScannerActive(false);
                                    }}
                                    disabled={isPending}
                                    className="mt-6 font-medium text-muted underline-offset-4 hover:text-olive-deep hover:underline"
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}

export default TabletPage;
