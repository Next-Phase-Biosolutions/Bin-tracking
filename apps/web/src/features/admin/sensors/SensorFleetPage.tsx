import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { trpc, type RouterOutputs } from '../../../lib/trpc';
import { PageHeader } from '../../../components/app/PageHeader';
import { Icon } from '../../../components/ui/Icon';
import { Badge, Button, Card, SectionHead, Stat } from '../../../components/ui/primitives';
import { formatAgo, formatMetric } from './format';
import { adminStatusTone, stateTone, type DeviceState } from './status';
import { EmptyRow, inputClass, LinkButton, PlatformAdminGate, selectClass, Th, type FleetRow } from './ui';

const STATES: DeviceState[] = ['UNASSIGNED', 'ACTIVE', 'DEACTIVATED'];
const HEALTHS = ['online', 'offline', 'fault', 'waiting'] as const;
type Health = (typeof HEALTHS)[number];
const PAGE_SIZE = 25;
const REFRESH_MS = 30_000;

/** A URL param is user-editable, so only accept the values the API will accept. */
function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

export default function SensorFleetPage() {
  return (
    <PlatformAdminGate>
      <FleetContent />
    </PlatformAdminGate>
  );
}

function FleetContent() {
  const [params, setParams] = useSearchParams();
  const state = oneOf(params.get('state'), STATES);
  const health = oneOf(params.get('health'), HEALTHS);
  const organizationId = params.get('org') ?? undefined;
  const search = params.get('q') ?? undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [searchText, setSearchText] = useState(search ?? '');

  const summary = trpc.sensorAdmin.fleetSummary.useQuery(undefined, { refetchInterval: REFRESH_MS });
  const list = trpc.sensorAdmin.listFleetDevices.useQuery(
    { state, health, organizationId, search, page, pageSize: PAGE_SIZE },
    { refetchInterval: REFRESH_MS },
  );
  const orgs = trpc.admin.listOrganizations.useQuery();

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page'); // a new filter starts from page 1
    setParams(next);
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setParam('q', searchText.trim() || undefined);
  };

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Sensor Fleet"
        subtitle="Every device across every organization."
        icon={<Icon name="thermo" width={22} height={22} />}
        actions={
          <>
            <LinkButton to="/app/admin/sensors/register">Register devices</LinkButton>
            <LinkButton to="/app/admin/sensors/view-as">View as tenant</LinkButton>
            <LinkButton to="/app/admin/zones">Zones</LinkButton>
          </>
        }
      />

      <SummaryTiles data={summary.data} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <AlertsCard alerts={summary.data?.alerts ?? []} loading={summary.isLoading} />
        <OfflineThresholdCard currentMinutes={summary.data?.offlineAfterMinutes} />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-edge/60 p-4">
          <select aria-label="State" className={selectClass} value={state ?? ''} onChange={(e) => setParam('state', e.target.value)}>
            <option value="">All states</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
          <select aria-label="Health" className={selectClass} value={health ?? ''} onChange={(e) => setParam('health', e.target.value)}>
            <option value="">Any health</option>
            {HEALTHS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <select aria-label="Organization" className={selectClass} value={organizationId ?? ''} onChange={(e) => setParam('org', e.target.value)}>
            <option value="">All organizations</option>
            {(orgs.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <form onSubmit={submitSearch} className="flex items-center gap-2">
            <input
              aria-label="Search devices"
              className={inputClass}
              placeholder="Search id or name"
              value={searchText}
              maxLength={64}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
          {state || health || organizationId || search ? (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchText('');
                setParams({});
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-edge/60">
                <Th>Device</Th>
                <Th>Tenant</Th>
                <Th>Zone</Th>
                <Th>Latest</Th>
                <Th>Last seen</Th>
                <Th>State</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {list.isLoading ? (
                <EmptyRow colSpan={7}>Loading…</EmptyRow>
              ) : list.isError ? (
                <EmptyRow colSpan={7} tone="alert">
                  {list.error.message}
                </EmptyRow>
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={7}>No devices match.</EmptyRow>
              ) : (
                rows.map((row) => <DeviceRow key={row.id} row={row} />)
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-edge/60 px-5 py-3 text-sm text-muted">
          <span>
            {total} device{total === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setParams(withPage(params, page - 1))}>
              Previous
            </Button>
            <span className="font-mono text-xs">
              {page} / {pageCount}
            </span>
            <Button variant="secondary" disabled={page >= pageCount} onClick={() => setParams(withPage(params, page + 1))}>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function withPage(params: URLSearchParams, page: number): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set('page', String(page));
  return next;
}

function SummaryTiles({ data }: { data: RouterOutputs['sensorAdmin']['fleetSummary'] | undefined }) {
  const value = (n: number | undefined) => (n === undefined ? '…' : n);
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
      <Stat label="Unassigned" value={value(data?.byState.UNASSIGNED)} accent={(data?.byState.UNASSIGNED ?? 0) > 0} />
      <Stat label="Active" value={value(data?.byState.ACTIVE)} />
      <Stat label="Deactivated" value={value(data?.byState.DEACTIVATED)} />
      <Stat label="Online" value={value(data?.online)} />
      <Stat label="Offline" value={value(data?.offline)} accent={(data?.offline ?? 0) > 0} />
      <Stat label="In fault" value={value(data?.inFault)} accent={(data?.inFault ?? 0) > 0} />
      <Stat label="Readings (1h)" value={value(data?.readingsLastHour)} />
    </div>
  );
}

function AlertsCard({ alerts, loading }: { alerts: FleetRow[]; loading: boolean }) {
  return (
    <Card className="p-5">
      <SectionHead title="Fleet alerts" />
      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : alerts.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No device is in fault, alert or offline.</p>
      ) : (
        <ul className="mt-3 divide-y divide-edge/40">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <Link to={`/app/admin/sensors/${a.id}`} className="min-w-0 flex-1">
                <span className="font-semibold text-olive-deep">{a.name}</span>
                <span className="ml-2 text-xs text-muted">
                  {a.organization?.name ?? '—'} · {formatAgo(a.lastSeenAt, new Date())}
                </span>
              </Link>
              <Badge tone={adminStatusTone(a.status)}>{a.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Platform-wide: how long a device may stay silent before it counts as offline (the real send interval is unconfirmed). */
function OfflineThresholdCard({ currentMinutes }: { currentMinutes: number | undefined }) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<string | null>(null);
  const save = trpc.sensorAdmin.setOfflineThreshold.useMutation({
    onSuccess: async () => {
      setDraft(null);
      await utils.sensorAdmin.invalidate();
    },
  });

  const shown = draft ?? (currentMinutes === undefined ? '' : String(currentMinutes));
  const minutes = Number(shown);
  const valid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440;

  return (
    <Card className="p-5">
      <SectionHead title="Offline threshold" />
      <p className="mt-2 text-xs text-muted">A device silent for longer than this counts as offline, for admins and tenants alike.</p>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate({ minutes });
        }}
      >
        <input
          aria-label="Offline after minutes"
          className={`${inputClass} w-24`}
          inputMode="numeric"
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
        />
        <span className="text-sm text-muted">minutes</span>
        <Button type="submit" variant="secondary" disabled={!valid || draft === null || save.isPending}>
          Save
        </Button>
      </form>
      {draft !== null && !valid ? <p className="mt-2 text-xs text-rust">Enter a whole number from 1 to 1440.</p> : null}
      {save.isError ? <p className="mt-2 text-xs text-rust">{save.error.message}</p> : null}
    </Card>
  );
}

function DeviceRow({ row }: { row: FleetRow }) {
  const now = new Date();
  return (
    <tr className="hover:bg-bone-light/60">
      <td className="px-5 py-3">
        <Link to={`/app/admin/sensors/${row.id}`} className="font-semibold text-olive-deep hover:underline">
          {row.name}
        </Link>
        <p className="font-mono text-[0.62rem] text-muted">{row.externalId}</p>
      </td>
      <td className="px-5 py-3 text-muted">
        {row.organization ? (
          <>
            <span className="text-olive-deep">{row.organization.name}</span>
            <p className="text-xs">{row.facility?.name ?? '—'}</p>
          </>
        ) : (
          '—'
        )}
      </td>
      <td className="px-5 py-3 text-muted">{row.zone?.name ?? '—'}</td>
      <td className="px-5 py-3 font-mono text-xs tnum">
        {formatMetric(row.latest?.tempC, '°C', 1)} · {formatMetric(row.latest?.humidityPct, '%', 0)}
      </td>
      <td className="px-5 py-3 text-muted">{formatAgo(row.lastSeenAt, now)}</td>
      <td className="px-5 py-3">
        <Badge tone={stateTone(row.state)}>{row.state.toLowerCase()}</Badge>
      </td>
      <td className="px-5 py-3">
        <Badge tone={adminStatusTone(row.status)}>{row.status}</Badge>
      </td>
    </tr>
  );
}
