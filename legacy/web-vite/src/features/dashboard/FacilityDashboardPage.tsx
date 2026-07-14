import {
    ArrowRight,
    Building2,
    Cog,
    History,
    LayoutDashboard,
    LogIn,
    Package,
    Settings,
    Snowflake,
    Truck,
    Utensils,
} from 'lucide-react';
import { Link } from 'react-router-dom';

type ZoneStatus = 'complete' | 'active' | 'pending-transfer' | 'idle';

interface Zone {
    id: string;
    label: string;
    detail: string;
    status: ZoneStatus;
    icon: React.ReactNode;
    entry?: boolean;
    exit?: boolean;
}

interface LogEntry {
    id: string;
    icon: React.ReactNode;
    iconBg: string;
    text: string;
    operator: string;
    time: string;
}

const zones: Zone[] = [
    { id: 'receiving', label: 'Receiving', detail: 'Intake 120 Lots', status: 'complete', icon: <LogIn className="w-7 h-7" />, entry: true },
    { id: 'killfloor', label: 'Kill Floor', detail: 'Cleared 14:30', status: 'complete', icon: <Cog className="w-7 h-7" /> },
    { id: 'processing', label: 'Processing', detail: '42 Units Pending', status: 'active', icon: <Utensils className="w-7 h-7" /> },
    { id: 'wetaging', label: 'Wet Aging', detail: 'Awaiting Batch 4B', status: 'pending-transfer', icon: <Snowflake className="w-7 h-7" /> },
    { id: 'valueadd', label: 'Value Add-on', detail: 'Scheduled 16:00', status: 'idle', icon: <Package className="w-7 h-7" /> },
    { id: 'shipping', label: 'Shipping', detail: 'Bay 1 Available', status: 'idle', icon: <Truck className="w-7 h-7" />, exit: true },
];

const logs: LogEntry[] = [
    {
        id: '1',
        icon: <Utensils className="w-4 h-4" />,
        iconBg: 'bg-green-100 text-green-700',
        text: 'Batch 42 moved to Processing',
        operator: 'OPERATOR: J. DOE',
        time: '14:32',
    },
    {
        id: '2',
        icon: <Cog className="w-4 h-4" />,
        iconBg: 'bg-gray-100 text-gray-600',
        text: 'Kill Floor clearance confirmed',
        operator: 'SYSTEM AUTO',
        time: '14:30',
    },
    {
        id: '3',
        icon: <LogIn className="w-4 h-4" />,
        iconBg: 'bg-gray-100 text-gray-600',
        text: 'Intake Lot 88 received',
        operator: 'OPERATOR: M. SMITH',
        time: '12:15',
    },
];

function statusBadge(status: ZoneStatus) {
    switch (status) {
        case 'complete':
            return <span className="bg-gray-700 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Complete</span>;
        case 'active':
            return (
                <span className="bg-[#4e635a] text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Active
                </span>
            );
        case 'pending-transfer':
            return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Pending Transfer</span>;
        case 'idle':
            return <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Idle</span>;
    }
}

function zoneBorderAccent(status: ZoneStatus) {
    if (status === 'active') return 'border-b-4 border-b-[#4e635a]';
    if (status === 'pending-transfer') return 'border-b-4 border-b-red-400';
    return '';
}

function zoneOverlay(status: ZoneStatus) {
    if (status === 'active') return <div className="absolute inset-0 bg-[#4e635a]/5 pointer-events-none rounded-xl" />;
    if (status === 'pending-transfer') return <div className="absolute inset-0 bg-red-50/60 pointer-events-none rounded-xl" />;
    return null;
}

