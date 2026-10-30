import { trpc, type RouterOutputs } from '../../lib/trpc';
import { Badge } from '../../components/ui/primitives';
import { LiveSinceReading, TenantSensorView } from './TenantSensorView';

type TenantDevice = RouterOutputs['sensor']['listDevices']['devices'][number];

interface ZoneDeviceSectionProps {
  device: TenantDevice;
  zoneName: string;
  /** Name each section when a zone has several devices; a lone device is named by the page. */
  showName: boolean;
  offlineAfterMinutes: number;
  formatTime: (ms: number) => string;
}

/** One device's charts on a zone page. Owns its own history query, so every device in a zone is shown. */
export function ZoneDeviceSection({ device, zoneName, showName, offlineAfterMinutes, formatTime }: ZoneDeviceSectionProps) {
  const history = trpc.sensor.getReadings.useQuery(
    { deviceId: device.id, range: '24h' },
    { refetchInterval: 60_000, retry: false },
  );

  return (
    <section aria-label={device.name}>
      {showName ? (
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-olive-deep">{device.name}</h2>
          {device.lastSeenAt ? (
            <LiveSinceReading lastSeenAt={device.lastSeenAt} offlineAfterMinutes={offlineAfterMinutes} />
          ) : (
            <Badge tone="idle">awaiting first reading</Badge>
          )}
        </div>
      ) : null}
      <TenantSensorView
        deviceName={device.name}
        zoneName={zoneName}
        history={history.data}
        isLoading={history.isLoading}
        formatTime={formatTime}
        named={!showName}
      />
    </section>
  );
}
