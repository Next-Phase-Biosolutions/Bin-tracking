import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { QRScanner } from '../../components/QRScanner';
import { Package, Truck, CheckCircle2, AlertCircle } from 'lucide-react';
import { setAuthToken } from '../../lib/trpc';
import type { BinWithDetails } from '@bin-tracker/types';
import { Link } from 'react-router-dom';

// Temporarily hardcode a driver token for MVP testing since there's no login yet
const TEST_DRIVER_TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6ImJiNjJmODNiLTNjMTAtNDcxZC1iYTg5LWNjOGMzNWMxZDkxYSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NhcWt5aWlsdWJsdXR3dXN3dWxrLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI1ZWZhOGE1ZC02MTQ3LTQwYzMtOWIyOS1mYTkyYTc1ODQ0MmEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzcyMDA4Mzg4LCJpYXQiOjE3NzIwMDQ3ODgsImVtYWlsIjoiZHJpdmVyMUBiaW50cmFja2VyLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJKb2huIERyaXZlciJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzcyMDA0Nzg4fV0sInNlc3Npb25faWQiOiJkNjU2NjRmNi0zZDBhLTRiODEtODBmNi1kM2Y3ZTU3MjVhZWIiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.CtKiIYmhueTpIyDO0g6863z2x_qXDiEkSYj_mrUvAzvU9gy-Skhl9-QiR7YLB9qcMoan1BdjcYTQXi2JYHuLFw";

