import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanLine, LogIn, LogOut, AlertCircle, ShieldCheck } from 'lucide-react';
import { QRScanner } from '../../components/QRScanner';
import { trpc, type RouterOutputs } from '../../lib/trpc';

type ScanResult = RouterOutputs['attendance']['scan'];

function formatDuration(minutes: number | null): string {
    if (minutes === null) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
}

export default function GuardScannerPage() {
    const [scannerActive, setScannerActive] = useState(true);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState('');
    // Guards against the scanner firing the same code repeatedly per frame.
    const [lastScanned, setLastScanned] = useState<string | null>(null);

    const scanMutation = trpc.attendance.scan.useMutation();

    const submitScan = (qrCode: string) => {
        if (!qrCode || qrCode === lastScanned) return;
        setLastScanned(qrCode);
        setScannerActive(false);
        setErrorMsg(null);
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

    const isCheckIn = result?.action === 'CHECK_IN';

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 p-4 md:p-8">
            <header className="mb-6 flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#043F2E] p-2">
                        <ShieldCheck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Guard Scanner</h1>
                        <p className="text-sm text-gray-500">Scan an employee badge to check in or out</p>
                    </div>
                </div>
                <Link
                    to="/app/timesheet"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                >
                    Timesheet
                </Link>
            </header>

            <main className="mx-auto w-full max-w-md flex-1">
                {!result && !errorMsg && (
                    <div className="flex flex-col items-center rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-sm">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <ScanLine className="h-8 w-8" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-gray-900">Scan Badge</h2>
                        <p className="mb-6 text-gray-500">Point the camera at the employee's QR code.</p>

                        {scannerActive ? (
                            <div className="w-full">
                                <QRScanner onScan={submitScan} />
                            </div>
                        ) : (
                            <button
                                onClick={() => setScannerActive(true)}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#043F2E] py-4 text-lg font-bold text-white transition-colors hover:bg-[#032f22]"
                            >
                                <ScanLine className="h-5 w-5" /> Tap to Start Scanning
                            </button>
                        )}

                        {scanMutation.isPending && (
                            <p className="mt-4 text-sm text-gray-500">Recording scan…</p>
                        )}

                        <div className="mt-6 flex w-full gap-2">
                            <input
                                type="text"
                                placeholder="Enter QR code manually"
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value)}
                                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-[#043F2E] focus:ring-[#043F2E]"
                            />
                            <button
                                onClick={() => submitScan(manualCode.trim())}
                                disabled={!manualCode.trim()}
                                className="rounded-lg bg-[#043F2E] px-4 py-2 font-medium text-white transition-colors hover:bg-[#032f22] disabled:opacity-50"
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                )}

                {result && (
                    <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                        <div
                            className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${
                                isCheckIn ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                            }`}
                        >
                            {isCheckIn ? <LogIn className="h-10 w-10" /> : <LogOut className="h-10 w-10" />}
                        </div>
                        <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                            {isCheckIn ? 'Checked In' : 'Checked Out'}
                            {result.debounced && ' (already recorded)'}
                        </p>
                        <h3 className="mt-1 text-2xl font-bold text-gray-900">{result.employeeName}</h3>
                        <p className="font-mono text-sm text-gray-500">{result.employeeCode}</p>
                        <p className="mt-2 text-gray-600">
                            {new Date(result.occurredAt).toLocaleTimeString()}
                            {!isCheckIn && result.durationMin !== null && (
                                <span className="ml-2 font-semibold text-gray-900">
                                    · {formatDuration(result.durationMin)} worked
                                </span>
                            )}
                        </p>

                        <button
                            onClick={reset}
                            className="mt-8 w-full rounded-xl bg-[#043F2E] py-3 font-semibold text-white transition-colors hover:bg-[#032f22]"
                        >
                            Scan Next Badge
                        </button>
                    </div>
                )}

                {errorMsg && (
                    <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <AlertCircle className="h-10 w-10" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">Scan failed</h3>
                        <p className="mt-2 text-gray-600">{errorMsg}</p>
                        <button
                            onClick={reset}
                            className="mt-8 w-full rounded-xl bg-[#043F2E] py-3 font-semibold text-white transition-colors hover:bg-[#032f22]"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
