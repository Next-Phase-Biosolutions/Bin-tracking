import { Navigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/app/PageHeader';
import { Card, Badge, Reveal, LiveDot, SectionHead } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { TickValue } from '../../components/app/LiveValue';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { getZone } from '../../lib/facility-zones-data';
import {
  CORE_METRICS,
  describeLastSeen,
  metricSeries,
  sensorIdForZone,
  toEnvRows,
} from '../../lib/zone-sensors';
import { trpc } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { SensorMetricChart } from './SensorMetricChart';

/** Only these zones have a built-out view so far — the rest show a placeholder until wired up. */
const ACCESSIBLE_ZONE_IDS = new Set(['killfloor', 'wetaging']);

/** `UNKNOWN` must not read as green — a device that has never reported is not "OK". */
const STATUS_TONE = { OK: 'good', WARN: 'warn', ALERT: 'alert', UNKNOWN: 'idle' } as const;

export default function ZonePage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const zone = zoneId ? getZone(zoneId) : undefined;

  // Live sensor wiring. These hooks run before the early returns below, so
  // they must tolerate `zone` being undefined.
  const sensorExternalId = zone ? sensorIdForZone(zone.id) : undefined;
  const { hasModule, modulesReady } = useSubscription();
  const devicesQuery = trpc.sensor.listDevices.useQuery(
    {},
    {
      // Skip entirely when the zone has no device mapped or the org lacks
      // the module — otherwise every zone visit fires a request that can
      // only come back empty or FORBIDDEN.
      enabled:
        sensorExternalId !== undefined && modulesReady && hasModule('ENVIRONMENT_MONITORING'),
      // The poller writes new rows every ~10 min; without this the card
      // freezes at whatever it showed on mount.
      refetchInterval: 60_000,
      // A module-gated 403 is a permanent answer, not a blip.
      retry: false,
    },
  );

  const device = devicesQuery.data?.devices.find((d) => d.externalId === sensorExternalId);
  const reading = device?.readings[0];
  const lastSeen = device ? describeLastSeen(device.lastSeenAt) : null;
  const companyTimezone = devicesQuery.data?.companyTimezone ?? 'America/Toronto';

  const historyQuery = trpc.sensor.getReadings.useQuery(
    { deviceId: device?.id ?? '', range: '24h' },
    {
      enabled: device !== undefined,
      refetchInterval: 60_000,
      retry: false,
    },
  );

  // A zone with a sensor mapped gets the minimal charts-only view below,
  // instead of the mock stats/actions/environment layout — the charts
  // already carry that information, so showing both would be redundant.
  const sensorEnabled =
    sensorExternalId !== undefined && modulesReady && hasModule('ENVIRONMENT_MONITORING');
  const isLoadingLiveData =
    sensorEnabled && (devicesQuery.isLoading || (device !== undefined && historyQuery.isLoading));

  const formatTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('en-US', {
      timeZone: companyTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

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

  // Real readings replace the zone's mock atmosphere wholesale when a device
  // is mapped and reporting; otherwise the mock stands in unchanged, so zones
  // without a sensor look exactly as they did before. A device that exists but
  // has not reported yet shows nothing rather than mock numbers — presenting
  // invented values under a real device's name is the one outcome to avoid.
  const liveEnv = reading ? toEnvRows(reading) : null;
  const envRows = liveEnv ?? (device ? [] : zone.env);

  // Independently per metric, in case one channel has gaps another doesn't —
  // a device that's never reported ammonia shouldn't blank out its temperature chart.
  const history = historyQuery.data ?? [];
  const coreCharts = CORE_METRICS.map((metric) => ({
    metric,
    series: metricSeries(history, metric.key),
  })).filter(
    (
      c,
    ): c is {
      metric: (typeof CORE_METRICS)[number];
      series: NonNullable<ReturnType<typeof metricSeries>>;
    } => c.series !== null && c.series.points.length >= 2,
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={`${zone.name} Zone`}
        subtitle={zone.tagline}
        icon={<Icon name={zone.icon} width={22} height={22} />}
        actions={
          <Badge tone={zone.status}>
            {zone.status} · {zone.statusNote}
          </Badge>
        }
      />

      {sensorEnabled ? (
        <div className="mt-2">
          {isLoadingLiveData ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <FacilityLoader variant="inline" label={zone.name} />
            </div>
          ) : coreCharts.length > 0 ? (
            <>
              <p className="kicker">core — threshold monitored</p>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                {coreCharts.map(({ metric, series }) => (
                  <SensorMetricChart
                    key={metric.key}
                    metricKey={metric.key}
                    label={metric.label}
                    icon={metric.icon}
                    unit={metric.unit}
                    decimals={metric.decimals}
                    band={metric.band}
                    series={series}
                    formatTime={formatTime}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Card className="w-full max-w-md p-8 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                  awaiting first reading
                </p>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {zone.stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.05}>
                <Card className="p-6">
                  <p className="kicker">{s.label}</p>
                  <p className="mt-3 font-display text-[2.4rem] font-extrabold leading-none tracking-tight text-olive-deep tnum">
                    {s.value}
                    {s.unit ? (
                      <span className="ml-1.5 text-base font-bold text-muted">{s.unit}</span>
                    ) : null}
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
                          <h3 className="font-display text-lg font-bold text-olive-deep">
                            {r.title}
                          </h3>
                          <Badge tone={r.status.tone}>{r.status.label}</Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-muted">{r.subtitle}</p>
                      </div>
                      <div className="flex gap-6">
                        {r.metrics.map((m) => (
                          <div key={m.label}>
                            <p className="font-mono text-[0.56rem] uppercase tracking-[0.1em] text-muted">
                              {m.label}
                            </p>
                            <p className="mt-0.5 font-mono text-sm font-semibold text-olive-deep">
                              {m.value}
                            </p>
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
                          i === 0
                            ? 'bg-olive-deep text-bone-light hover:bg-olive-deep/90'
                            : 'border border-edge bg-white text-olive-deep hover:bg-bone-light'
                        }`}
                      >
                        {a}
                        <Icon
                          name="arrow"
                          width={15}
                          height={15}
                          className={i === 0 ? 'text-bone/70' : 'text-muted'}
                        />
                      </button>
                    ))}
                  </div>
                </Card>
              </Reveal>

              <Reveal delay={0.1}>
                <Card className="relative overflow-hidden p-6">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 data-grid-bg opacity-40"
                  />
                  <div className="relative flex items-center justify-between">
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-olive">
                      zone_environment
                    </p>
                    {device ? (
                      <Badge tone={STATUS_TONE[device.latestStatus]}>{device.latestStatus}</Badge>
                    ) : (
                      <span className="flex items-center gap-1.5 font-mono text-[0.56rem] uppercase tracking-[0.12em] text-live">
                        <LiveDot /> {zone.envStable ? 'stable' : 'watch'}
                      </span>
                    )}
                  </div>
                  <div className="relative mt-4 space-y-3">
                    {envRows.length === 0 ? (
                      <p className="py-4 text-center font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted">
                        awaiting first reading
                      </p>
                    ) : null}
                    {envRows.map((e) => (
                      <div
                        key={e.label}
                        className="flex items-center justify-between border-b border-edge/60 pb-3 last:border-0 last:pb-0"
                      >
                        <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-olive">
                          {e.label}
                        </span>
                        <span className="font-display text-xl font-bold text-olive-deep">
                          {liveEnv ? (
                            <span className="tnum">
                              {e.value.toLocaleString('en-US', {
                                minimumFractionDigits: e.decimals ?? 1,
                                maximumFractionDigits: e.decimals ?? 1,
                              })}
                              <span className="ml-0.5 text-[0.7em] opacity-60">{e.unit}</span>
                            </span>
                          ) : (
                            // Mock readings only — never wobble a real sensor value.
                            <TickValue base={e.value} unit={e.unit} decimals={e.decimals} />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {lastSeen ? (
                    <div
                      className={`relative mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 ${
                        lastSeen.isStale ? 'bg-warn/10' : 'bg-bone-light'
                      }`}
                    >
                      <Icon
                        name={lastSeen.isStale ? 'refresh' : 'check'}
                        width={14}
                        height={14}
                        className={lastSeen.isStale ? 'text-warn' : 'text-live'}
                      />
                      <span
                        className={`font-mono text-[0.6rem] uppercase tracking-[0.12em] ${
                          lastSeen.isStale ? 'text-warn' : 'text-muted'
                        }`}
                      >
                        {device?.label ?? 'sensor'} · {lastSeen.text}
                      </span>
                    </div>
                  ) : (
                    <div className="relative mt-4 flex items-center gap-2 rounded-lg bg-bone-light px-3 py-2.5">
                      <Icon name="check" width={14} height={14} className="text-live" />
                      <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
                        environment stable
                      </span>
                    </div>
                  )}
                </Card>
              </Reveal>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
