import {
    ArrowRight,
    Building2,
    CheckCircle,
    ClipboardCheck,
    Droplets,
    FileText,
    Gauge,
    Info,
    Settings,
    Settings2,
    Thermometer,
    TrendingUp,
} from 'lucide-react';

interface BatchCardProps {
    batchRef: string;
    title: string;
    targetVolume: string;
    progress: number;
    progressColor: string;
    tags: { label: string; variant: 'default' | 'highlighted' }[];
}

function BatchCard({ batchRef, title, targetVolume, progress, progressColor, tags }: BatchCardProps) {
    return (
        <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm hover:border-[#5f5e5b] transition-colors cursor-pointer group">
            <div className="flex justify-between mb-4">
                <div className="flex flex-col">
                    <span className="font-mono text-xs text-gray-500 uppercase tracking-widest">{batchRef}</span>
                    <span className="text-xl font-bold text-gray-900 mt-1">{title}</span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#5f5e5b] transition-colors mt-1" />
            </div>
            <div className="mb-6">
                <div className="flex justify-between items-end mb-1">
                    <span className="font-mono text-xs text-gray-500 uppercase">Target Volume</span>
                    <span className="text-base font-bold text-gray-900">{targetVolume}</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className={`${progressColor} h-full rounded-full`} style={{ width: `${progress}%` }} />
                </div>
            </div>
            <div className="flex gap-2 flex-wrap">
                {tags.map((tag) => (
                    <span
                        key={tag.label}
                        className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                            tag.variant === 'highlighted'
                                ? 'bg-[#cee5da] text-[#374b43]'
                                : 'bg-gray-100 text-gray-500'
                        }`}
                    >
                        {tag.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function KillFloorPage() {
    return (
        <>
            {/* Top header */}
            <header className="fixed top-0 w-full z-50 bg-[#fbf9f8] border-b border-gray-200 flex justify-between items-center px-5 h-16">
                <div className="flex items-center gap-4">
                    <Building2 className="w-6 h-6 text-[#5f5e5b]" />
                    <h1 className="text-xl font-bold text-[#5f5e5b]">Meat Tech ERP</h1>
                </div>
                <div className="flex items-center gap-6">
                    <span className="font-mono text-xs text-gray-500 px-3 py-1 bg-gray-200 rounded-lg border border-gray-200 uppercase tracking-wider">
                        ZONE_PRC_01
                    </span>
                    <Settings className="w-5 h-5 text-gray-400 cursor-pointer" />
                </div>
            </header>

            {/* Main */}
            <main className="pt-24 pb-32 px-8 min-h-screen">

                {/* Zone header */}
                <div className="mb-8">
                    <div className="flex items-baseline gap-4 mb-6">
                        <h2 className="text-4xl font-serif text-gray-900">Processing Zone</h2>
                        <div className="h-px grow bg-gray-200 opacity-50" />
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="w-3 h-3 bg-[#4e635a] rounded-full" />
                            <span className="font-mono text-xs text-[#4e635a] uppercase tracking-widest">Live Floor Status</span>
                        </div>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white border border-gray-200 p-5 flex flex-col gap-2 shadow-sm rounded-lg">
                            <div className="flex justify-between items-start">
                                <span className="font-mono text-sm text-gray-500">STAT_THROUGHPUT</span>
                                <TrendingUp className="w-5 h-5 text-[#4e635a]" />
                            </div>
                            <div className="mt-2">
                                <span className="text-5xl font-serif text-gray-900">
                                    92<small className="text-2xl align-baseline">%</small>
                                </span>
                                <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3">
                                    <div className="bg-[#4e635a] h-full rounded-full" style={{ width: '92%' }} />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white border border-gray-200 p-5 flex flex-col gap-2 shadow-sm rounded-lg">
                            <div className="flex justify-between items-start">
                                <span className="font-mono text-sm text-gray-500">STAT_ACTIVE_LINES</span>
                                <Settings2 className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="mt-2">
                                <span className="text-5xl font-serif text-gray-900">
                                    4<span className="text-gray-400 text-3xl mx-2">/</span>5
                                </span>
                                <p className="font-mono text-xs text-gray-500 mt-3 uppercase">Line 03 Maintenance</p>
                            </div>
                        </div>
                        <div className="bg-white border border-gray-200 p-5 flex flex-col gap-2 shadow-sm rounded-lg">
                            <div className="flex justify-between items-start">
                                <span className="font-mono text-sm text-gray-500">STAT_QUALITY_PASS</span>
                                <CheckCircle className="w-5 h-5 text-[#4e635a]" />
                            </div>
                            <div className="mt-2">
                                <span className="text-5xl font-serif text-gray-900">
                                    99<small className="text-2xl align-baseline">%</small>
                                </span>
                                <p className="font-mono text-xs text-[#4e635a] mt-3 uppercase">Optimal Yield Profile</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* Left: Batches + Commands */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        <span className="font-mono text-xs text-gray-500 border-b border-gray-300 w-full pb-2 uppercase">
                            Active Processing Batches
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <BatchCard
                                batchRef="Batch Reference"
                                title="#42 — Grinding"
                                targetVolume="80 Units"
                                progress={65}
                                progressColor="bg-[#5f5e5b]"
                                tags={[
                                    { label: 'U_SPEC: COARSE', variant: 'default' },
                                    { label: 'TEMP_LIMIT: 4°C', variant: 'default' },
                                ]}
                            />
                            <BatchCard
                                batchRef="Batch Reference"
                                title="#43 — Packaging"
                                targetVolume="40 Units"
                                progress={88}
                                progressColor="bg-[#4e635a]"
                                tags={[
                                    { label: 'Finalizing', variant: 'highlighted' },
                                    { label: 'SKU: CRT-992', variant: 'default' },
                                ]}
                            />
                        </div>

                        {/* Zone Commands */}
                        <div className="mt-2">
                            <span className="font-mono text-xs text-gray-500 border-b border-gray-300 w-full pb-2 mb-4 block uppercase">
                                Zone Commands
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <button className="bg-[#5f5e5b] text-white h-16 rounded-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-transform text-base font-bold shadow-lg hover:bg-gray-700">
                                    <ClipboardCheck className="w-5 h-5" />
                                    Log QC Check
                                </button>
                                <button className="bg-gray-200 text-gray-900 border border-gray-300 h-16 rounded-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-transform text-base font-bold hover:bg-gray-300">
                                    <Gauge className="w-5 h-5" />
                                    Adjust Line Speed
                                </button>
                                <button className="bg-gray-200 text-gray-900 border border-gray-300 h-16 rounded-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-transform text-base font-bold hover:bg-gray-300">
                                    <FileText className="w-5 h-5" />
                                    Shift Report
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Environmental */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <span className="font-mono text-xs text-gray-500 border-b border-gray-300 w-full pb-2 uppercase">
                            Environmental Telemetry
                        </span>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                            <div className="h-40 w-full relative">
                                <img
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBzv0LYJzBksgcrCTJth3VeduIk_nT4dSemAvTz2Dd1pmlr_twd3Q9nTg_ONJcXl0a3D_c2TIUeVKthNuTOG7saPvhp6wcmh_M9preA1VboIIlLy4mb3rrcnQS3K4v-hbKEvBkZJZtjd36wFJyR4Axq-FbkeTrkB-PpVgXRaVRtUil3WB2HCD1v0VpkM7-RNnw11WqTu7AH4G3ASUUhNFY24mt8V8ulTnT0zgxgkOCZR5lt1Ex8IjRxE5etsXoY-3zAVla0L1yxhPsu"
                                    alt="Processing zone machinery"
                                    className="w-full h-full object-cover grayscale opacity-40 mix-blend-multiply"
                                />
                                <div className="absolute inset-0 bg-linear-to-t from-gray-50 to-transparent" />
                                <div className="absolute bottom-4 left-4">
                                    <span className="font-mono text-xs text-gray-500 uppercase">SENS_PRC_MAIN</span>
                                </div>
                            </div>
                            <div className="p-6 flex flex-col gap-6">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <Thermometer className="w-5 h-5 text-[#4e635a]" />
                                        <span className="font-mono text-xs text-gray-500 uppercase">AMBIENT_TEMP</span>
                                    </div>
                                    <span className="text-2xl font-bold text-gray-900">4.2°C</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <Droplets className="w-5 h-5 text-[#4e635a]" />
                                        <span className="font-mono text-xs text-gray-500 uppercase">LINE_HUMIDITY</span>
                                    </div>
                                    <span className="text-2xl font-bold text-gray-900">45%</span>
                                </div>
                                <div className="pt-4 border-t border-gray-200">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Info className="w-4 h-4 text-gray-400" />
                                        <span className="font-mono text-[10px] text-gray-500 uppercase">Safety Compliance</span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        All sensors reporting within range. Air filtration system operating at 100% capacity. Next calibration due in 12 days.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* System listening */}
                        <div className="bg-[#f5f2ed] p-4 rounded-lg border-l-4 border-[#5f5e5b]">
                            <div className="flex items-center gap-4">
                                <span className="w-2 h-2 bg-[#5f5e5b] rounded-full animate-pulse" />
                                <span className="font-mono text-xs text-[#6f6e6a] uppercase tracking-widest">System Listening...</span>
                            </div>
                            <p className="text-sm font-mono text-[#6f6e6a] mt-2 opacity-80 italic">
                                "Say 'Line status report' for summary"
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
