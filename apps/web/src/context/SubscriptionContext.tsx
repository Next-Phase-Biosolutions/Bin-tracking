import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ModuleKey, Plan, SubscriptionStatus } from '@bin-tracker/types';
import { trpc } from '../lib/trpc';

/**
 * Last-known module set, persisted so the sidebar renders its module-gated
 * links instantly on the next visit instead of popping in after three
 * billing queries resolve. Server data always overwrites it once loaded —
 * the cache only ever bridges the initial fetch.
 */
const MODULES_CACHE_KEY = 'npb.enabledModules';

function readCachedModules(): ModuleKey[] | null {
    try {
        const raw = localStorage.getItem(MODULES_CACHE_KEY);
        return raw ? (JSON.parse(raw) as ModuleKey[]) : null;
    } catch {
        return null;
    }
}

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
    // status is public. current/enabledModules are org-scoped (orgProcedure) —
    // fired unconditionally like every other org-scoped query in this app
    // (org/auth resolution, including the DISABLE_AUTH dev bypass, happens
    // server-side in tRPC context; there is nothing more to gate on here).
    const statusQuery = trpc.billing.status.useQuery();
    const currentQuery = trpc.billing.current.useQuery();
    const modulesQuery = trpc.billing.enabledModules.useQuery();

    const [cachedModules] = useState(readCachedModules);
    useEffect(() => {
        if (modulesQuery.data) {
            try {
                localStorage.setItem(MODULES_CACHE_KEY, JSON.stringify(modulesQuery.data));
            } catch {
                // Private-mode/quota failures just lose the fast path.
            }
        }
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
