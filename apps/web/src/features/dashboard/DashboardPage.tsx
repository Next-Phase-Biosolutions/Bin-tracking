import React, { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { CountdownTimer } from '../../components/CountdownTimer';
import { LayoutDashboard, AlertTriangle, ArrowRightCircle, PackageCheck, Box, RefreshCw, X, Clock, Truck, CheckCircle2, MapPin } from 'lucide-react';
import { setAuthToken } from '../../lib/trpc';
import { Link } from 'react-router-dom';

// Temporarily pull the admin token from Environment Variables for MVP testing
const TEST_ADMIN_TOKEN = import.meta.env.VITE_TEST_ADMIN_TOKEN || "";

type CycleItem = {
    id: string;
    status: string;
    deadline: string;
    isOverdue: boolean;
    startedAt: string;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    facilityId: string;
    facility: { id: string; name: string } | null;
    destination: { id: string; name: string } | null;
    driver: { id: string; name: string } | null;
    bin: {
        qrCode: string;
        binType: { organType: string; dkHours: number; urgency: string };
        currentFacility: { id: string; name: string } | null;
    };
    events: Array<{ id: string; eventType: string; timestamp: string; driverId?: string | null; stationId?: string | null }>;
};

function formatTime(ts: string | null | undefined) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function DetailsSlideover({ cycle, onClose }: { cycle: CycleItem; onClose: () => void }) {
    const eventIcons: Record<string, React.ReactNode> = {
        BIN_STARTED: <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Clock className="w-4 h-4" /></div>,
        PICKED_UP: <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center"><Truck className="w-4 h-4" /></div>,
        DELIVERED: <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><CheckCircle2 className="w-4 h-4" /></div>,
    };

    const eventLabels: Record<string, string> = {
        BIN_STARTED: 'Bin Started at Facility',
        PICKED_UP: 'Picked Up by Driver',
        DELIVERED: 'Delivered to Rendering',
    };

    const urgencyColor = cycle.bin.binType.urgency === 'CRITICAL' ? 'text-red-600 bg-red-50' :
        cycle.bin.binType.urgency === 'MEDIUM' ? 'text-orange-600 bg-orange-50' : 'text-green-700 bg-green-50';

    const statusColor = cycle.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' :
        cycle.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
            'bg-green-100 text-green-800';

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
            <div
                className="relative bg-white w-full max-w-md h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-[#043F2E] text-white p-5 flex items-start justify-between z-10">
                    <div>
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Cycle Details</p>
                        <h2 className="text-xl font-bold truncate max-w-[280px]">{cycle.bin.qrCode}</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
                                {cycle.status === 'ACTIVE' ? 'Active' : cycle.status === 'IN_TRANSIT' ? 'In Transit' : 'Delivered'}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${urgencyColor}`}>
                                {cycle.bin.binType.urgency}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white p-1 mt-1">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-5 space-y-6">
                    {/* Key Info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Organ Type</p>
                            <p className="font-semibold text-gray-900 capitalize">{cycle.bin.binType.organType.toLowerCase()}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">DK Window</p>
                            <p className="font-semibold text-gray-900">{cycle.bin.binType.dkHours}h</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Origin Facility</p>
                            <p className="font-semibold text-gray-900 text-sm">{cycle.facility?.name || cycle.facilityId}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Deadline</p>
                            <p className="font-semibold text-gray-900 text-sm">{formatTime(cycle.deadline)}</p>
                        </div>
                        {cycle.driver && (
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">Driver</p>
                                <p className="font-semibold text-gray-900 text-sm">{cycle.driver.name}</p>
                            </div>
                        )}
                        {cycle.destination && (
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">Destination</p>
                                <p className="font-semibold text-gray-900 text-sm flex items-center gap-1"><MapPin className="w-3 h-3" />{cycle.destination.name}</p>
                            </div>
                        )}
                    </div>

                    {/* Countdown / Status */}
                    {cycle.status !== 'COMPLETED' && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-600">Time Remaining</p>
                            <CountdownTimer deadline={cycle.deadline} />
                        </div>
                    )}

                    {/* Timeline */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Event Timeline</h3>
                        {cycle.events.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">No events recorded yet.</p>
                        ) : (
                            <ol className="relative border-l border-gray-200 ml-4 space-y-6">
                                {cycle.events.map((event) => (
                                    <li key={event.id} className="ml-6">
                                        <div className="absolute -left-4">
                                            {eventIcons[event.eventType] || (
                                                <div className="w-8 h-8 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-xs font-bold">?</div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900 text-sm">
                                                {eventLabels[event.eventType] || event.eventType}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">{formatTime(event.timestamp)}</p>
                                        </div>
                                    </li>
                                ))}
                                {/* Future placeholder if not yet delivered */}
                                {cycle.status !== 'COMPLETED' && (
                                    <li className="ml-6 opacity-40">
                                        <div className="absolute -left-4">
                                            <div className="w-8 h-8 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-500 text-sm">Awaiting Delivery</p>
                                            <p className="text-xs text-gray-400 mt-0.5">Pending...</p>
                                        </div>
                                    </li>
                                )}
                            </ol>
                        )}
                    </div>

                    {/* Compliance if completed */}
                    {cycle.status === 'COMPLETED' && (cycle as any).complianceResult && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 ${(cycle as any).complianceResult === 'ON_TIME' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <CheckCircle2 className={`w-5 h-5 ${(cycle as any).complianceResult === 'ON_TIME' ? 'text-green-600' : 'text-red-500'}`} />
                            <div>
                                <p className="font-bold text-sm">{(cycle as any).complianceResult === 'ON_TIME' ? 'On Time' : 'Late Delivery'}</p>
                                <p className="text-xs text-gray-500">Delivered {formatTime(cycle.deliveredAt)}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function DashboardPage() {
    const [selectedFacility, setSelectedFacility] = useState<string | undefined>(undefined);
    const [selectedCycle, setSelectedCycle] = useState<CycleItem | null>(null);

    // Temporary auth injection for testing without login
    useState(() => {
        setAuthToken(TEST_ADMIN_TOKEN);
    });

    // Poll the active bins every 10 seconds for the priority queue
    const { data: activeBins, isLoading: isBinsLoading, refetch } = trpc.dashboard.priorityQueue.useQuery(
        { limit: 50 },
        { refetchInterval: 10000 }
    );

    const { data: stats } = trpc.dashboard.stats.useQuery();

    const handleManualRefresh = () => {
        refetch();
    };

    // Filter locally for now, since we fetch the queue globally
    const filteredBins = selectedFacility
        ? activeBins?.items.filter(item => item.facilityId === selectedFacility)
        : activeBins?.items;

    // Get unique facilities from the active bins for the dropdown filter
    const uniqueFacilities = Array.from(
        new Map((activeBins?.items || []).map(item => [item.facilityId, item.facility])).entries()
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">

            {/* Header Navbar */}
            <header className="bg-[#043F2E] text-white p-4 shadow-md sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-lg">
                            <LayoutDashboard className="w-6 h-6" />
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Ops Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/app/driver" className="bg-white hover:bg-gray-100 text-[#043F2E] px-4 py-2 rounded-lg text-sm font-semibold transition-colors hidden md:block">Driver</Link>
                        <Link to="/app/bin" className="bg-white hover:bg-gray-100 text-[#043F2E] px-4 py-2 rounded-lg text-sm font-semibold transition-colors hidden md:block">Bin</Link>
                        <button onClick={handleManualRefresh} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                            <RefreshCw className="w-4 h-4" />
                            <span className="hidden md:inline">Refresh</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8">

                {/* Top Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Active Bins</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalActiveBins || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><Box className="w-6 h-6" /></div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Overdue</p>
                            <p className="text-3xl font-bold text-red-600 mt-2">{stats?.totalOverdue || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center relative">
                            {(stats?.totalOverdue ?? 0) > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse" />}
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Completed Today</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalCompletedToday || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center"><PackageCheck className="w-6 h-6" /></div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Compliance Rate</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.complianceRate || 100}%</p>
                        </div>
                        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center tracking-tighter font-bold">CR</div>
                    </div>
                </div>

                {/* Priority Queue Table */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            Priority Queue
                            <span className="bg-[#3d5aa8] text-white text-xs font-bold px-2 py-0.5 rounded-full">{filteredBins?.length || 0}</span>
                        </h2>
                        <div className="flex items-center gap-3">
                            <label htmlFor="facility-filter" className="text-sm font-medium text-gray-600">Filter:</label>
                            <select
                                id="facility-filter"
                                value={selectedFacility || ''}
                                onChange={(e) => setSelectedFacility(e.target.value || undefined)}
                                className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-[#3d5aa8] focus:border-[#3d5aa8] p-2 pr-8"
                            >
                                <option value="">All Facilities</option>
                                {uniqueFacilities.map(([fid, facility]) => (
                                    <option key={fid} value={fid}>{facility?.name || fid}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100 w-32">Countdown</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">Bin ID</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">Organ Type</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">Status</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">Facility</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">Started</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isBinsLoading ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500">
                                            <div className="flex items-center justify-center gap-3">
                                                <div className="w-6 h-6 border-4 border-[#3d5aa8] border-t-transparent rounded-full animate-spin" />
                                                Loading priority queue...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredBins && filteredBins.length > 0 ? (
                                    filteredBins.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4 align-middle">
                                                {item.status === 'COMPLETED' ? (
                                                    <span className="font-mono px-2 py-1 rounded inline-block min-w-[90px] text-center text-green-700 font-bold bg-green-50 ring-1 ring-inset ring-green-600/20">DONE</span>
                                                ) : (
                                                    <CountdownTimer deadline={item.deadline} isOverdue={item.isOverdue} />
                                                )}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <p className="font-semibold text-gray-900 truncate max-w-[150px]" title={item.bin.qrCode}>{item.bin.qrCode}</p>
                                                <p className="text-xs text-gray-400 font-mono mt-0.5">#{item.id.slice(0, 8)}</p>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${item.bin.binType.urgency === 'CRITICAL' ? 'bg-red-500' : 'bg-green-500'}`} />
                                                    <span className="capitalize font-medium text-gray-700">{item.bin.binType.organType.toLowerCase()}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                    ${item.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' :
                                                        item.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-green-100 text-green-800'}`}>
                                                    {item.status === 'COMPLETED' ? 'Delivered' : item.status === 'IN_TRANSIT' ? 'In Transit' : 'Active'}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle text-gray-600 text-sm font-medium">
                                                {(item as any).facility?.name || item.facilityId}
                                            </td>
                                            <td className="p-4 align-middle text-gray-500 text-sm">
                                                {new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <button
                                                    onClick={() => setSelectedCycle(item as unknown as CycleItem)}
                                                    className="text-[#3d5aa8] hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                                                >
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500 bg-gray-50/50">No active bins found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Details slide-over */}
            {selectedCycle && (
                <DetailsSlideover cycle={selectedCycle} onClose={() => setSelectedCycle(null)} />
            )}
        </div>
    );
}

export default DashboardPage;
