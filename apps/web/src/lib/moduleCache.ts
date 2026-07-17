import type { ModuleKey } from '@bin-tracker/types';

/**
 * Last-known module set, persisted so the sidebar renders its module-gated
 * links instantly on the next visit instead of popping in after three
 * billing queries resolve. Server data always overwrites it once loaded —
 * the cache only ever bridges the initial fetch. Lives here (not in
 * SubscriptionContext) so AuthContext can clear it on logout without a
 * circular import.
 */
const MODULES_CACHE_KEY = 'npb.enabledModules';

export function readCachedModules(): ModuleKey[] | null {
    try {
        const raw = localStorage.getItem(MODULES_CACHE_KEY);
        return raw ? (JSON.parse(raw) as ModuleKey[]) : null;
    } catch {
        return null;
    }
}

export function writeCachedModules(modules: ModuleKey[]): void {
    try {
        localStorage.setItem(MODULES_CACHE_KEY, JSON.stringify(modules));
    } catch {
        // Private-mode/quota failures just lose the fast path.
    }
}

/** Called on logout so the next account/org never sees the previous one's links. */
export function clearCachedModules(): void {
    try {
        localStorage.removeItem(MODULES_CACHE_KEY);
    } catch {
        // Nothing to clear in private mode.
    }
}
