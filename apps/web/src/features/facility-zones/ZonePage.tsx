import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/app/PageHeader';
import { Badge, Button, Card } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { FacilityLoader } from '../../components/app/FacilityLoader';
import { getZone } from '../../lib/facility-zones-data';
import { pickZoneDevice } from '../../lib/zone-sensors';
import { facilitiesWithZone, resolveZoneFacility, zonePageState, zoneViewMode } from '../../lib/zone-view';
import { trpc } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { MockZoneView } from './MockZoneView';
import { LiveSinceReading, TenantSensorView } from './TenantSensorView';

const DEFAULT_TIMEZONE = 'America/Toronto';

export default function ZonePage() {
  // The route param is the zone SLUG (/app/zones/:zoneId), kept so existing links work.
  const { zoneId: slug } = useParams<{ zoneId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFacility = searchParams.get('facility');

  const zonesQuery = trpc.zone.listMine.useQuery(undefined, { staleTime: 60_000 });
  const zones = zonesQuery.data ?? [];
  const zoneRow = slug ? resolveZoneFacility(zones, slug, requestedFacility) : undefined;
  const facilityOptions = slug ? facilitiesWithZone(zones, slug) : [];

  const { hasModule, modulesReady } = useSubscription();
  // Skip the query entirely when the org lacks the module — it could only come
  // back FORBIDDEN. Which device (if any) belongs to this zone is only known
  // after the org-scoped device list returns.
  const sensorsAvailable = modulesReady && hasModule('ENVIRONMENT_MONITORING');
  const devicesQuery = trpc.sensor.listDevices.useQuery(
    {},
    {
      enabled: sensorsAvailable,
      // Devices push readings continuously; without this the page freezes at whatever it showed on mount.
      refetchInterval: 60_000,
      // A module-gated 403 is a permanent answer, not a blip.
      retry: false,
    },
  );

  const device = zoneRow ? pickZoneDevice(devicesQuery.data?.devices, zoneRow.id) : undefined;
  const companyTimezone = devicesQuery.data?.companyTimezone ?? DEFAULT_TIMEZONE;
  const offlineAfterMinutes = devicesQuery.data?.offlineAfterMinutes ?? 20;

  const historyQuery = trpc.sensor.getReadings.useQuery(
    { deviceId: device?.id ?? '', range: '24h' },
    { enabled: device !== undefined, refetchInterval: 60_000, retry: false },
  );

  const formatTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('en-US', { timeZone: companyTimezone, hour: '2-digit', minute: '2-digit', hour12: false });

  const state = zonePageState({
    zonesLoading: zonesQuery.isLoading,
    zonesError: zonesQuery.isError,
    devicesLoading: sensorsAvailable && devicesQuery.isLoading,
    hasZone: Boolean(slug && zoneRow),
  });
  if (state === 'loading') {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center">
        <FacilityLoader variant="inline" label={slug} />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center">
        <Card className="w-full max-w-md p-8 text-center">
          <p className="text-sm text-muted">Couldn't load this zone. Check your connection and try again.</p>
          <Button className="mt-4" variant="secondary" onClick={() => void zonesQuery.refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }
  if (state === 'missing' || !slug || !zoneRow) return <Navigate to="/app/dashboard" replace />;

  const mock = getZone(slug);
  const mode = zoneViewMode({ slug, hasDevice: device !== undefined });
  const title = `${zoneRow.name} Zone`;
  const subtitle = mock?.tagline ?? zoneRow.facilityName;
  const icon = <Icon name={zoneRow.icon} width={22} height={22} />;

  const headerAction = device?.lastSeenAt ? (
    <LiveSinceReading lastSeenAt={device.lastSeenAt} offlineAfterMinutes={offlineAfterMinutes} />
  ) : device ? (
    <Badge tone="idle">awaiting first reading</Badge>
  ) : mock && mode === 'mock' ? (
    <Badge tone={mock.status}>
      {mock.status} · {mock.statusNote}
    </Badge>
  ) : undefined;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={title} subtitle={subtitle} icon={icon} actions={headerAction} />

      {facilityOptions.length > 1 ? (
        <label className="mb-4 mt-1 flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
          Facility
          <select
            value={zoneRow.facilityId}
            onChange={(e) => setSearchParams({ facility: e.target.value })}
            className="rounded-lg border border-edge bg-white px-3 py-1.5 text-sm font-semibold normal-case tracking-normal text-olive-deep"
          >
            {facilityOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {mode === 'sensor' && device ? (
        <TenantSensorView
          deviceName={device.name}
          zoneName={zoneRow.name}
          history={historyQuery.data}
          isLoading={historyQuery.isLoading}
          formatTime={formatTime}
        />
      ) : mode === 'mock' && mock ? (
        <MockZoneView zone={mock} />
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Card className="w-full max-w-md p-8 text-center">
            <Badge tone="idle">{mode === 'placeholder' ? 'Not accessible' : 'No sensor assigned to this zone'}</Badge>
          </Card>
        </div>
      )}
    </div>
  );
}
