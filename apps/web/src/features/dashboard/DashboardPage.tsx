import React, { useState, useRef, useEffect } from 'react';
import { trpc } from '../../lib/trpc';
import { CountdownTimer } from '../../components/CountdownTimer';
import { LayoutDashboard, AlertTriangle, PackageCheck, Box, RefreshCw, X, Clock, Truck, CheckCircle2, Calendar } from 'lucide-react';
import { setAuthToken } from '../../lib/trpc';
import { Link } from 'react-router-dom';
import { BlockchainAnchorModal } from './BlockchainAnchorModal';

type DatePreset = 'all' | '2d' | '7d' | 'custom';

function toInputDate(d: Date) {
    return d.toISOString().slice(0, 10);
}

function getPresetRange(preset: DatePreset): { from: Date | null; to: Date | null } {
    const now = new Date();
    if (preset === '2d') {
        const from = new Date(now); from.setDate(from.getDate() - 2); from.setHours(0, 0, 0, 0);
        return { from, to: now };
    }
    if (preset === '7d') {
        const from = new Date(now); from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0);
        return { from, to: now };
    }
    return { from: null, to: null };
}

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
    events: Array<{ id: string; eventType: string; timestamp: string }>;
};

function fmt(ts: string | null | undefined) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function statusLabel(s: string) {
    if (s === 'COMPLETED') return 'Delivered';
    if (s === 'IN_TRANSIT') return 'In Transit';
    return 'Active';
}

function statusBadge(s: string) {
    const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    if (s === 'ACTIVE') return `${base} bg-amber-100 text-amber-800`;
    if (s === 'IN_TRANSIT') return `${base} bg-blue-100 text-blue-800`;
    return `${base} bg-green-100 text-green-800`;
}

