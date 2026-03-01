import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { QRScanner } from '../../components/QRScanner';
import { AlertCircle, CheckCircle2, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';

import { createStationTRPCClient } from '../../lib/trpc';

// For the MVP context where tablet is always on, we use a mock station ID 
// or one provided via URL/Config. Here we default to a test station.
const TABLET_STATION_ID = "Detroit Tablet 1";
const TABLET_STATION_TOKEN = import.meta.env.VITE_TEST_STATION_TOKEN || "";

export function TabletPage() {
    const [scannedBinId, setScannedBinId] = useState<string | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [manualQr, setManualQr] = useState<string>('');

    // Mutation states
    const [isPending, setIsPending] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<{ message: string } | null>(null);

    const handleScan = (decodedText: string) => {
        // Only update if it's a new bin to avoid constant re-renders
        if (decodedText !== scannedBinId) {
            // Very basic validation - assume it's a bin ID if we got here
            setScannedBinId(decodedText);
            setScanError(null);
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

            // Call the new dynamic start endpoint for Option B
            await stationClient.bin.startDynamic.mutate({
                masterQrCode: scannedBinId,
            });

            setIsSuccess(true);

            // Clear after 3 seconds so tablet is ready for next bin
            setTimeout(() => {
                setScannedBinId(null);
                setIsSuccess(false);
            }, 3000);

        } catch (err: any) {
            console.error("Failed to start bin:", err);
            let errorMessage = err.message || "Failed to start bin";
            try {
                const parsed = JSON.parse(errorMessage);
                if (Array.isArray(parsed) && parsed[0]?.message) {
                    errorMessage = parsed[0].message;
                }
            } catch (_) {
                // Not JSON, use as is
            }
            setError({ message: errorMessage });
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F8F2] flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">

            {/* Background design elements to align with marketing site */}
            <div className="absolute top-0 left-0 w-full h-1/3 bg-[#043F2E] rounded-b-[40px] shadow-xl z-0 pointer-events-none"></div>

            <div className="relative z-10 w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col items-center border border-[#BCD19B]/30">

                <div className="w-full text-center mb-6">
                    <h1 className="text-3xl md:text-4xl font-bold text-[#043F2E] tracking-tight">Facility Scanner</h1>
                    <p className="text-[#3d5aa8] font-medium mt-2">Station: {TABLET_STATION_ID}</p>

                    <div className="flex items-center justify-center gap-4 mt-6">
                        <Link
                            to="/app/dashboard"
                            className="bg-white hover:bg-gray-50 text-[#043F2E] px-4 py-2 rounded-lg font-semibold text-sm border border-gray-200 shadow-sm transition-colors"
                        >
                            Dashboard
                        </Link>
                        <Link
                            to="/app/driver"
                            className="bg-white hover:bg-gray-50 text-[#043F2E] px-4 py-2 rounded-lg font-semibold text-sm border border-gray-200 shadow-sm transition-colors"
                        >
                            Driver
                        </Link>
                    </div>
                </div>

                {!scannedBinId ? (
                    <div className="w-full flex flex-col items-center">
                        <div className="mb-6 flex items-center justify-center bg-[#F5F8F2] p-4 rounded-full">
                            <QrCode className="w-10 h-10 text-[#043F2E]" />
                        </div>
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 text-center">Scan Bin QR Code</h2>

                        <div className="w-full">
                            <QRScanner onScan={handleScan} />
                        </div>

                        {/* Manual Entry Fallback for Testing */}
                        <div className="w-full max-w-sm mt-6 flex gap-2">
                            <input
                                type="text"
                                placeholder="Enter QR code manually"
                                value={manualQr}
                                onChange={(e) => setManualQr(e.target.value)}
                                className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:ring-[#3d5aa8] focus:border-[#3d5aa8]"
                            />
                            <button
                                onClick={() => { if (manualQr) handleScan(manualQr) }}
                                disabled={!manualQr}
                                className="bg-[#3d5aa8] hover:bg-[#2d4280] text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                Simulate Scan
                            </button>
                        </div>

                        <p className="mt-6 text-sm text-gray-500 text-center max-w-xs">
                            Hold the bin's QR code in front of the camera until it registers.
                        </p>
                    </div>
                ) : (
                    <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-300">

                        {isSuccess ? (
                            <div className="flex flex-col items-center py-8">
                                <CheckCircle2 className="w-24 h-24 text-green-500 mb-4 animate-bounce" />
                                <h2 className="text-3xl font-bold text-[#043F2E] mb-2">Cycle Started!</h2>
                                <p className="text-gray-600 text-center text-lg">
                                    Bin <span className="font-bold text-[#3d5aa8]">{scannedBinId}</span> is now active.
                                </p>
                                <p className="text-sm text-gray-400 mt-6">Ready for next bin...</p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-[#F5F8F2] w-full p-6 rounded-2xl mb-8 border border-[#BCD19B]/50">
                                    <h3 className="text-sm uppercase tracking-wider text-gray-500 font-semibold mb-1">Scanned Bin</h3>
                                    <p className="text-2xl font-bold text-[#043F2E] truncate">{scannedBinId}</p>

                                    {/* We would ideally show organ type/DK hours here if we fetched the bin info first */}
                                    <div className="mt-4 flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                        <span className="text-blue-700 font-medium">Ready to start cycle</span>
                                    </div>
                                </div>

                                {error && (
                                    <div className="w-full bg-red-50 text-red-700 p-4 rounded-xl mb-6 flex items-start gap-3 border border-red-200">
                                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold">Could not start bin</p>
                                            <p className="text-sm mt-1">{error.message}</p>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleStart}
                                    disabled={isPending}
                                    className="w-full bg-[#043F2E] hover:bg-[#032f22] text-white py-6 rounded-2xl text-2xl font-bold uppercase tracking-wider transition-all transform active:scale-95 shadow-lg disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-3"
                                >
                                    {isPending ? (
                                        <>
                                            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Processing...
                                        </>
                                    ) : (
                                        "BIN STARTED"
                                    )}
                                </button>

                                <button
                                    onClick={() => {
                                        setScannedBinId(null);
                                        setError(null);
                                        setIsSuccess(false);
                                    }}
                                    disabled={isPending}
                                    className="mt-6 text-gray-500 hover:text-gray-800 font-medium underline-offset-4 hover:underline"
                                >
                                    Cancel & Scan Another
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default TabletPage;
