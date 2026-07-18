import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createStationTRPCClient, STATION_TOKEN, type RouterOutputs } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { Icon } from '../../components/ui/Icon';
import { Card, Button } from '../../components/ui/primitives';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { CameraScanner } from '../../components/app/CameraScanner';

// attendance.scan requires stationProcedure — scoped to this one call so it
// doesn't collide with any bearer-gated call elsewhere on the page.
const stationClient = createStationTRPCClient(STATION_TOKEN);

type ScanMode = 'handheld' | 'camera';

type ScanResult = RouterOutputs['attendance']['scan'];

function formatDuration(minutes: number | null): string {
    if (minutes === null) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
}

export default function GuardScannerPage() {
    const [scanMode, setScanMode] = useState<ScanMode>('handheld');
    const [scannerActive, setScannerActive] = useState(true);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState('');
    // Guards against the scanner firing the same code repeatedly per frame.
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const handheldRef = useRef<HTMLInputElement | null>(null);

    const scanMutation = useMutation({
        mutationFn: (input: Parameters<typeof stationClient.attendance.scan.mutate>[0]) =>
            stationClient.attendance.scan.mutate(input),
    });

    const submitScan = (qrCode: string) => {
        if (!qrCode || qrCode === lastScanned) return;
        setLastScanned(qrCode);
        setScannerActive(false);
        setErrorMsg(null);
        setManualCode('');
        scanMutation.mutate(
            { qrCode, source: 'Guard Post' },
            {
                onSuccess: (data) => setResult(data),
                onError: (err) => setErrorMsg(err.message),
            },
        );
    };

    const reset = () => {
        setResult(null);
        setErrorMsg(null);
        setManualCode('');
        setLastScanned(null);
        scanMutation.reset();
        setScannerActive(true);
    };

    // Keep the handheld input focused so a Bluetooth/USB scanner (HID keyboard)
    // can fire scans hands-free without the guard tapping the field first.
    const showScanPanel = !result && !errorMsg;
    useEffect(() => {
        if (scanMode === 'handheld' && showScanPanel) {
            handheldRef.current?.focus();
        }
    }, [scanMode, showScanPanel, scanMutation.isPending]);

    const { hasModule, isLoading } = useSubscription();
    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas">
                <FacilityLoader variant="inline" label="access log" />
            </div>
        );
    }
    if (!hasModule('WORKFORCE')) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
                <UpgradePrompt module="WORKFORCE" />
            </div>
        );
    }

    const isCheckIn = result?.action === 'CHECK_IN';

    return (
        <div className="flex min-h-screen flex-col bg-canvas p-4 md:p-8">
            <div aria-hidden className="pointer-events-none fixed inset-0 data-grid-bg opacity-40" />
            <header className="relative mb-6 flex items-center justify-between rounded-2xl border border-edge/70 bg-white p-4 shadow-card">
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-olive-deep text-bone-light">
                        <Icon name="badge" width={22} height={22} />
                    </span>
                    <div>
                        <h1 className="font-display text-lg font-extrabold text-olive-deep">Guard Scanner</h1>
                        <p className="text-sm text-muted">Scan an employee badge to check in or out</p>
                    </div>
                </div>
                <Link to="/app/timesheet">
                    <Button variant="secondary">
                        <Icon name="clock" width={15} height={15} /> Timesheet
                    </Button>
                </Link>
            </header>

            <main className="relative mx-auto w-full max-w-md flex-1">
                {showScanPanel && (
                    <Card className="flex flex-col items-center p-6 text-center">
                        {/* Mode toggle: handheld scanner (Inateck BCST-70) vs phone camera */}
                        <div className="mb-5 flex w-full items-center gap-1 rounded-full border border-edge bg-bone-light/60 p-1">
                            <button
                                onClick={() => setScanMode('handheld')}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition-colors ${scanMode === 'handheld' ? 'bg-olive-deep text-bone-light' : 'text-muted hover:text-olive-deep'}`}
                            >
                                Handheld scanner
                            </button>
                            <button
                                onClick={() => setScanMode('camera')}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition-colors ${scanMode === 'camera' ? 'bg-olive-deep text-bone-light' : 'text-muted hover:text-olive-deep'}`}
                            >
                                Camera
                            </button>
                        </div>

                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-live/15 text-live">
                            <Icon name="scan" width={30} height={30} />
                        </div>
                        <h2 className="mb-2 font-display text-2xl font-extrabold text-olive-deep">Scan Badge</h2>

                        {scanMode === 'handheld' ? (
                            <>
                                <p className="mb-6 text-sm text-muted">
                                    Scan the employee&apos;s barcode with the handheld scanner. Keep this box focused.
                                </p>
                                <input
                                    ref={handheldRef}
                                    type="text"
                                    autoFocus
                                    placeholder="Waiting for scan… (or type the code and press Enter)"
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            submitScan(manualCode.trim());
                                        }
                                    }}
                                    onBlur={() => {
                                        if (scanMode === 'handheld' && showScanPanel) {
                                            setTimeout(() => handheldRef.current?.focus(), 0);
                                        }
                                    }}
                                    className="w-full rounded-xl border-2 border-olive-deep/30 px-4 py-4 text-center text-lg text-ink focus:border-rust focus:outline-none"
                                />
                                <div className="mt-3 flex items-center gap-2 text-sm text-live">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-live opacity-75" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live" />
                                    </span>
                                    Ready to scan
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="mb-6 text-sm text-muted">Point the camera at the employee&apos;s QR code.</p>
                                {scannerActive ? (
                                    <CameraScanner onScan={submitScan} onError={setErrorMsg} />
                                ) : (
                                    <button
                                        onClick={() => setScannerActive(true)}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-olive-deep py-4 text-lg font-bold text-bone-light transition-colors hover:bg-olive-deep/90"
                                    >
                                        <Icon name="scan" width={18} height={18} /> Tap to Start Scanning
                                    </button>
                                )}
                                <div className="mt-6 flex w-full gap-2">
                                    <input
                                        type="text"
                                        placeholder="Enter code manually"
                                        value={manualCode}
                                        onChange={(e) => setManualCode(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                submitScan(manualCode.trim());
                                            }
                                        }}
                                        className="flex-1 rounded-xl border border-edge bg-white px-4 py-2.5 text-sm text-ink focus:border-rust focus:outline-none"
                                    />
                                    <button
                                        onClick={() => submitScan(manualCode.trim())}
                                        disabled={!manualCode.trim()}
                                        className="rounded-xl bg-olive-deep px-4 py-2.5 text-sm font-medium text-bone-light transition-colors hover:bg-olive-deep/90 disabled:opacity-50"
                                    >
                                        Submit
                                    </button>
                                </div>
                            </>
                        )}

                        {scanMutation.isPending && <p className="mt-4 text-sm text-muted">Recording scan…</p>}
                    </Card>
                )}

                {result && (
                    <Card className="p-8 text-center">
                        <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${isCheckIn ? 'bg-live/15 text-live' : 'bg-olive/15 text-olive'}`}>
                            <Icon name={isCheckIn ? 'check' : 'arrow'} width={36} height={36} className={isCheckIn ? '' : 'rotate-90'} />
                        </div>
                        <p className="kicker">
                            {isCheckIn ? 'Checked In' : 'Checked Out'}
                            {result.debounced && ' (already recorded)'}
                        </p>
                        <h3 className="mt-1 font-display text-2xl font-extrabold text-olive-deep">{result.employeeName}</h3>
                        <p className="font-mono text-sm text-muted">{result.employeeCode}</p>
                        <p className="mt-2 text-sm text-muted">
                            {new Date(result.occurredAt).toLocaleTimeString()}
                            {!isCheckIn && result.durationMin !== null && (
                                <span className="ml-2 font-semibold text-ink">· {formatDuration(result.durationMin)} worked</span>
                            )}
                        </p>

                        <button onClick={reset} className="mt-8 w-full rounded-xl bg-olive-deep py-3 font-semibold text-bone-light transition-colors hover:bg-olive-deep/90">
                            Scan Next Badge
                        </button>
                    </Card>
                )}

                {errorMsg && (
                    <Card className="p-8 text-center">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rust/12 text-rust">
                            <Icon name="thermo" width={36} height={36} />
                        </div>
                        <h3 className="font-display text-xl font-extrabold text-olive-deep">Scan failed</h3>
                        <p className="mt-2 text-sm text-muted">{errorMsg}</p>
                        <button onClick={reset} className="mt-8 w-full rounded-xl bg-olive-deep py-3 font-semibold text-bone-light transition-colors hover:bg-olive-deep/90">
                            Try Again
                        </button>
                    </Card>
                )}
            </main>
        </div>
    );
}