/* ─────────────────────────── Details slide-over ─────────────────────────── */
function DetailsSlideover({ cycle, onClose }: { cycle: CycleItem; onClose: () => void }) {
    const icons: Record<string, React.ReactNode> = {
        BIN_STARTED: <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Clock className="w-4 h-4" /></div>,
        PICKED_UP: <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center"><Truck className="w-4 h-4" /></div>,
        DELIVERED: <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><CheckCircle2 className="w-4 h-4" /></div>,
    };
    const eventLabels: Record<string, string> = {
        BIN_STARTED: 'Bin Started at Facility',
        PICKED_UP: 'Picked Up by Driver',
        DELIVERED: 'Delivered to Rendering',
    };
    const urg = cycle.bin.binType.urgency;
    const urgBadge = urg === 'CRITICAL' ? 'text-red-600 bg-red-50' : urg === 'MEDIUM' ? 'text-orange-600 bg-orange-50' : 'text-green-700 bg-green-50';

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
            <div
                className="relative bg-white w-full max-w-md h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-[#043F2E] text-white p-5 flex items-start justify-between z-10">
                    <div>
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Cycle Details</p>
                        <h2 className="text-xl font-bold truncate max-w-[260px]">{cycle.bin.qrCode}</h2>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={statusBadge(cycle.status)}>{statusLabel(cycle.status)}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${urgBadge}`}>{urg}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white p-1 mt-1 flex-shrink-0"><X className="w-6 h-6" /></button>
                </div>

                <div className="p-5 space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Organ Type', value: cycle.bin.binType.organType.toLowerCase() },
                            { label: 'DK Window', value: `${cycle.bin.binType.dkHours}h` },
                            { label: 'Origin Facility', value: cycle.facility?.name || cycle.facilityId },
                            { label: 'Deadline', value: fmt(cycle.deadline) },
                            ...(cycle.driver ? [{ label: 'Driver', value: cycle.driver.name }] : []),
                            ...(cycle.destination ? [{ label: 'Destination', value: cycle.destination.name }] : []),
                        ].map((info) => (
                            <div key={info.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">{info.label}</p>
                                <p className="font-semibold text-gray-900 text-sm capitalize break-words">{info.value}</p>
                            </div>
                        ))}
                    </div>

                    {cycle.status !== 'COMPLETED' && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-600">Time Remaining</p>
                            <CountdownTimer deadline={cycle.deadline} />
                        </div>
                    )}

                    <div>
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Event Timeline</h3>
                        {cycle.events.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">No events recorded yet.</p>
                        ) : (
                            <ol className="relative border-l border-gray-200 ml-4 space-y-6">
                                {cycle.events.map((ev) => (
                                    <li key={ev.id} className="ml-6">
                                        <div className="absolute -left-4">{icons[ev.eventType] || <div className="w-8 h-8 bg-gray-100 rounded-full" />}</div>
                                        <p className="font-semibold text-gray-900 text-sm">{eventLabels[ev.eventType] || ev.eventType}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{fmt(ev.timestamp)}</p>
                                    </li>
                                ))}
                                {cycle.status !== 'COMPLETED' && (
                                    <li className="ml-6 opacity-40">
                                        <div className="absolute -left-4">
                                            <div className="w-8 h-8 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <p className="font-semibold text-gray-500 text-sm">Awaiting Delivery</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Pending...</p>
                                    </li>
                                )}
                            </ol>
                        )}
                    </div>

                    {cycle.status === 'COMPLETED' && (cycle as any).complianceResult && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 ${(cycle as any).complianceResult === 'ON_TIME' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <CheckCircle2 className={`w-5 h-5 ${(cycle as any).complianceResult === 'ON_TIME' ? 'text-green-600' : 'text-red-500'}`} />
                            <div>
                                <p className="font-bold text-sm">{(cycle as any).complianceResult === 'ON_TIME' ? 'On Time' : 'Late Delivery'}</p>
                                <p className="text-xs text-gray-500">Delivered {fmt(cycle.deliveredAt)}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────── Shared countdown cell ─────────────────────────── */
function CycleCountdown({ item }: { item: CycleItem }) {
    if (item.status === 'COMPLETED') {
        return <span className="font-mono px-2 py-1 rounded text-center text-green-700 font-bold bg-green-50 ring-1 ring-inset ring-green-600/20 text-sm">DONE</span>;
    }
    return <CountdownTimer deadline={item.deadline} isOverdue={item.isOverdue} />;
}

/* ─────────────────────────── Main Page ─────────────────────────── */
export function DashboardPage() {
    const [selectedFacility, setSelectedFacility] = useState<string | undefined>(undefined);
    const [selectedCycle, setSelectedCycle] = useState<CycleItem | null>(null);
    const [anchorModalOpen, setAnchorModalOpen] = useState(false);
    const [datePreset, setDatePreset] = useState<DatePreset>('all');
    const [customFrom, setCustomFrom] = useState<string>(toInputDate(new Date(Date.now() - 7 * 86400000)));
    const [customTo, setCustomTo] = useState<string>(toInputDate(new Date()));
    const [calendarOpen, setCalendarOpen] = useState(false);
    const calendarRef = useRef<HTMLDivElement>(null);

    useState(() => { setAuthToken(TEST_ADMIN_TOKEN); });

    // Close calendar when clicking outside
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
                setCalendarOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const { data: activeBins, isLoading: isBinsLoading, refetch } = trpc.dashboard.priorityQueue.useQuery(
        { limit: 100 },
        { refetchInterval: 10000 }
    );
    const { data: stats } = trpc.dashboard.stats.useQuery();

    // Compute effective date range
    const dateRange = datePreset === 'custom'
        ? { from: customFrom ? new Date(customFrom + 'T00:00:00') : null, to: customTo ? new Date(customTo + 'T23:59:59') : null }
        : getPresetRange(datePreset);

    const filteredBins = (activeBins?.items || []).filter(i => {
        if (selectedFacility && i.facilityId !== selectedFacility) return false;
        if (dateRange.from && new Date(i.startedAt) < dateRange.from) return false;
        if (dateRange.to && new Date(i.startedAt) > dateRange.to) return false;
        return true;
    });

    const uniqueFacilities = Array.from(
        new Map((activeBins?.items || []).map(i => [i.facilityId, i.facility])).entries()
    );

    const statsCards = [
        { label: 'Active Bins', value: stats?.totalActiveBins || 0, icon: <Box className="w-5 h-5 md:w-6 md:h-6" />, color: 'bg-blue-50 text-blue-600', textColor: 'text-gray-900' },
        { label: 'Overdue', value: stats?.totalOverdue || 0, icon: <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />, color: 'bg-red-50 text-red-600', textColor: 'text-red-600', pulse: (stats?.totalOverdue ?? 0) > 0 },
        { label: 'Done Today', value: stats?.totalCompletedToday || 0, icon: <PackageCheck className="w-5 h-5 md:w-6 md:h-6" />, color: 'bg-green-50 text-green-600', textColor: 'text-gray-900' },
        { label: 'Compliance', value: `${stats?.complianceRate || 100}%`, icon: <span className="text-xs font-bold">CR</span>, color: 'bg-green-50 text-green-600', textColor: 'text-gray-900' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">

            {/* ── Header ── */}
            <header className="bg-[#043F2E] text-white p-4 shadow-md sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-lg"><LayoutDashboard className="w-6 h-6" /></div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Ops Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <Link to="/app/driver" className="bg-white hover:bg-gray-100 text-[#043F2E] px-3 md:px-4 py-2 rounded-lg text-sm font-semibold transition-colors">Driver</Link>
                        <Link to="/app/bin" className="bg-white hover:bg-gray-100 text-[#043F2E] px-3 md:px-4 py-2 rounded-lg text-sm font-semibold transition-colors">Bin</Link>
                        <button
                            onClick={() => setAnchorModalOpen(true)}
                            className="bg-purple-500 hover:bg-purple-400 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                            title="Post today's operations on Cardano blockchain"
                        >
                            <span>⛓</span>
                            <span className="hidden md:inline">Post on Blockchain</span>
                        </button>
                        <button onClick={() => refetch()} className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                            <RefreshCw className="w-4 h-4" /><span className="hidden md:inline">Refresh</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto p-3 md:p-6 lg:p-8">

                {/* ── Stats cards: 2-col mobile, 4-col lg ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-4 md:mb-8">
                    {statsCards.map((c) => (
                        <div key={c.label} className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs md:text-sm font-medium text-gray-500 uppercase tracking-wider">{c.label}</p>
                                <p className={`text-2xl md:text-3xl font-bold mt-1 md:mt-2 ${c.textColor}`}>{c.value}</p>
                            </div>
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center relative ${c.color}`}>
                                {c.pulse && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse" />}
                                {c.icon}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Priority Queue container ── */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

                    {/* Queue header */}
                    <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                            All Cycles
                            <span className="bg-[#3d5aa8] text-white text-xs font-bold px-2 py-0.5 rounded-full">{filteredBins.length}</span>
                        </h2>
                        <div className="flex flex-wrap items-center gap-3">

                            {/* ── Facility filter ── */}
                            <select
                                id="facility-filter"
                                value={selectedFacility || ''}
                                onChange={(e) => setSelectedFacility(e.target.value || undefined)}
                                className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg p-2 pr-8 focus:ring-[#3d5aa8] focus:border-[#3d5aa8]"
                            >
                                <option value="">All Facilities</option>
                                {uniqueFacilities.map(([fid, fac]) => (
                                    <option key={fid} value={fid}>{fac?.name || fid}</option>
                                ))}
                            </select>

                            {/* ── Date preset pills ── */}
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                {(['all', '2d', '7d', 'custom'] as DatePreset[]).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => { setDatePreset(p); if (p === 'custom') setCalendarOpen(true); else setCalendarOpen(false); }}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${datePreset === p ? 'bg-white text-[#3d5aa8] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                    >
                                        {p === 'custom' && <Calendar className="w-3 h-3" />}
                                        {p === 'all' ? 'All Time' : p === '2d' ? '2 Days' : p === '7d' ? '7 Days' : 'Custom'}
                                    </button>
                                ))}
                            </div>

                            {/* ── Custom calendar popover ── */}
                            {datePreset === 'custom' && (
                                <div className="relative" ref={calendarRef}>
                                    <button
                                        onClick={() => setCalendarOpen(o => !o)}
                                        className="flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
                                    >
                                        <Calendar className="w-4 h-4 text-[#3d5aa8]" />
                                        <span>{customFrom || 'From'}</span>
                                        <span className="text-gray-400">→</span>
                                        <span>{customTo || 'To'}</span>
                                    </button>
                                    {calendarOpen && (
                                        <div className="absolute right-0 mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-72">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Date Range</p>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs text-gray-500 font-medium mb-1 block">From</label>
                                                    <input
                                                        type="date"
                                                        value={customFrom}
                                                        max={customTo || toInputDate(new Date())}
                                                        onChange={(e) => setCustomFrom(e.target.value)}
                                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#3d5aa8] focus:border-transparent outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 font-medium mb-1 block">To</label>
                                                    <input
                                                        type="date"
                                                        value={customTo}
                                                        min={customFrom}
                                                        max={toInputDate(new Date())}
                                                        onChange={(e) => setCustomTo(e.target.value)}
                                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[#3d5aa8] focus:border-transparent outline-none"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => setCalendarOpen(false)}
                                                    className="w-full bg-[#3d5aa8] hover:bg-[#2d4898] text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── MOBILE: card list (hidden md+) ── */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {isBinsLoading ? (
                            <div className="p-8 flex items-center justify-center gap-3 text-gray-500 text-sm">
                                <div className="w-5 h-5 border-4 border-[#3d5aa8] border-t-transparent rounded-full animate-spin" />
                                Loading...
                            </div>
                        ) : filteredBins.length > 0 ? (
                            filteredBins.map((item) => (
                                <div key={item.id} className="p-4 space-y-3 active:bg-gray-50">
                                    {/* Countdown + status */}
                                    <div className="flex items-center justify-between gap-2">
                                        <CycleCountdown item={item as unknown as CycleItem} />
                                        <span className={statusBadge(item.status)}>{statusLabel(item.status)}</span>
                                    </div>
                                    {/* Bin ID + organ */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 text-sm truncate">{item.bin.qrCode}</p>
                                            <p className="text-xs text-gray-400 font-mono">#{item.id.slice(0, 8)}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm text-gray-700 flex-shrink-0">
                                            <div className={`w-2 h-2 rounded-full ${item.bin.binType.urgency === 'CRITICAL' ? 'bg-red-500' : 'bg-green-500'}`} />
                                            <span className="capitalize font-medium">{item.bin.binType.organType.toLowerCase()}</span>
                                        </div>
                                    </div>
                                    {/* Facility + started + details */}
                                    <div className="flex items-end justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-700">{(item as any).facility?.name || item.facilityId}</p>
                                            <p className="text-xs text-gray-400">
                                                Started {new Date(item.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedCycle(item as unknown as CycleItem)}
                                            className="flex-shrink-0 text-[#3d5aa8] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                                        >
                                            Details
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500 text-sm">No cycles found.</div>
                        )}
                    </div>

                    {/* ── DESKTOP: table (hidden below md) ── */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    {['Countdown', 'Bin ID', 'Organ Type', 'Status', 'Facility', 'Started', 'Actions'].map((h) => (
                                        <th key={h} className={`p-4 font-semibold text-gray-600 text-sm border-b border-gray-100 ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isBinsLoading ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-gray-500">
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="w-6 h-6 border-4 border-[#3d5aa8] border-t-transparent rounded-full animate-spin" />
                                            Loading priority queue...
                                        </div>
                                    </td></tr>
                                ) : filteredBins.length > 0 ? (
                                    filteredBins.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4 align-middle"><CycleCountdown item={item as unknown as CycleItem} /></td>
                                            <td className="p-4 align-middle">
                                                <p className="font-semibold text-gray-900 truncate max-w-[150px]" title={item.bin.qrCode}>{item.bin.qrCode}</p>
                                                <p className="text-xs text-gray-400 font-mono mt-0.5">#{item.id.slice(0, 8)}</p>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.bin.binType.urgency === 'CRITICAL' ? 'bg-red-500' : 'bg-green-500'}`} />
                                                    <span className="capitalize font-medium text-gray-700">{item.bin.binType.organType.toLowerCase()}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle"><span className={statusBadge(item.status)}>{statusLabel(item.status)}</span></td>
                                            <td className="p-4 align-middle text-gray-600 text-sm font-medium">{(item as any).facility?.name || item.facilityId}</td>
                                            <td className="p-4 align-middle text-gray-500 text-sm">
                                                <p>{new Date(item.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                <p className="text-xs text-gray-400">{new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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
                                    <tr><td colSpan={7} className="p-8 text-center text-gray-500 bg-gray-50/50">No cycles found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            </main>

            {selectedCycle && <DetailsSlideover cycle={selectedCycle} onClose={() => setSelectedCycle(null)} />}
            {anchorModalOpen && <BlockchainAnchorModal onClose={() => setAnchorModalOpen(false)} />}
        </div>
    );
}

export default DashboardPage;
