import {
    Building2,
    CirclePlus,
    Droplets,
    ListChecks,
    Package,
    Printer,
    Settings,
    Thermometer,
    Trash2,
    Utensils,
    Zap,
} from 'lucide-react';

const breadcrumbZones = ['Receiving', 'Kill Floor', 'Processing', 'Wet Aging', 'Value Add'];

interface ProjectCardProps {
    badge: string;
    badgeVariant: 'active' | 'priority';
    batchRef: string;
    title: string;
    icon: React.ReactNode;
    units: number;
    metaLabel: string;
    metaValue: string;
}

function ProjectCard({ badge, badgeVariant, batchRef, title, icon, units, metaLabel, metaValue }: ProjectCardProps) {
    return (
        <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <span
                    className={`px-3 py-1 rounded-lg font-mono text-[10px] font-bold uppercase ${
                        badgeVariant === 'active'
                            ? 'bg-[#cee5da] text-[#52675e]'
                            : 'bg-[#f5f2ed] text-[#6f6e6a]'
                    }`}
                >
                    {badge}
                </span>
                <span className="font-mono text-sm text-gray-500">{batchRef}</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
            <div className="flex items-center gap-2 mb-6">
                <span className="text-[#5f5e5b]">{icon}</span>
                <span className="text-xl font-bold text-gray-700">{units} units</span>
            </div>
            <div className="w-full bg-gray-100 p-4 rounded-lg flex justify-between items-center border border-gray-200/50">
                <span className="font-mono text-[11px] text-gray-500 uppercase tracking-wider">{metaLabel}</span>
                <span className="font-mono text-sm font-bold text-gray-900">{metaValue}</span>
            </div>
        </div>
    );
}

export default function ValueAddPage() {
    return (
        <>
            {/* Header */}
            <header className="fixed top-0 w-full z-50 bg-[#fbf9f8] border-b border-gray-200 flex justify-between items-center px-5 h-16">
                <div className="flex items-center gap-4">
                    <Building2 className="w-5 h-5 text-[#5f5e5b]" />
                    <h1 className="text-xl font-bold text-[#5f5e5b]">Value Add Zone</h1>
                </div>
                <div className="flex items-center gap-6">
                    <div className="hidden md:flex gap-4 items-center">
                        {breadcrumbZones.map((zone) => {
                            const isActive = zone === 'Value Add';
                            return (
                                <span
                                    key={zone}
                                    className={`font-mono text-xs uppercase tracking-widest ${
                                        isActive
                                            ? 'text-[#5f5e5b] border-b-2 border-[#5f5e5b] pb-0.5 font-bold'
                                            : 'text-gray-400'
                                    }`}
                                >
                                    {zone}
                                </span>
                            );
                        })}
                    </div>
                    <button className="hover:bg-gray-100 p-2 rounded-full transition-colors">
                        <Settings className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
            </header>

            {/* Main */}
            <main className="pt-16 pb-24 px-8 min-h-screen">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Stat cards */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                        <div className="bg-gray-50 p-6 border border-gray-200 rounded-lg flex flex-col justify-between h-40">
                            <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">PREP QUOTA</span>
                            <div className="flex items-end justify-between">
                                <span className="text-4xl font-serif text-[#5f5e5b]">65%</span>
                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="bg-[#4e635a] h-full rounded-full" style={{ width: '65%' }} />
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-6 border border-gray-200 rounded-lg flex flex-col justify-between h-40">
                            <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">ACTIVE STAFF</span>
                            <span className="text-4xl font-serif text-[#5f5e5b]">08</span>
                            <span className="font-mono text-sm text-[#374b43]">STATIONS_MANNED_5/6</span>
                        </div>
                        <div className="bg-gray-50 p-6 border border-gray-200 rounded-lg flex flex-col justify-between h-40">
                            <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">PREP STATIONS</span>
                            <span className="text-4xl font-serif text-[#5f5e5b]">06</span>
                            <span className="font-mono text-sm text-[#374b43]">STATUS_ALL_OPERATIONAL</span>
                        </div>
                    </section>

                    {/* Bento grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* Left: Projects + Environmental */}
                        <div className="lg:col-span-8 space-y-6">
                            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <ListChecks className="w-4 h-4" />
                                Current Projects
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ProjectCard
                                    badge="ACTIVE"
                                    badgeVariant="active"
                                    batchRef="BATCH #12"
                                    title="Marination Batch"
                                    icon={<Package className="w-5 h-5" />}
                                    units={50}
                                    metaLabel="SOAK TIME"
                                    metaValue="02:45:00"
                                />
                                <ProjectCard
                                    badge="PRIORITY"
                                    badgeVariant="priority"
                                    batchRef="ORDER #77"
                                    title="Custom Cuts"
                                    icon={<Utensils className="w-5 h-5" />}
                                    units={12}
                                    metaLabel="STATION"
                                    metaValue="S-04_B"
                                />
                            </div>

                            {/* Environmental row */}
                            <div className="bg-gray-50 p-8 rounded-xl border border-gray-200 grid grid-cols-2 gap-8">
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Thermometer className="w-5 h-5 text-gray-500" />
                                        <span className="font-mono text-xs text-gray-500 uppercase tracking-wider">Zone Temp</span>
                                    </div>
                                    <div className="text-4xl font-serif text-[#5f5e5b]">4.2°C</div>
                                    <span className="font-mono text-sm text-[#374b43]">STABLE_COMPLIANT</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Droplets className="w-5 h-5 text-gray-500" />
                                        <span className="font-mono text-xs text-gray-500 uppercase tracking-wider">Station Humidity</span>
                                    </div>
                                    <div className="text-4xl font-serif text-[#5f5e5b]">82%</div>
                                    <span className="font-mono text-sm text-[#374b43]">AIR_FLOW_OPTIMAL</span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Zone Actions + Status */}
                        <div className="lg:col-span-4 space-y-6">
                            <h2 className="font-mono text-xs text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Zap className="w-4 h-4" />
                                Zone Actions
                            </h2>
                            <div className="space-y-4">
                                <button className="w-full h-16 bg-[#5f5e5b] text-white rounded-xl flex items-center px-6 gap-4 active:scale-95 transition-transform hover:bg-gray-700">
                                    <CirclePlus className="w-5 h-5" />
                                    <span className="text-xl font-bold">Start New Project</span>
                                </button>
                                <button className="w-full h-16 bg-gray-200 text-gray-900 flex items-center px-6 gap-4 active:scale-95 transition-transform border border-gray-300 rounded-xl hover:bg-gray-300">
                                    <Printer className="w-5 h-5" />
                                    <span className="text-xl font-bold">Label Printing</span>
                                </button>
                                <button className="w-full h-16 bg-gray-200 text-gray-900 flex items-center px-6 gap-4 active:scale-95 transition-transform border border-gray-300 rounded-xl hover:bg-gray-300">
                                    <Trash2 className="w-5 h-5" />
                                    <span className="text-xl font-bold">Waste Log</span>
                                </button>
                            </div>

                            {/* Status card */}
                            <div className="p-6 bg-[#cee5da] text-[#0b1f18] rounded-xl border border-[#4e635a]/20">
                                <div className="font-mono text-xs mb-2 uppercase tracking-widest opacity-70">SYST_STATUS</div>
                                <p className="text-sm leading-relaxed">
                                    All Value Add stations reporting within safety parameters. No active alerts for currently processing batches.
                                </p>
                                <div className="mt-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[#4e635a]" />
                                    <span className="font-mono text-[10px] uppercase tracking-wider">ALL_SYSTEMS_GO</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