export default function FacilityDashboardPage() {
    return (
        <>
            {/* Desktop header — required so sidebar's top-16 offset aligns correctly */}
            <header className="hidden md:flex fixed top-0 w-full z-50 bg-white border-b border-gray-200 justify-between items-center px-5 h-16">
                <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-[#5f5e5b]" />
                    <span className="text-lg font-bold text-[#5f5e5b]">Meat Tech ERP</span>
                </div>
                <Settings className="w-5 h-5 text-gray-500" />
            </header>

            {/* Mobile top bar */}
            <header className="bg-white border-b border-gray-200 flex justify-between items-center px-5 h-16 z-40 sticky top-0 md:hidden">
                <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-[#5f5e5b]" />
                    <span className="text-lg font-bold text-[#5f5e5b]">Meat Tech ERP</span>
                </div>
                <Settings className="w-5 h-5 text-gray-500" />
            </header>

            <main className="pt-0 md:pt-16 pb-20 md:pb-8 bg-gray-50 min-h-screen">
                <div className="p-6 md:p-8 max-w-7xl mx-auto">

                    {/* Header */}
                    <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200 pb-6">
                        <div>
                            <p className="font-mono text-xs text-[#5f5e5b] tracking-widest uppercase mb-2">Zone Tracking Dashboard</p>
                            <h1 className="text-4xl md:text-5xl font-serif text-gray-900">Daily Workflow</h1>
                        </div>
                        <div className="flex flex-col items-end w-full md:w-auto">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono text-sm text-gray-500">Workflow Progress</span>
                                <span className="text-2xl font-bold text-gray-900">68%</span>
                            </div>
                            <div className="w-full md:w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-[#4e635a] w-[68%] rounded-full" />
                            </div>
                        </div>
                    </div>

                    {/* Zone grid */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-10 mb-8 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {zones.map((zone) => (
                                <button
                                    key={zone.id}
                                    className={`w-full bg-white border border-gray-200 p-6 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all text-left flex flex-col min-h-40 shadow-sm relative overflow-hidden group ${zoneBorderAccent(zone.status)}`}
                                >
                                    {zoneOverlay(zone.status)}
                                    <div className="flex justify-between items-start mb-auto relative z-10">
                                        <span className="text-[#5f5e5b]">{zone.icon}</span>
                                        {statusBadge(zone.status)}
                                    </div>
                                    <div className="relative z-10 mt-5">
                                        <div className="flex items-center gap-2 mb-1">
                                            {zone.entry && <ArrowRight className="w-4 h-4 text-[#5f5e5b]" />}
                                            <h3 className="text-xl font-bold text-gray-900">{zone.label}</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono text-sm text-gray-500">{zone.detail}</p>
                                            {zone.exit && <ArrowRight className="w-4 h-4 text-[#5f5e5b]" />}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bottom bento */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Activity log */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between mb-5">
                                <span className="font-mono text-xs text-[#5f5e5b] uppercase tracking-widest">LATEST_LOGS_V1</span>
                                <History className="w-5 h-5 text-gray-400" />
                            </div>
                            <ul className="space-y-4">
                                {logs.map((log, i) => (
                                    <li
                                        key={log.id}
                                        className={`flex items-center justify-between ${i < logs.length - 1 ? 'border-b border-gray-100 pb-4' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded ${log.iconBg}`}>{log.icon}</div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{log.text}</p>
                                                <p className="text-xs text-gray-400 uppercase tracking-wider mt-0.5">{log.operator}</p>
                                            </div>
                                        </div>
                                        <span className="font-mono text-sm text-gray-400 shrink-0 ml-4">{log.time}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Environmental */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
                            <div>
                                <span className="font-mono text-xs text-[#5f5e5b] uppercase tracking-widest mb-6 block">ENVIRONMENTAL</span>
                                <div className="space-y-5">
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm text-gray-500">Wet Aging Temp</span>
                                            <span className="text-2xl font-bold text-gray-900">34.2°F</span>
                                        </div>
                                        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#4e635a] w-[45%] rounded-full" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm text-gray-500">Processing Humidity</span>
                                            <span className="text-2xl font-bold text-gray-900">52%</span>
                                        </div>
                                        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#4e635a] w-[52%] rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button className="mt-8 w-full border border-gray-200 py-3 rounded-lg text-gray-700 text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-colors">
                                VIEW FULL REPORT
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
