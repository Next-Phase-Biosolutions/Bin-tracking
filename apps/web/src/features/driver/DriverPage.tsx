import { useState, useEffect } from 'react';
import { trpc } from '../../lib/trpc';
import { QRScanner } from '../../components/QRScanner';
import { Package, Truck, CheckCircle2, AlertCircle } from 'lucide-react';
import { setAuthToken } from '../../lib/trpc';
import { Link } from 'react-router-dom';

// Temporarily pull the driver token from Environment Variables for MVP testing
const TEST_DRIVER_TOKEN = import.meta.env.VITE_TEST_DRIVER_TOKEN || "";

export function DriverPage() {
    const [scannedBinId, setScannedBinId] = useState<string | null>(null);
    const [binOptions, setBinOptions] = useState<any[]>([]);
    const [selectedBinId, setSelectedBinId] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [manualQr, setManualQr] = useState<string>('');
    // Controls whether the QR scanner is live (prevents auto-re-trigger after success)
    const [isScannerActive, setIsScannerActive] = useState(true);
    // Destination facility selection for deliver
    const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');

    // Temporary auth injection for testing without login
    useState(() => {
        setAuthToken(TEST_DRIVER_TOKEN);
    });

    // Fetch all RENDERING facilities on mount so we have real IDs for deliver
    const renderingFacilitiesQuery = trpc.facility.list.useQuery(
        { type: 'RENDERING', limit: 50 },
        { staleTime: 60_000 }
    );
    const renderingFacilities = renderingFacilitiesQuery.data?.items ?? [];

    // Auto-select the first rendering facility when they load
    useEffect(() => {
        if (renderingFacilities.length > 0 && !selectedDestinationId) {
            setSelectedDestinationId(renderingFacilities[0]!.id);
        }
    }, [renderingFacilities, selectedDestinationId]);

    const trpcContext = trpc.useUtils();

    const pickupMutation = trpc.cycle.pickup.useMutation();
    const deliverMutation = trpc.cycle.deliver.useMutation();

    const handleScan = async (decodedText: string) => {
        if (decodedText !== scannedBinId) {
            setScannedBinId(decodedText);
            setActionSuccess(null);
            setIsFetching(true);
            setBinOptions([]);
            setSelectedBinId(null);
            setFetchError(null);

            try {
                // Fetch dynamic bin matches
                const options = await trpcContext.bin.getActiveDynamicMatches.fetch({ qrCode: decodedText });

                if (options.length === 0) {
                    setFetchError("No accessible active bins found for this code.");
                } else if (options.length === 1) {
                    // Auto-select if there's only one exactly
                    setBinOptions(options);
                    setSelectedBinId(options[0].id);
                } else {
                    // Show selection UI
                    setBinOptions(options);
                }

            } catch (error: any) {
                console.error("Error fetching bin details:", error);
                let errorMessage = error.message || "Failed to find bin";
                try {
                    const parsed = JSON.parse(errorMessage);
                    if (Array.isArray(parsed) && parsed[0]?.message) {
                        errorMessage = parsed[0].message;
                    }
                } catch (_) { }

                setFetchError(errorMessage);
            } finally {
                setIsFetching(false);
            }
        }
    };

    const binInfo = binOptions.find(b => b.id === selectedBinId);

    const handlePickup = async () => {
        if (!binInfo?.activeCycle?.id) return;

        try {
            const result = await pickupMutation.mutateAsync({
                cycleId: binInfo.activeCycle.id,
                vehicleId: undefined, // No fixed vehicle assignment in MVP
            });
            // Update the local binInfo status to IN_TRANSIT immediately so the UI is correct
            setBinOptions(prev => prev.map(b =>
                b.id === selectedBinId
                    ? { ...b, status: 'IN_TRANSIT', activeCycle: { ...b.activeCycle, ...result } }
                    : b
            ));
            // Invalidate cache so any subsequent scan fetches fresh data
            await trpcContext.bin.getActiveDynamicMatches.invalidate();
            setActionSuccess("PICKED_UP");
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeliver = async () => {
        if (!binInfo?.activeCycle?.id) return;
        if (!selectedDestinationId) {
            alert('Please select a destination rendering facility.');
            return;
        }
        try {
            await deliverMutation.mutateAsync({
                cycleId: binInfo.activeCycle.id,
                destinationId: selectedDestinationId,
            });
            // Immediately update binOptions to IDLE so the deliver UI can never re-flash
            // even if actionSuccess is briefly cleared by a React re-render race
            setBinOptions(prev => prev.map(b =>
                b.id === selectedBinId
                    ? { ...b, status: 'IDLE', activeCycle: null }
                    : b
            ));
            await trpcContext.bin.getActiveDynamicMatches.invalidate();
            setActionSuccess("DELIVERED");
        } catch (error) {
            console.error(error);
        }
    };

    const resetScan = () => {
        setScannedBinId(null);
        setBinOptions([]);
        setSelectedBinId(null);
        setActionSuccess(null);
        setFetchError(null);
        pickupMutation.reset();
        deliverMutation.reset();
        // Keep scanner OFF after reset — user must press "Scan Next Bin" to re-activate
        // This prevents the scanner from immediately re-firing the same QR code
        setIsScannerActive(false);
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

                        {isScannerActive ? (
                            <div className="w-full">
                                <QRScanner onScan={handleScan} />
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsScannerActive(true)}
                                className="w-full bg-[#3d5aa8] hover:bg-[#2d4280] text-white py-4 rounded-xl text-lg font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <Package className="w-5 h-5" /> Tap to Start Scanning
                            </button>
                        )}

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
                                onClick={() => { if (manualQr) { setIsScannerActive(true); handleScan(manualQr); } }}
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

                        {!isFetching && !fetchError && binOptions.length > 1 && !selectedBinId && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <h4 className="font-medium text-gray-800">Multiple active cycles found. Select the physical bin you are holding:</h4>
                                <div className="space-y-3">
                                    {binOptions.map((bin, index) => (
                                        <button
                                            key={bin.id}
                                            onClick={() => setSelectedBinId(bin.id)}
                                            className="w-full bg-white border-2 border-gray-200 hover:border-[#3d5aa8] p-4 rounded-xl text-left transition-all active:scale-[0.98] group"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-gray-900 group-hover:text-[#3d5aa8]">
                                                    Option {index + 1}
                                                </span>
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${bin.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                    {bin.status}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-500 flex flex-col gap-1">
                                                <span>Facility: {bin.currentFacility?.name || 'Unknown'}</span>
                                                <span className="font-mono text-xs opacity-70">ID: {bin.qrCode}</span>
                                                {bin.activeCycle?.startedAt && (
                                                    <span>Started: {new Date(bin.activeCycle.startedAt).toLocaleTimeString()}</span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {binInfo && !actionSuccess && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                {binOptions.length > 1 && (
                                    <button
                                        onClick={() => setSelectedBinId(null)}
                                        className="text-sm text-[#3d5aa8] font-medium hover:underline mb-2"
                                    >
                                        &larr; Back to selection
                                    </button>
                                )}
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Assigned ID</p>
                                            <span className="font-mono text-xs font-semibold">{binInfo.qrCode}</span>
                                        </div>
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
                                    <div className="space-y-3">
                                        {/* Destination facility picker */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Deliver To (Rendering Facility)</label>
                                            {renderingFacilitiesQuery.isLoading ? (
                                                <p className="text-sm text-gray-400">Loading facilities...</p>
                                            ) : renderingFacilities.length === 0 ? (
                                                <p className="text-sm text-red-500">No rendering facilities found. Contact admin.</p>
                                            ) : renderingFacilities.length === 1 ? (
                                                <p className="text-sm font-semibold text-gray-800 bg-gray-50 p-2 rounded-lg">{renderingFacilities[0]!.name}</p>
                                            ) : (
                                                <select
                                                    value={selectedDestinationId}
                                                    onChange={(e) => setSelectedDestinationId(e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-[#3d5aa8] focus:border-[#3d5aa8]"
                                                >
                                                    {renderingFacilities.map(f => (
                                                        <option key={f.id} value={f.id}>{f.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleDeliver}
                                            disabled={deliverMutation.isPending || !selectedDestinationId}
                                            className="w-full bg-[#043F2E] hover:bg-[#032f22] text-white py-4 rounded-xl text-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {deliverMutation.isPending ? "Processing..." : "Mark DELIVERED"}
                                            {!deliverMutation.isPending && <CheckCircle2 className="w-5 h-5" />}
                                        </button>
                                    </div>
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
                                    className="px-6 py-3 bg-[#3d5aa8] hover:bg-[#2d4280] text-white font-semibold rounded-xl transition-colors"
                                >
                                    Done — Back to Scan
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
