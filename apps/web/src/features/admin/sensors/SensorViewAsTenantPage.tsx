import { useNavigate, useParams } from 'react-router-dom';
import { trpc, type RouterOutputs } from '../../../lib/trpc';
import { PageHeader } from '../../../components/app/PageHeader';
import { Icon } from '../../../components/ui/Icon';
import { Badge, Card } from '../../../components/ui/primitives';
import { LiveSinceReading, TenantSensorView } from '../../facility-zones/TenantSensorView';
import { describeLastSeen } from '../../../lib/zone-sensors';
import { LinkButton, PlatformAdminGate, selectClass } from './ui';

type TenantList = RouterOutputs['sensorAdmin']['viewAsTenant'];
type TenantDevice = TenantList['devices'][number];

const TONE = { OK: 'good', WARN: 'warn', ALERT: 'alert', UNKNOWN: 'idle' } as const;
const REFRESH_MS = 60_000;

export default function SensorViewAsTenantPage() {
  return (
    <PlatformAdminGate>
      <ViewAsContent />
    </PlatformAdminGate>
  );
}

function ViewAsContent() {
  const { orgId } = useParams<{ orgId?: string }>();
  const navigate = useNavigate();
  const orgs = trpc.admin.listOrganizations.useQuery();
  const view = trpc.sensorAdmin.viewAsTenant.useQuery(
    { organizationId: orgId ?? '' },
    { enabled: Boolean(orgId), refetchInterval: REFRESH_MS, retry: false },
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="View as tenant"
        subtitle="Exactly what an organization's own users see — nothing more."
        icon={<Icon name="grid" width={22} height={22} />}
        actions={<LinkButton to="/app/admin/sensors">Back to fleet</LinkButton>}
      />

      <select
        aria-label="Organization"
        className={`${selectClass} mb-4`}
        value={orgId ?? ''}
        onChange={(e) => navigate(e.target.value ? `/app/admin/sensors/view-as/${e.target.value}` : '/app/admin/sensors/view-as')}
      >
        <option value="">Choose an organization…</option>
        {(orgs.data ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      {!orgId ? (
        <p className="text-sm text-muted">Pick an organization to see its tenant view.</p>
      ) : view.isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : view.isError ? (
        <p className="text-sm text-rust">{view.error.message}</p>
      ) : view.data ? (
        <>
          <Card className="mb-6 bg-bone-light p-4 text-sm text-olive-deep">
            Viewing as <strong>{view.data.organization.name}</strong>. Tenants see only active devices, by name, with temperature and humidity
            from the time each was assigned to them.
          </Card>
          {view.data.devices.length === 0 ? (
            <p className="text-sm text-muted">This organization has no active devices.</p>
          ) : (
            <div className="grid gap-8">
              {view.data.devices.map((device) => (
                <TenantDeviceSection key={device.id} organizationId={view.data.organization.id} device={device} list={view.data} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function TenantDeviceSection({ organizationId, device, list }: { organizationId: string; device: TenantDevice; list: TenantList }) {
  const history = trpc.sensorAdmin.viewAsTenantReadings.useQuery(
    { organizationId, deviceId: device.id, range: '24h' },
    { refetchInterval: REFRESH_MS, retry: false },
  );
  const formatTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('en-US', { timeZone: list.companyTimezone, hour: '2-digit', minute: '2-digit', hour12: false });
  const seen = describeLastSeen(device.lastSeenAt, list.offlineAfterMinutes);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-olive-deep">{device.name}</h2>
          <p className="text-sm text-muted">
            {device.zone?.name ?? 'No zone'} · {device.facility.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={TONE[device.latestStatus]}>{device.latestStatus}</Badge>
          {device.lastSeenAt ? (
            <LiveSinceReading lastSeenAt={device.lastSeenAt} offlineAfterMinutes={list.offlineAfterMinutes} />
          ) : (
            <Badge tone="idle">{seen.text}</Badge>
          )}
        </div>
      </div>
      <TenantSensorView
        deviceName={device.name}
        zoneName={device.zone?.name ?? device.name}
        history={history.data}
        isLoading={history.isLoading}
        formatTime={formatTime}
      />
    </section>
  );
}
