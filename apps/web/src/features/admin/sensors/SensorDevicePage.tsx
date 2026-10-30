import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { trpc, type RouterOutputs } from '../../../lib/trpc';
import { PageHeader } from '../../../components/app/PageHeader';
import { Icon } from '../../../components/ui/Icon';
import { Badge, Button, Card, SectionHead } from '../../../components/ui/primitives';
import { SensorMetricChart } from '../../facility-zones/SensorMetricChart';
import { DeviceAssignmentPanel } from './DeviceAssignmentPanel';
import { DeviceLifecycleButtons } from './DeviceLifecycleButtons';
import { ADMIN_CHARTS, adminSeries, chartTimeFormatter, describeStatus, type AdminRange } from './device-detail';
import { formatAgo, formatMetric } from './format';
import { adminStatusTone, stateTone } from './status';
import { CenteredMessage, EmptyRow, LinkButton, PlatformAdminGate, Th } from './ui';

type Detail = RouterOutputs['sensorAdmin']['deviceDetail'];
type Reading = Detail['recent'][number];

const RANGES: AdminRange[] = ['24h', '7d', '30d'];
const RANGE_LABEL: Record<AdminRange, string> = { '24h': 'last 24 hours', '7d': 'last 7 days', '30d': 'last 30 days' };
const REFRESH_MS = 30_000;

/** Every column of a reading an admin can see, in display order. */
const READING_FIELDS: Array<{ key: keyof Reading; label: string; unit: string; decimals: number }> = [
  { key: 'tempC', label: 'Temperature', unit: '°C', decimals: 1 },
  { key: 'humidityPct', label: 'Humidity', unit: '%', decimals: 0 },
  { key: 'rssi', label: 'RSSI', unit: 'dBm', decimals: 0 },
  { key: 'snr', label: 'SNR', unit: 'dB', decimals: 1 },
  { key: 'filteredRssi', label: 'Filtered RSSI', unit: 'dBm', decimals: 0 },
  { key: 'nh3Ppm', label: 'NH₃', unit: 'ppm', decimals: 2 },
  { key: 'tvoc', label: 'TVOC', unit: '', decimals: 0 },
  { key: 'eco2Ppm', label: 'eCO₂', unit: 'ppm', decimals: 0 },
  { key: 'aqhiPlus', label: 'AQHI+', unit: '', decimals: 1 },
  { key: 'ozonePpb', label: 'Ozone', unit: 'ppb', decimals: 0 },
  { key: 'pressure', label: 'Pressure', unit: '', decimals: 1 },
  { key: 'pm25', label: 'PM2.5', unit: '', decimals: 0 },
];

export default function SensorDevicePage() {
  return (
    <PlatformAdminGate>
      <DeviceContent />
    </PlatformAdminGate>
  );
}

