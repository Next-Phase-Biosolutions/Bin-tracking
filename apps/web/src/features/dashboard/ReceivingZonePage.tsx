import {
    BarChart2,
    Building2,
    CheckSquare,
    CirclePlus,
    ClipboardList,
    Cog,
    Settings,
    Thermometer,
} from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string | number;
    unit: string;
    indicator?: React.ReactNode;
}

function StatCard({ label, value, unit, indicator }: StatCardProps) {
    return (
        <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-start mb-3">
                <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">{label}</span>
                {indicator}
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-serif text-gray-900">{value}</span>
                <span className="text-base text-gray-500">{unit}</span>
            </div>
        </div>
    );
}

interface TruckCardProps {
    name: string;
    provider: string;
    statusLabel: string;
    statusClass: string;
    imgSrc: string;
    imgAlt: string;
    stat1Label: string;
    stat1Value: React.ReactNode;
    stat2Label: string;
    stat2Value: string;
    dimmed?: boolean;
}

function TruckCard({ name, provider, statusLabel, statusClass, imgSrc, imgAlt, stat1Label, stat1Value, stat2Label, stat2Value, dimmed }: TruckCardProps) {
    return (
        <div className={`bg-white border border-gray-200 p-1 rounded-xl transition-all hover:border-gray-400 ${dimmed ? 'opacity-75' : ''}`}>
            <div className="flex flex-col md:flex-row md:items-center">
                <div className="relative w-full md:w-48 h-36 md:h-auto rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    <img
                        src={imgSrc}
                        alt={imgAlt}
                        className={`w-full h-full object-cover grayscale ${dimmed ? 'brightness-75' : 'contrast-125'}`}
                    />
                    {!dimmed && <div className="absolute inset-0 bg-[#4e635a]/10" />}
                </div>
                <div className="flex-1 p-6">
                    <div className="flex justify-between items-start mb-5">
                        <div>
                            <h4 className="text-lg font-bold text-gray-900">{name}</h4>
                            <p className="text-sm text-gray-500 mt-0.5">Provider: {provider}</p>
                        </div>
                        <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusClass}`}>
                            {statusLabel}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded">
                            <p className="font-mono text-[10px] text-gray-400 uppercase mb-1">{stat1Label}</p>
                            <p className="text-lg font-bold text-gray-900">{stat1Value}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                            <p className="font-mono text-[10px] text-gray-400 uppercase mb-1">{stat2Label}</p>
                            <p className="text-lg font-bold text-gray-900">{stat2Value}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ReceivingZonePage() {
    return (
        <>
            {/* Top nav */}
            <header className="fixed top-0 w-full z-50 bg-[#fbf9f8] border-b border-gray-200 flex justify-between items-center px-5 h-16">
                <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-[#5f5e5b]" />
                    <h1 className="text-xl font-bold text-[#5f5e5b]">Receiving Zone</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">Ambient Temp</span>
                        <span className="font-mono text-base text-gray-800">4.2°C</span>
                    </div>
                    <div className="w-px h-8 bg-gray-200 mx-1" />
                    <Settings className="w-5 h-5 text-gray-400 cursor-pointer" />
                </div>
            </header>

            {/* Main */}
            <main className="pt-20 pb-32 px-6 md:px-8 min-h-screen">

                {/* Stats row */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                    <StatCard
                        label="DOCK_STATUS"
                        value={3}
                        unit="Active Docks"
                        indicator={<span className="w-2 h-2 rounded-full bg-[#4e635a]" />}
                    />
                    <StatCard
                        label="EXPECTED_DELIVERIES"
                        value={8}
                        unit="Trailers Today"
                        indicator={<Cog className="w-4 h-4 text-gray-400" />}
                    />
                    <StatCard
                        label="DAILY_INTAKE"
                        value={140}
                        unit="Total Units"
                        indicator={<BarChart2 className="w-4 h-4 text-gray-400" />}
                    />
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Active deliveries */}
                    <section className="lg:col-span-8 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-[#5f5e5b]">Active Deliveries</h3>
                            <span className="font-mono text-xs text-[#4e635a] px-3 py-1 bg-[#4e635a]/10 rounded uppercase tracking-wider">
                                LIVE_UPDATES
                            </span>
                        </div>

                        <TruckCard
                            name="Truck #88"
                            provider="North Plains Ranching"
                            statusLabel="INTAKE IN PROGRESS"
                            statusClass="bg-[#4e635a] text-white"
                            imgSrc="https://lh3.googleusercontent.com/aida-public/AB6AXuAlbDO-y6I5_3qRY6_RzEMMJay-oFn8q5oTXauTovp2C4BJWPkayXv58Eq9Z9IDgZD2X4-IGlkU5whD8fWRmGGkNAPF6RK2WJPNDfIar4_DajmWxv3aD4-GhPCdpUBW9_SPYgYDYRKeCZzaQahhTFD8xcPdLy6bqz83mmMAOXPb9e-rN_n4CoNTnVRXnprQly_YNMu9-MlBzuU0knP3L8ybimSVNXm5s3-oRATKn-PHKr63UMa26psJ0uenh0CLpnOAN7ccqkM5ODzF"
                            imgAlt="Truck at dock"
                            stat1Label="UNITS_LOGGED"
                            stat1Value={<>40 <span className="text-xs text-gray-400 font-normal">/ 120</span></>}
                            stat2Label="DOCK_ASSIGNMENT"
                            stat2Value="DOCK-04"
                        />

                        <TruckCard
                            name="Truck #92"
                            provider="Heritage Valley Farms"
                            statusLabel="AWAITING DOCK"
                            statusClass="bg-gray-100 text-gray-700 border border-gray-200"
                            imgSrc="https://lh3.googleusercontent.com/aida-public/AB6AXuCCwYFtSj63BEvTYG0CUq7UXp_OO6OVLclTH_p-hyDgCQh2uIPTSMDGX2zt6hqu5s5jz0DAQ6XgVfLnPBTAtpPi7A63BtchvEGYtLborBd-b8JFUM6AbJzuIHV1rxCE15QdoShO1qyUFVcQ8Yv9tqVFbIsoGcLdY2chTVs_wOdKocM0QIrmQZEgH-M2omoETJ_wDvYbF7Zu5NDhUCfJSh5BKVgNFIXmpip7MQ75F9C1hQ0jZL3ve0ECUcTD9xYhzPXVKHkjgKfkNpNH"
                            imgAlt="Waiting truck"
                            stat1Label="MANIFESTED_UNITS"
                            stat1Value="60 Units"
                            stat2Label="ARRIVAL_TIME"
                            stat2Value="08:14 AM"
                            dimmed
                        />
                    </section>

                    {/* Right panel */}
                    <aside className="lg:col-span-4 space-y-5">

                        {/* Zone Actions */}
                        <div className="bg-gray-100 p-6 rounded-xl space-y-3">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Zone Actions</h3>
                            {[
                                { label: 'Log Incoming Lot', icon: <CirclePlus className="w-5 h-5 text-[#4e635a]" /> },
                                { label: 'Verify manifest', icon: <CheckSquare className="w-5 h-5 text-gray-600" /> },
                                { label: 'Update inventory', icon: <ClipboardList className="w-5 h-5 text-gray-600" /> },
                            ].map((action) => (
                                <button
                                    key={action.label}
                                    className="w-full bg-white border border-gray-200 py-4 px-5 rounded-lg flex items-center justify-between active:scale-95 transition-all font-bold text-[#5f5e5b] hover:bg-gray-50 hover:shadow-sm group"
                                >
                                    <span className="text-base">{action.label}</span>
                                    {action.icon}
                                </button>
                            ))}
                        </div>

                        {/* Zone Environment */}
                        <div className="bg-gray-900 text-white p-6 rounded-xl shadow-xl relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Zone Environment</h3>
                                <div className="space-y-5">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <Thermometer className="w-5 h-5 text-[#b5ccc1]" />
                                            <span className="text-sm text-gray-200">Ambient Temp</span>
                                        </div>
                                        <span className="font-mono text-xl text-white">4.2°C</span>
                                    </div>
                                    <div className="h-px bg-gray-700" />
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[#b5ccc1] text-lg">〰</span>
                                            <span className="text-sm text-gray-200">Humidity</span>
                                        </div>
                                        <span className="font-mono text-xl text-white">84%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute -right-4 -bottom-4 opacity-10 text-[8rem] leading-none select-none">◎</div>
                        </div>
                    </aside>
                </div>
            </main>

            {/* Voice indicator */}
            <div className="fixed bottom-16 left-0 right-0 h-12 pointer-events-none flex items-center justify-center bg-linear-to-t from-[#5f5e5b]/5 to-transparent">
                <div className="flex items-center gap-1">
                    {[3, 5, 2, 4].map((h, i) => (
                        <div key={i} className="w-1 bg-[#5f5e5b] rounded-full" style={{ height: `${h * 4}px` }} />
                    ))}
                    <span className="font-mono text-[10px] text-[#5f5e5b] ml-4 uppercase tracking-widest">Listening for intent...</span>
                </div>
            </div>
        </>
    );
}
