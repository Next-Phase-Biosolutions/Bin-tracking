import {
    Building2,
    ChevronRight,
    ClipboardList,
    FilePen,
    MoveUp,
    Scan,
    Settings,
    Thermometer,
    TrendingUp,
} from 'lucide-react';

interface RackCardProps {
    lotId: string;
    cut: string;
    badge: string;
    badgeVariant: 'ready' | 'aging';
    ageDays: number;
    units: number;
}

function RackCard({ lotId, cut, badge, badgeVariant, ageDays, units }: RackCardProps) {
    return (
        <div className="bg-white border border-gray-200 p-6 rounded-xl space-y-4 hover:border-[#5f5e5b] transition-colors">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">{lotId}</h3>
                    <p className="text-gray-500 text-sm font-mono uppercase tracking-wider mt-0.5">{cut}</p>
                </div>
                <span
                    className={`px-2 py-1 rounded font-mono text-[10px] font-bold uppercase ${
                        badgeVariant === 'ready'
                            ? 'bg-[#cee5da] text-[#374b43]'
                            : 'bg-gray-100 text-gray-500'
                    }`}
                >
                    {badge}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-100">
                <div>
                    <p className="text-gray-400 font-mono text-[10px] uppercase mb-1">Age</p>
                    <p className="text-xl font-bold text-[#5f5e5b]">Day {ageDays}</p>
                </div>
                <div>
                    <p className="text-gray-400 font-mono text-[10px] uppercase mb-1">Units</p>
                    <p className="text-xl font-bold text-[#5f5e5b]">{units}</p>
                </div>
            </div>
            <button className="w-full bg-gray-100 hover:bg-gray-200 py-3 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 text-gray-700">
                <Scan className="w-4 h-4" />
                Inspect
            </button>
        </div>
    );
}

const zoneActions = [
    { label: 'Move to Value Add', icon: <MoveUp className="w-5 h-5 text-[#5f5e5b]" /> },
    { label: 'Temp Log Override', icon: <FilePen className="w-5 h-5 text-[#5f5e5b]" /> },
    { label: 'Inventory Audit', icon: <ClipboardList className="w-5 h-5 text-[#5f5e5b]" /> },
];

export default function WetAgingPage() {
    return (
        <>
            {/* Header */}
            <header className="fixed top-0 w-full z-50 bg-[#fbf9f8] border-b border-gray-200 flex justify-between items-center px-5 h-16">
                <div className="flex items-center gap-4">
                    <Building2 className="w-6 h-6 text-[#5f5e5b]" />
                    <h1 className="text-xl font-bold text-[#5f5e5b]">Wet Aging Zone</h1>
                </div>
                <Settings className="w-5 h-5 text-gray-400 cursor-pointer" />
            </header>

            {/* Main */}
            <main className="pt-24 pb-32 px-8 min-h-screen">

                {/* Stat cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white border border-gray-200 p-6 rounded-xl flex flex-col justify-between h-32">
                        <span className="font-mono text-xs text-gray-500">COOLER_CAPACITY</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-serif text-[#5f5e5b]">78</span>
                            <span className="text-gray-500">%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                            <div className="bg-[#5f5e5b] h-full rounded-full" style={{ width: '78%' }} />
                        </div>
                    </div>
                    <div className="bg-white border border-gray-200 p-6 rounded-xl flex flex-col justify-between h-32">
                        <span className="font-mono text-xs text-gray-500">AVG_AGING_TIME</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-serif text-[#5f5e5b]">14</span>
                            <span className="text-gray-500 font-bold text-sm uppercase">Days</span>
                        </div>
                        <span className="text-[#52675e] font-mono text-xs flex items-center gap-1 uppercase">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Optimal
                        </span>
                    </div>
                    <div className="bg-white border border-gray-200 p-6 rounded-xl flex flex-col justify-between h-32">
                        <span className="font-mono text-xs text-gray-500">CRITICAL_ALERTS</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-serif text-[#4e635a]">0</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#4e635a]" />
                            <span className="text-gray-500 font-mono text-xs uppercase tracking-wider">System Nominal</span>
                        </div>
                    </div>
                </div>

                {/* Main grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left: Racks */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-[#5f5e5b]">Active Racks</h2>
                            <span className="font-mono text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded uppercase tracking-wider">
                                LIVE_TRACKING
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <RackCard
                                lotId="Lot A-101"
                                cut="T-BONE SELECT"
                                badge="READY_SOON"
                                badgeVariant="ready"
                                ageDays={12}
                                units={120}
                            />
                            <RackCard
                                lotId="Lot B-202"
                                cut="RIBEYE PRIME"
                                badge="AGING_START"
                                badgeVariant="aging"
                                ageDays={4}
                                units={85}
                            />
                        </div>
                    </div>

                    {/* Right: Atmosphere + Actions */}
                    <div className="lg:col-span-4 space-y-8">

                        {/* Atmosphere panel */}
                        <div className="bg-[#5f5e5b] text-white p-6 rounded-xl space-y-6">
                            <div className="flex items-center gap-2">
                                <Thermometer className="w-5 h-5" />
                                <h2 className="font-mono text-xs uppercase tracking-widest">Atmosphere</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-end border-b border-white/20 pb-4">
                                    <span className="text-white/70 font-mono text-xs uppercase">Temperature</span>
                                    <span className="text-3xl font-serif">34.2°F</span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/20 pb-4">
                                    <span className="text-white/70 font-mono text-xs uppercase">Humidity</span>
                                    <span className="text-3xl font-serif">85%</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-white/70 font-mono text-xs uppercase">CO2 Levels</span>
                                    <span className="text-3xl font-serif">412ppm</span>
                                </div>
                            </div>
                            <div className="bg-[#cee5da]/20 border border-[#cee5da]/30 p-4 rounded flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-[#cee5da] flex items-center justify-center shrink-0">
                                    <div className="w-2 h-2 rounded-full bg-[#374b43]" />
                                </div>
                                <p className="font-mono text-[10px] uppercase tracking-widest">Environment Stable</p>
                            </div>
                        </div>

                        {/* Zone Actions */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-[#5f5e5b]">Zone Actions</h2>
                            <div className="flex flex-col gap-3">
                                {zoneActions.map((action) => (
                                    <button
                                        key={action.label}
                                        className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 active:scale-[0.98] transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            {action.icon}
                                            <span className="text-base font-semibold text-gray-800">{action.label}</span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Status chip (desktop) */}
            <div className="fixed bottom-24 right-8 hidden lg:block">
                <div className="bg-gray-200 border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-3">
                    <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4e635a] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4e635a]" />
                    </div>
                    <span className="font-mono text-[11px] text-gray-500">NODE_AURA_TX: ACTIVE</span>
                </div>
            </div>
        </>
    );
}
