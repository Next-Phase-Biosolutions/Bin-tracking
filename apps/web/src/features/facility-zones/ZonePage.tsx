import { Navigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/app/PageHeader';
import { Card, Badge, Reveal, LiveDot, SectionHead } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { TickValue } from '../../components/app/LiveValue';
import { getZone } from '../../lib/facility-zones-data';

/** Only these zones have a built-out view so far — the rest show a placeholder until wired up. */
const ACCESSIBLE_ZONE_IDS = new Set(['killfloor', 'wetaging']);

export default function ZonePage() {
    const { zoneId } = useParams<{ zoneId: string }>();
    const zone = zoneId ? getZone(zoneId) : undefined;

    if (!zone) return <Navigate to="/app/dashboard" replace />;

    if (!ACCESSIBLE_ZONE_IDS.has(zone.id)) {
        return (
            <div className="mx-auto max-w-7xl">
                <PageHeader
                    title={`${zone.name} Zone`}
                    subtitle={zone.tagline}
                    icon={<Icon name={zone.icon} width={22} height={22} />}
                />
                <div className="flex min-h-[40vh] items-center justify-center">
                    <Card className="w-full max-w-md p-8 text-center">
                        <Badge tone="idle">Not accessible</Badge>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl">
            <PageHeader
                title={`${zone.name} Zone`}
                subtitle={zone.tagline}
                icon={<Icon name={zone.icon} width={22} height={22} />}
                actions={<Badge tone={zone.status}>{zone.status} · {zone.statusNote}</Badge>}
            />

            <div className="grid gap-4 sm:grid-cols-3">
                {zone.stats.map((s, i) => (
                    <Reveal key={s.label} delay={i * 0.05}>
                        <Card className="p-6">
                            <p className="kicker">{s.label}</p>
                            <p className="mt-3 font-display text-[2.4rem] font-extrabold leading-none tracking-tight text-olive-deep tnum">
                                {s.value}
                                {s.unit ? <span className="ml-1.5 text-base font-bold text-muted">{s.unit}</span> : null}
                            </p>
                        </Card>
                    </Reveal>
                ))}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                <Reveal>
                    <Card className="overflow-hidden">
                        <div className="flex items-center justify-between border-b border-edge/60 p-6">
                            <SectionHead title={zone.listTitle} />
                            <span className="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-live">
                                <LiveDot /> live_tracking
                            </span>
                        </div>
                        <ul className="divide-y divide-edge/40">
                            {zone.rows.map((r) => (
                                <li key={r.id} className="flex flex-wrap items-center gap-4 p-6">
                                    <div className="min-w-[10rem] flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-display text-lg font-bold text-olive-deep">{r.title}</h3>
                                            <Badge tone={r.status.tone}>{r.status.label}</Badge>
                                        </div>
                                        <p className="mt-0.5 text-sm text-muted">{r.subtitle}</p>
                                    </div>
                                    <div className="flex gap-6">
                                        {r.metrics.map((m) => (
                                            <div key={m.label}>
                                                <p className="font-mono text-[0.56rem] uppercase tracking-[0.1em] text-muted">{m.label}</p>
                                                <p className="mt-0.5 font-mono text-sm font-semibold text-olive-deep">{m.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="rounded-lg border border-edge px-3 py-2 text-xs font-semibold text-olive-deep transition-colors hover:bg-bone-light">
                                        Inspect
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </Reveal>

                <div className="space-y-4">
                    <Reveal delay={0.05}>
                        <Card className="p-6">
                            <SectionHead title="Zone Actions" />
                            <div className="mt-4 space-y-2">
                                {zone.actions.map((a, i) => (
                                    <button
                                        key={a}
                                        className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                                            i === 0 ? 'bg-olive-deep text-bone-light hover:bg-olive-deep/90' : 'border border-edge bg-white text-olive-deep hover:bg-bone-light'
                                        }`}
                                    >
                                        {a}
                                        <Icon name="arrow" width={15} height={15} className={i === 0 ? 'text-bone/70' : 'text-muted'} />
                                    </button>
                                ))}
                            </div>
                        </Card>
                    </Reveal>

                    <Reveal delay={0.1}>
                        <Card className="relative overflow-hidden p-6">
                            <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg opacity-40" />
                            <div className="relative flex items-center justify-between">
                                <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-olive">zone_environment</p>
                                <span className="flex items-center gap-1.5 font-mono text-[0.56rem] uppercase tracking-[0.12em] text-live">
                                    <LiveDot /> {zone.envStable ? 'stable' : 'watch'}
                                </span>
                            </div>
                            <div className="relative mt-4 space-y-3">
                                {zone.env.map((e) => (
                                    <div key={e.label} className="flex items-center justify-between border-b border-edge/60 pb-3 last:border-0 last:pb-0">
                                        <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-olive">{e.label}</span>
                                        <span className="font-display text-xl font-bold text-olive-deep">
                                            <TickValue base={e.value} unit={e.unit} decimals={e.decimals} />
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="relative mt-4 flex items-center gap-2 rounded-lg bg-bone-light px-3 py-2.5">
                                <Icon name="check" width={14} height={14} className="text-live" />
                                <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">environment stable</span>
                            </div>
                        </Card>
                    </Reveal>
                </div>
            </div>
        </div>
    );
}