export function DriverPage() {
    const [scannedBinId, setScannedBinId] = useState<string | null>(null);
    const [binInfo, setBinInfo] = useState<any>(null); // Simplified typing for now
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [manualQr, setManualQr] = useState<string>('');

    // Temporary auth injection for testing without login
    useState(() => {
        setAuthToken(TEST_DRIVER_TOKEN);
    });

    // tRPC procedures
    // getById is a query, but we only want to fetch when a scan happens. 
    // We can use trpc.useUtils() or just a query with enabled: !!scannedBinId
    // For simplicity, we'll keep the manual fetch pattern using trpcContext
    const trpcContext = trpc.useUtils();

    const pickupMutation = trpc.cycle.pickup.useMutation();
    const deliverMutation = trpc.cycle.deliver.useMutation();

    const handleScan = async (decodedText: string) => {
        if (decodedText !== scannedBinId) {
            setScannedBinId(decodedText);
            setActionSuccess(null);
            setIsFetching(true);

            try {        // Fetch bin details to know if we are picking up or delivering
                const details = await trpcContext.bin.getByQrCode.fetch({ qrCode: decodedText });
                setBinInfo(details);
                setFetchError(null);
            } catch (error: any) {
                console.error("Error fetching bin details:", error);
                setBinInfo(null);

                let errorMessage = error.message || "Failed to find bin";
                try {
                    const parsed = JSON.parse(errorMessage);
                    if (Array.isArray(parsed) && parsed[0]?.message) {
                        errorMessage = parsed[0].message;
                    }
                } catch (_) {
                    // Not JSON, use as is
                }

                setFetchError(errorMessage);
            } finally {
                setIsFetching(false);
            }
        }
    };

    const handlePickup = async () => {
        if (!binInfo?.activeCycle?.id) return;

        try {
            await pickupMutation.mutateAsync({
                cycleId: binInfo.activeCycle.id,
                vehicleId: "truck-01" // MOCK ID
            });
            setActionSuccess("PICKED_UP");
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeliver = async () => {
        if (!binInfo?.activeCycle?.id) return;

        try {
            await deliverMutation.mutateAsync({
                cycleId: binInfo.activeCycle.id,
                destinationId: "cmlrrc3f30004ebucz781y7uo" // Great Lakes Rendering (Mock for MVP)
            });
            setActionSuccess("DELIVERED");
        } catch (error) {
            console.error(error);
        }
    };

    const resetScan = () => {
        setScannedBinId(null);
        setBinInfo(null);
        setActionSuccess(null);
        setFetchError(null);
        pickupMutation.reset();
        deliverMutation.reset();
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-4 md:p-8 font-sans">

            {/* Header */}
            <header className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex items-center justify-between border border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="bg-[#3d5aa8] p-2 rounded-lg">
                        <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Driver Portal</h1>
                        <p className="text-sm text-gray-500">John Doe (Truck-01)</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-4 sm:mt-0">
                    <Link
                        to="/app/dashboard"
                        className="bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 shadow-sm transition-colors"
                    >
                        Dashboard
                    </Link>
                    <Link
                        to="/app/bin"
                        className="bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 shadow-sm transition-colors"
                    >
                        Bin
                    </Link>
                </div>
            </header>

            <main className="flex-1 max-w-md mx-auto w-full">
                {!scannedBinId ? (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                            <Package className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan a Bin</h2>
                        <p className="text-gray-500 mb-8">Ready to pickup or deliver? Scan the QR code on the bin to continue.</p>

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
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">

                        {/* Decorative top bar */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-[#3d5aa8]"></div>

                        <div className="flex justify-between items-start mb-6 pt-2">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Scanned Bin</h3>
                                <p className="text-xl font-bold text-gray-900 mt-1 truncate max-w-[250px]">{scannedBinId}</p>
                            </div>
                            <button
                                onClick={resetScan}
                                className="text-sm font-medium text-gray-500 hover:text-gray-900 px-3 py-1 bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>

                        {isFetching && (
                            <div className="py-8 flex flex-col items-center justify-center text-gray-500">
                                <div className="w-8 h-8 border-4 border-[#3d5aa8] border-t-transparent rounded-full animate-spin mb-4"></div>
                                <p>Fetching bin details...</p>
                            </div>
                        )}

                        {fetchError && (
                            <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold">Error finding bin</p>
                                    <p className="text-sm mt-1">{fetchError}</p>
                                </div>
                            </div>
                        )}

                        {binInfo && !actionSuccess && (
                            <div className="space-y-6">
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Status</p>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                                ${binInfo.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' :
                                                    binInfo.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-800'}`}>
                                                {binInfo.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic action buttons based on bin status */}
                                {binInfo.status === 'ACTIVE' && (
                                    <button
                                        onClick={handlePickup}
                                        disabled={pickupMutation.isPending}
                                        className="w-full bg-[#3d5aa8] hover:bg-[#2d4280] text-white py-4 rounded-xl text-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {pickupMutation.isPending ? "Processing..." : "Mark PICKED UP"}
                                        {!pickupMutation.isPending && <Truck className="w-5 h-5" />}
                                    </button>
                                )}

                                {binInfo.status === 'IN_TRANSIT' && (
                                    <button
                                        onClick={handleDeliver}
                                        disabled={deliverMutation.isPending}
                                        className="w-full bg-[#043F2E] hover:bg-[#032f22] text-white py-4 rounded-xl text-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {deliverMutation.isPending ? "Processing..." : "Mark DELIVERED"}
                                        {!deliverMutation.isPending && <CheckCircle2 className="w-5 h-5" />}
                                    </button>
                                )}

                                {['IDLE', 'DELIVERED'].includes(binInfo.status) && (
                                    <div className="text-center p-4 bg-gray-50 rounded-xl text-gray-600">
                                        This bin is currently {binInfo.status}. No action required.
                                    </div>
                                )}

                                {(pickupMutation.isError || deliverMutation.isError) && (
                                    <div className="text-red-500 text-sm text-center font-medium bg-red-50 p-3 rounded-lg">
                                        Action failed: {pickupMutation.error?.message || deliverMutation.error?.message || "Please try again"}
                                    </div>
                                )}
                            </div>
                        )}

                        {actionSuccess && (
                            <div className="py-8 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Success!</h3>
                                <p className="text-gray-500 text-lg mb-8">
                                    Bin marked as {actionSuccess.replace('_', ' ')}
                                </p>

                                <button
                                    onClick={resetScan}
                                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-xl transition-colors"
                                >
                                    Scan Next Bin
                                </button>
                            </div>
                        )}

                    </div>
                )}
            </main>
        </div>
    );
}

export default DriverPage;
