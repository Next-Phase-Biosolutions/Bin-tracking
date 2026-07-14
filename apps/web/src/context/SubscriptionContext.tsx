import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ModuleKey, Plan, SubscriptionStatus } from '@bin-tracker/types';
import { trpc } from '../lib/trpc';

interface SubscriptionContextValue {
    /** Whether Stripe billing is turned on at all (`BILLING_ENABLED` env flag). */
    billingEnabled: boolean;
    /** True if `key` is in the org's currently enabled module set. */
    hasModule: (key: ModuleKey) => boolean;
    enabledModules: ModuleKey[];
    plan: Plan | undefined;
    status: SubscriptionStatus | undefined;
    currentPeriodEnd: Date | null | undefined;
    isLoading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
    // status is public. current/enabledModules are org-scoped (orgProcedure) —
    // fired unconditionally like every other org-scoped query in this app
    // (org/auth resolution, including the DISABLE_AUTH dev bypass, happens
    // server-side in tRPC context; there is nothing more to gate on here).
    const statusQuery = trpc.billing.status.useQuery();
    const currentQuery = trpc.billing.current.useQuery();
    const modulesQuery = trpc.billing.enabledModules.useQuery();

    const enabledModules = useMemo(() => modulesQuery.data ?? [], [modulesQuery.data]);

    const value = useMemo<SubscriptionContextValue>(
        () => ({
            billingEnabled: statusQuery.data?.enabled ?? false,
            hasModule: (key: ModuleKey) => enabledModules.includes(key),
            enabledModules,
            plan: currentQuery.data?.plan,
            status: currentQuery.data?.status,
            currentPeriodEnd: currentQuery.data?.currentPeriodEnd,
            isLoading: statusQuery.isLoading || currentQuery.isLoading || modulesQuery.isLoading,
        }),
        [statusQuery.data, statusQuery.isLoading, currentQuery.data, currentQuery.isLoading, enabledModules, modulesQuery.isLoading],
    );

    return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
    const ctx = useContext(SubscriptionContext);
    if (!ctx) throw new Error('useSubscription must be used inside SubscriptionProvider');
    return ctx;
}
