import React, { useState, useRef, useEffect } from 'react';
import { trpc } from '../../lib/trpc';
import { CountdownTimer } from '../../components/CountdownTimer';
import { PageHeader } from '../../components/app/PageHeader';
import { Icon } from '../../components/ui/Icon';
import { Card, Badge, Button, Stat } from '../../components/ui/primitives';
import { CountValue } from '../../components/app/LiveValue';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { BlockchainAnchorModal } from './BlockchainAnchorModal';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { useSubscription } from '../../context/SubscriptionContext';

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

function statusTone(s: string): 'pending' | 'good' | 'complete' {
    if (s === 'ACTIVE') return 'pending';
    if (s === 'IN_TRANSIT') return 'good';
    return 'complete';
}

/* ─────────────────────────── Details slide-over ─────────────────────────── */
function DetailsSlideover({ cycle, onClose }: { cycle: CycleItem; onClose: () => void }) {
    const icons: Record<string, React.ReactNode> = {
        BIN_STARTED: <Icon name="clock" width={16} height={16} />,
        PICKED_UP: <Icon name="truck" width={16} height={16} />,
        DELIVERED: <Icon name="check" width={16} height={16} />,
    };
    const eventLabels: Record<string, string> = {
        BIN_STARTED: 'Bin Started at Facility',
        PICKED_UP: 'Picked Up by Driver',
        DELIVERED: 'Delivered to Rendering',
    };
    const urg = cycle.bin.binType.urgency;
    const urgTone = urg === 'CRITICAL' ? 'alert' : urg === 'MEDIUM' ? 'warn' : 'good';

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="fixed inset-0 bg-olive-deep/40 backdrop-blur-sm" />
            <div
                className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-canvas shadow-panel"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 bg-olive-deep p-5 text-bone">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="kicker text-bone/50">Cycle Details</p>
                            <h2 className="mt-1 max-w-[260px] truncate font-display text-xl font-extrabold">{cycle.bin.qrCode}</h2>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge tone={statusTone(cycle.status)}>{statusLabel(cycle.status)}</Badge>
                                <Badge tone={urgTone as never}>{urg}</Badge>
                            </div>
                        </div>
                        <button onClick={onClose} className="mt-1 shrink-0 text-bone/50 hover:text-bone">
                            <Icon name="arrow" width={20} height={20} className="rotate-45" />
                        </button>
                    </div>
                </div>

                <div className="space-y-6 p-5">
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Organ Type', value: cycle.bin.binType.organType.toLowerCase() },
                            { label: 'DK Window', value: `${cycle.bin.binType.dkHours}h` },
                            { label: 'Origin Facility', value: cycle.facility?.name || cycle.facilityId },
                            { label: 'Deadline', value: fmt(cycle.deadline) },
                            ...(cycle.driver ? [{ label: 'Driver', value: cycle.driver.name }] : []),
                            ...(cycle.destination ? [{ label: 'Destination', value: cycle.destination.name }] : []),
                        ].map((info) => (
                            <div key={info.label} className="rounded-xl border border-edge/70 bg-white p-3">
                                <p className="kicker">{info.label}</p>
                                <p className="mt-1 break-words text-sm font-semibold capitalize text-ink">{info.value}</p>
                            </div>
                        ))}
                    </div>

                    {cycle.status !== 'COMPLETED' && (
                        <div className="flex items-center justify-between rounded-xl border border-edge/70 bg-white p-4">
                            <p className="text-sm font-medium text-muted">Time Remaining</p>
                            <CountdownTimer deadline={cycle.deadline} />
                        </div>
                    )}

                    <div>
                        <h3 className="kicker mb-4">Event Timeline</h3>
                        {cycle.events.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted">No events recorded yet.</p>
                        ) : (
                            <ol className="ml-4 space-y-6 border-l border-edge">
                                {cycle.events.map((ev) => (
                                    <li key={ev.id} className="relative ml-6">
                                        <div className="absolute -left-9 flex h-7 w-7 items-center justify-center rounded-full bg-bone-light text-olive-deep">
                                            {icons[ev.eventType] || <Icon name="grid" width={14} height={14} />}
                                        </div>
                                        <p className="text-sm font-semibold text-ink">{eventLabels[ev.eventType] || ev.eventType}</p>
                                        <p className="mt-0.5 text-xs text-muted">{fmt(ev.timestamp)}</p>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────── Shared countdown cell ─────────────────────────── */
function CycleCountdown({ item }: { item: CycleItem }) {
    if (item.status === 'COMPLETED') {
        return <Badge tone="complete">DONE</Badge>;
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
    const { hasModule, isLoading: isSubscriptionLoading } = useSubscription();

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
        { label: 'active_bins', value: stats?.totalActiveBins || 0, icon: <Icon name="box" width={18} height={18} /> },
        { label: 'overdue', value: stats?.totalOverdue || 0, icon: <Icon name="thermo" width={18} height={18} />, pulse: (stats?.totalOverdue ?? 0) > 0 },
        { label: 'done_today', value: stats?.totalCompletedToday || 0, icon: <Icon name="check" width={18} height={18} /> },
        { label: 'compliance', value: stats?.complianceRate ?? 100, unit: '%', icon: <Icon name="chain" width={18} height={18} /> },
    ];

    return (
        <div className="mx-auto max-w-7xl">
            <PageHeader
                title="Facility Dashboard"
                subtitle="Daily workflow and operations, one unified view."
                icon={<Icon name="grid" width={22} height={22} />}
                actions={
                    <>
                        <div className="hidden items-center gap-1 rounded-full border border-edge bg-white p-1 sm:flex">
                            {(['all', '2d', '7d', 'custom'] as DatePreset[]).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => { setDatePreset(p); setCalendarOpen(p === 'custom'); }}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${datePreset === p ? 'bg-olive-deep text-bone-light' : 'text-muted hover:text-olive-deep'}`}
                                >
                                    {p === 'all' ? 'All Time' : p === '2d' ? '2 Days' : p === '7d' ? '7 Days' : 'Custom'}
                                </button>
                            ))}
                        </div>
                        {datePreset === 'custom' && (
                            <div className="relative" ref={calendarRef}>
                                <Button variant="secondary" onClick={() => setCalendarOpen((o) => !o)}>
                                    <Icon name="clock" width={15} height={15} />
                                    {customFrom || 'From'} → {customTo || 'To'}
                                </Button>
                                {calendarOpen && (
                                    <Card className="absolute right-0 z-50 mt-2 w-72 p-4">
                                        <p className="kicker mb-3">Select Date Range</p>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-muted">From</label>
                                                <input
                                                    type="date"
                                                    value={customFrom}
                                                    max={customTo || toInputDate(new Date())}
                                                    onChange={(e) => setCustomFrom(e.target.value)}
                                                    className="w-full rounded-lg border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-rust"
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-muted">To</label>
                                                <input
                                                    type="date"
                                                    value={customTo}
                                                    min={customFrom}
                                                    max={toInputDate(new Date())}
                                                    onChange={(e) => setCustomTo(e.target.value)}
                                                    className="w-full rounded-lg border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-rust"
                                                />
                                            </div>
                                            <Button className="w-full" onClick={() => setCalendarOpen(false)}>Apply</Button>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        )}
                        <select
                            value={selectedFacility || ''}
                            onChange={(e) => setSelectedFacility(e.target.value || undefined)}
                            className="rounded-xl border border-edge bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-rust"
                        >
                            <option value="">All Facilities</option>
                            {uniqueFacilities.map(([fid, fac]) => (
                                <option key={fid} value={fid}>{fac?.name || fid}</option>
                            ))}
                        </select>
                        <Button variant="secondary" onClick={() => void refetch()}>
                            <Icon name="refresh" width={15} height={15} />
                            Refresh
                        </Button>
                        <Button variant="rust" onClick={() => setAnchorModalOpen(true)}>
                            <Icon name="chain" width={15} height={15} />
                            Post on Blockchain
                        </Button>
                    </>
                }
            />

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {statsCards.map((c) => (
                    <div key={c.label} className="relative">
                        {c.pulse && <span className="absolute -right-1 -top-1 z-10 h-3 w-3 rounded-full border-2 border-canvas bg-rust animate-blink" />}
                        <Stat label={c.label} value={<CountValue value={c.value} />} unit={c.unit} icon={c.icon} accent={c.pulse} />
                    </div>
                ))}
            </div>

            {/* All Cycles */}
            <Card className="mt-8 overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-edge/60 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-olive-deep">
                        All Cycles
                        <Badge tone="pending">{filteredBins.length}</Badge>
                    </h2>
                </div>

                {/* Mobile card list */}
                <div className="divide-y divide-edge/50 md:hidden">
                    {isBinsLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <FacilityLoader variant="inline" label="cycles" />
                        </div>
                    ) : filteredBins.length > 0 ? (
                        filteredBins.map((item) => (
                            <div key={item.id} className="space-y-3 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <CycleCountdown item={item as unknown as CycleItem} />
                                    <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                                </div>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-ink">{item.bin.qrCode}</p>
                                        <p className="font-mono text-xs text-muted">#{item.id.slice(0, 8)}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5 text-sm text-ink">
                                        <span className={`h-2 w-2 rounded-full ${item.bin.binType.urgency === 'CRITICAL' ? 'bg-rust' : 'bg-live'}`} />
                                        <span className="font-medium capitalize">{item.bin.binType.organType.toLowerCase()}</span>
                                    </div>
                                </div>
                                <div className="flex items-end justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-ink">{(item as { facility?: { name: string } }).facility?.name || item.facilityId}</p>
                                        <p className="text-xs text-muted">
                                            Started {new Date(item.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedCycle(item as unknown as CycleItem)}
                                        className="shrink-0 rounded-xl bg-bone-light px-4 py-2 text-sm font-bold text-rust hover:bg-bone-light/70"
                                    >
                                        Details
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-sm text-muted">No cycles found.</div>
                    )}
                </div>

                {/* Desktop table */}
                <div className="scroll-thin hidden overflow-x-auto md:block">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-edge/60">
                                {['Countdown', 'Bin ID', 'Organ Type', 'Status', 'Facility', 'Started', 'Actions'].map((h) => (
                                    <th key={h} className={`px-5 py-3 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-edge/40">
                            {isBinsLoading ? (
                                <tr><td colSpan={7} className="p-8 text-center">
                                    <span className="inline-flex justify-center">
                                        <FacilityLoader variant="inline" label="priority queue" />
                                    </span>
                                </td></tr>
                            ) : filteredBins.length > 0 ? (
                                filteredBins.map((item) => (
                                    <tr key={item.id} className="hover:bg-bone-light/40">
                                        <td className="px-5 py-3 align-middle"><CycleCountdown item={item as unknown as CycleItem} /></td>
                                        <td className="px-5 py-3 align-middle">
                                            <p className="max-w-[150px] truncate font-semibold text-ink" title={item.bin.qrCode}>{item.bin.qrCode}</p>
                                            <p className="mt-0.5 font-mono text-xs text-muted">#{item.id.slice(0, 8)}</p>
                                        </td>
                                        <td className="px-5 py-3 align-middle">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2 w-2 shrink-0 rounded-full ${item.bin.binType.urgency === 'CRITICAL' ? 'bg-rust' : 'bg-live'}`} />
                                                <span className="font-medium capitalize text-ink">{item.bin.binType.organType.toLowerCase()}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 align-middle"><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge></td>
                                        <td className="px-5 py-3 align-middle text-sm font-medium text-muted">{(item as { facility?: { name: string } }).facility?.name || item.facilityId}</td>
                                        <td className="px-5 py-3 align-middle text-sm text-muted">
                                            <p>{new Date(item.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                            <p className="text-xs">{new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </td>
                                        <td className="px-5 py-3 text-right align-middle">
                                            <button
                                                onClick={() => setSelectedCycle(item as unknown as CycleItem)}
                                                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-rust hover:bg-bone-light/60"
                                            >
                                                Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={7} className="bg-bone-light/40 p-8 text-center text-sm text-muted">No cycles found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {selectedCycle && <DetailsSlideover cycle={selectedCycle} onClose={() => setSelectedCycle(null)} />}
            {anchorModalOpen && !isSubscriptionLoading && hasModule('BLOCKCHAIN_ANCHOR') && <BlockchainAnchorModal onClose={() => setAnchorModalOpen(false)} />}
            {anchorModalOpen && !isSubscriptionLoading && !hasModule('BLOCKCHAIN_ANCHOR') && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAnchorModalOpen(false)}>
                    <div className="fixed inset-0 bg-olive-deep/40 backdrop-blur-sm" />
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <UpgradePrompt module="BLOCKCHAIN_ANCHOR" />
                    </div>
                </div>
            )}
        </div>
    );
}

export default DashboardPage;
