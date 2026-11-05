import type { ReactNode } from 'react';
import { trpc } from '../../lib/trpc';
import { useSubscription } from '../../context/SubscriptionContext';
import { UpgradePrompt } from '../../components/UpgradePrompt';
import { FacilityLoader } from '../../components/app/FacilityLoader';

/**
 * Page-level gate for the NFC admin pages: WORKFORCE module on AND an ADMIN /
 * OPS_MANAGER org role. The API enforces both on every procedure; this just
 * avoids showing a broken page to someone who reached the URL directly.
 */
export function ManagerGate({ label, children }: { label: string; children: ReactNode }) {
    const { hasModule, isLoading } = useSubscription();
    const me = trpc.auth.me.useQuery();

    if (isLoading || me.isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <FacilityLoader variant="inline" label={label} />
            </div>
        );
    }
    if (!hasModule('WORKFORCE')) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <UpgradePrompt module="WORKFORCE" />
            </div>
        );
    }
    if (me.data?.orgRole !== 'ADMIN' && me.data?.orgRole !== 'OPS_MANAGER') {
        return (
            <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted">
                {label} is available to admins and ops managers only.
            </div>
        );
    }
    return <>{children}</>;
}
