import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ModuleKey, Plan, SubscriptionStatus } from '@bin-tracker/types';
import { trpc } from '../lib/trpc';
import { useAuth } from './AuthContext';
import { readCachedModules, writeCachedModules } from '../lib/moduleCache';

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
    /**
     * True once hasModule can answer meaningfully — from fresh server data
     * OR the localStorage cache. Unlike isLoading (which tracks the real
     * queries, for billing UI), this goes true instantly on repeat visits
     * so the sidebar never hides module links while refetching.
     */
    modulesReady: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
    // current/enabledModules are org-scoped (orgProcedure), so they must wait
    // for the Supabase session restore to hand the JWT to the tRPC client —
    // fired unconditionally they race it: the first request goes out with no
    // Authorization header, 401s, and only the ~1s retry (or a refocus)
    // recovers. Gating on `user` also stops them from firing at all on
    // station-token kiosk routes, which have no user session to answer with.
    // Under the DISABLE_AUTH dev bypass there is no Supabase user; the
    // backend injects one, so the queries stay ungated there.
    const { user } = useAuth();
    const authed = import.meta.env.VITE_DISABLE_AUTH === 'true' || user !== null;
    // status is public — safe to fire immediately.
    const statusQuery = trpc.billing.status.useQuery();
    const currentQuery = trpc.billing.current.useQuery(undefined, { enabled: authed });
    const modulesQuery = trpc.billing.enabledModules.useQuery(undefined, { enabled: authed });

    const [cachedModules] = useState(readCachedModules);
    useEffect(() => {
        if (modulesQuery.data) writeCachedModules(modulesQuery.data);
    }, [modulesQuery.data]);

    const enabledModules = useMemo(
        () => modulesQuery.data ?? cachedModules ?? [],
        [modulesQuery.data, cachedModules],
    );

    const value = useMemo<SubscriptionContextValue>(
        () => ({
            billingEnabled: statusQuery.data?.enabled ?? false,
            hasModule: (key: ModuleKey) => enabledModules.includes(key),
            enabledModules,
            plan: currentQuery.data?.plan,
            status: currentQuery.data?.status,
            currentPeriodEnd: currentQuery.data?.currentPeriodEnd,
            isLoading: statusQuery.isLoading || currentQuery.isLoading || modulesQuery.isLoading,
            modulesReady: modulesQuery.data !== undefined || cachedModules !== null,
        }),
        [statusQuery.data, statusQuery.isLoading, currentQuery.data, currentQuery.isLoading, enabledModules, modulesQuery.isLoading, modulesQuery.data, cachedModules],
    );

    return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
    const ctx = useContext(SubscriptionContext);
    if (!ctx) throw new Error('useSubscription must be used inside SubscriptionProvider');
    return ctx;
}
