import { useEffect } from 'react';
import { trpc, getSelectedOrgId, setSelectedOrgId } from '../../lib/trpc';

/**
 * Org switcher for users who belong to more than one organization. Renders
 * nothing for the common single-org case.
 *
 * Switching writes the choice to the persisted `x-org-id` store and does a
 * full page reload rather than trying to surgically re-fetch: a reload
 * guarantees every org-scoped query re-runs under the new tenant with a clean
 * React Query cache, so there's no window where org A's data shows under org
 * B. Switching orgs is rare, so the reload cost is irrelevant.
 */
export function OrgSwitcher({ collapsed = false }: { collapsed?: boolean }) {
    const myOrgs = trpc.auth.myOrgs.useQuery(undefined, { staleTime: 300_000 });
    const orgs = myOrgs.data ?? [];

    const selected = getSelectedOrgId();

    // Reconcile a stale selection (user was removed from that org since last
    // visit): drop it so the backend falls back to their default org. Safe
    // regardless — the API already fails closed on an unknown x-org-id.
    useEffect(() => {
        if (orgs.length > 0 && selected && !orgs.some((o) => o.orgId === selected)) {
            setSelectedOrgId(null);
        }
    }, [orgs, selected]);

    if (orgs.length < 2) return null;

    // No stored selection yet = acting in the default (oldest) org, which the
    // backend resolves first.
    const current = selected && orgs.some((o) => o.orgId === selected) ? selected : orgs[0]?.orgId;

    const handleChange = (orgId: string) => {
        if (orgId === current) return;
        setSelectedOrgId(orgId);
        window.location.assign('/app/dashboard');
    };

    // Icon-rail mode has no room for a select — the user expands the sidebar to switch.
    if (collapsed) return null;

    return (
        <div className="px-3 pt-3">
            <label className="mb-1 block px-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-bone/40">
                Organization
            </label>
            <select
                value={current}
                onChange={(e) => handleChange(e.target.value)}
                aria-label="Switch organization"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-bone-light outline-none transition-colors focus:border-white/25"
            >
                {orgs.map((o) => (
                    <option key={o.orgId} value={o.orgId} className="bg-olive-deep text-bone-light">
                        {o.name}
                    </option>
                ))}
            </select>
        </div>
    );
}