function DeviceContent() {
  const { deviceId = '' } = useParams<{ deviceId: string }>();
  const [range, setRange] = useState<AdminRange>('24h');
  const [panel, setPanel] = useState<'assign' | 'reassign' | null>(null);

  const detail = trpc.sensorAdmin.deviceDetail.useQuery({ deviceId }, { refetchInterval: REFRESH_MS, retry: false });
  const series = trpc.sensorAdmin.deviceReadings.useQuery({ deviceId, range }, { refetchInterval: REFRESH_MS, retry: false });
  const formatTime = useMemo(() => chartTimeFormatter(range), [range]);

  if (detail.isLoading) return <CenteredMessage>Loading…</CenteredMessage>;
  if (detail.isError || !detail.data) return <CenteredMessage>{detail.error?.message ?? 'Device not found.'}</CenteredMessage>;

  const { device, latest, recent, faults, audit } = detail.data;
  const now = new Date();
  const points = series.data ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={device.name}
        subtitle={`Device id ${device.externalId}`}
        icon={<Icon name="thermo" width={22} height={22} />}
        actions={
          <>
            {device.organization ? <LinkButton to={`/app/admin/sensors/view-as/${device.organization.id}`}>View as tenant</LinkButton> : null}
            <LinkButton to="/app/admin/sensors">Back to fleet</LinkButton>
          </>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-3 p-4">
        <Badge tone={adminStatusTone(device.status)}>{device.status}</Badge>
        <p className="text-sm text-olive-deep">
          {describeStatus({ status: device.status, latest, lastSeenAt: device.lastSeenAt, now })}
        </p>
        <span className="ml-auto text-xs text-muted">Refreshes every 30 s</span>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="p-5">
          <SectionHead title="Placement" />
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">State</dt>
            <dd>
              <Badge tone={stateTone(device.state)}>{device.state.toLowerCase()}</Badge>
            </dd>
            <dt className="text-muted">Organization</dt>
            <dd>{device.organization?.name ?? '—'}</dd>
            <dt className="text-muted">Facility</dt>
            <dd>{device.facility?.name ?? '—'}</dd>
            <dt className="text-muted">Zone</dt>
            <dd>{device.zone?.name ?? '—'}</dd>
            <dt className="text-muted">Assigned</dt>
            <dd>{device.assignedAt ? device.assignedAt.toLocaleString() : '—'}</dd>
            <dt className="text-muted">Registered</dt>
            <dd>{device.createdAt.toLocaleString()}</dd>
            <dt className="text-muted">Last seen</dt>
            <dd>{formatAgo(device.lastSeenAt, now)}</dd>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {device.state === 'UNASSIGNED' ? (
              <Button variant="secondary" onClick={() => setPanel(panel === 'assign' ? null : 'assign')}>
                Assign
              </Button>
            ) : null}
            {device.state === 'ACTIVE' ? (
              <Button variant="secondary" onClick={() => setPanel(panel === 'reassign' ? null : 'reassign')}>
                Reassign
              </Button>
            ) : null}
            <DeviceLifecycleButtons deviceId={device.id} state={device.state} />
          </div>
        </Card>

        <Card className="p-5">
          <SectionHead title="Latest reading" />
          {latest ? (
            <>
              <p className="mt-1 text-xs text-muted">Recorded {latest.timestamp.toLocaleString()}</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {READING_FIELDS.map((f) => (
                  <div key={f.key}>
                    <dt className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">{f.label}</dt>
                    <dd className="font-mono text-sm font-semibold text-olive-deep tnum">
                      {formatMetric(latest[f.key] as number | null, f.unit, f.decimals)}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted">Error code</dt>
                  <dd className={`font-mono text-sm font-semibold tnum ${latest.errorCode ? 'text-rust' : 'text-olive-deep'}`}>
                    {latest.errorCode ?? '—'}
                  </dd>
                </div>
              </dl>
              {latest.errorMessage ? <p className="mt-3 rounded-lg bg-bone-light p-3 font-mono text-xs text-rust">{latest.errorMessage}</p> : null}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-rust">Raw payload</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-bone-light p-3 font-mono text-xs">{JSON.stringify(latest.rawPayload, null, 2)}</pre>
              </details>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">No reading has arrived yet. This page refreshes on its own.</p>
          )}
        </Card>
      </div>

      {panel ? (
        <div className="mt-6">
          <DeviceAssignmentPanel device={device} mode={panel} onDone={() => setPanel(null)} onCancel={() => setPanel(null)} />
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <SectionHead title="Charts" />
        <div className="flex gap-1" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <Button key={r} variant={r === range ? 'primary' : 'secondary'} onClick={() => setRange(r)}>
              {r}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ADMIN_CHARTS.map((chart) => {
          const stats = adminSeries(points, chart.key);
          return stats && stats.points.length >= 2 ? (
            <SensorMetricChart
              key={chart.key}
              label={chart.label}
              icon={chart.icon}
              unit={chart.unit}
              decimals={chart.decimals}
              statusOf={chart.statusOf}
              band={chart.band}
              floorAtZero={chart.floorAtZero}
              rangeLabel={RANGE_LABEL[range]}
              series={stats}
              formatTime={formatTime}
            />
          ) : (
            <Card key={chart.key} className="p-5">
              <p className="kicker">{chart.label}</p>
              <p className="mt-4 text-sm text-muted">{series.isLoading ? 'Loading…' : `Not enough data in the ${RANGE_LABEL[range]}.`}</p>
            </Card>
          );
        })}
      </div>

      <ReadingsTable title="Recent readings" rows={recent} emptyText="No readings yet." />
      <ReadingsTable title="Fault history" rows={faults} emptyText="No faults recorded." />

      <Card className="mt-8 overflow-hidden">
        <div className="p-5 pb-3">
          <SectionHead title="Activity" />
        </div>
        <ul className="divide-y divide-edge/40 text-sm">
          {audit.length === 0 ? (
            <li className="px-5 py-6 text-center text-muted">No changes recorded.</li>
          ) : (
            audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="font-mono text-xs font-semibold text-olive-deep">{a.action}</span>
                <span className="text-xs text-muted">
                  by {a.actorId} · {a.createdAt.toLocaleString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </Card>
      <p className="mt-6 text-xs text-muted">
        Charts are averaged over {range === '24h' ? '5-minute' : range === '7d' ? '30-minute' : '2-hour'} buckets. Back to <Link to="/app/admin/sensors" className="underline">the fleet</Link>.
      </p>
    </div>
  );
}

function ReadingsTable({ title, rows, emptyText }: { title: string; rows: Reading[]; emptyText: string }) {
  return (
    <Card className="mt-8 overflow-hidden">
      <div className="p-5 pb-3">
        <SectionHead title={title} />
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-edge/60">
              <Th>Time</Th>
              <Th>Temp</Th>
              <Th>Humidity</Th>
              <Th>RSSI</Th>
              <Th>SNR</Th>
              <Th>Error</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/40">
            {rows.length === 0 ? (
              <EmptyRow colSpan={6}>{emptyText}</EmptyRow>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-2.5 font-mono text-xs">{r.timestamp.toLocaleString()}</td>
                  <td className="px-5 py-2.5 font-mono text-xs tnum">{formatMetric(r.tempC, '°C', 1)}</td>
                  <td className="px-5 py-2.5 font-mono text-xs tnum">{formatMetric(r.humidityPct, '%', 0)}</td>
                  <td className="px-5 py-2.5 font-mono text-xs tnum">{formatMetric(r.rssi, 'dBm', 0)}</td>
                  <td className="px-5 py-2.5 font-mono text-xs tnum">{formatMetric(r.snr, 'dB', 1)}</td>
                  <td className={`px-5 py-2.5 font-mono text-xs ${r.errorCode ? 'text-rust' : 'text-muted'}`}>
                    {r.errorCode ? `${r.errorCode}${r.errorMessage ? ` — ${r.errorMessage}` : ''}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
