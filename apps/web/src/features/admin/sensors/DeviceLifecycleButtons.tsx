import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { Button } from '../../../components/ui/primitives';
import type { DeviceState } from './status';

/**
 * Deactivate / Reactivate for a device. Deactivating stops its readings being
 * accepted and hides it from its tenant, so it asks for a second click inline
 * (a browser confirm() would block the page and the test tooling).
 */
export function DeviceLifecycleButtons({ deviceId, state }: { deviceId: string; state: DeviceState }) {
  const utils = trpc.useUtils();
  const [confirming, setConfirming] = useState(false);
  const onSuccess = async () => {
    setConfirming(false);
    await utils.sensorAdmin.invalidate();
  };
  const deactivate = trpc.sensorAdmin.deactivateDevice.useMutation({ onSuccess });
  const reactivate = trpc.sensorAdmin.reactivateDevice.useMutation({ onSuccess });
  const error = deactivate.error ?? reactivate.error;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === 'DEACTIVATED' ? (
        <Button variant="secondary" disabled={reactivate.isPending} onClick={() => reactivate.mutate({ deviceId })}>
          Reactivate
        </Button>
      ) : confirming ? (
        <>
          <span className="text-sm text-muted">Stop accepting readings and hide it from its tenant?</span>
          <Button variant="rust" disabled={deactivate.isPending} onClick={() => deactivate.mutate({ deviceId })}>
            Yes, deactivate
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Deactivate
        </Button>
      )}
      {error ? <span className="text-sm text-rust">{error.message}</span> : null}
    </div>
  );
}
