import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { Icon } from '../ui/Icon';
import { operationsNav, type NavItem } from '../../lib/nav';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { trpc } from '../../lib/trpc';

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Admin',
    OPS_MANAGER: 'Ops Manager',
    DRIVER: 'Driver',
    WORKER: 'Worker',
};

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
    return (
        <Link
            to={item.href}
            title={collapsed ? item.label : undefined}
            className={`group flex items-center rounded-lg py-2 text-sm transition-colors ${
                collapsed ? 'justify-center px-0' : 'gap-3 px-3'
            } ${active ? 'bg-white/10 text-bone-light' : 'text-bone/65 hover:bg-white/5 hover:text-bone-light'}`}
        >
            <Icon name={item.icon} width={17} height={17} className={active ? 'text-rust-light' : 'text-bone/45 group-hover:text-bone/70'} />
            {collapsed ? null : (
                <>
                    <span className="font-medium">{item.label}</span>
                    {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-rust-light" /> : null}
                </>
            )}
        </Link>
    );
}

function NavGroup({
    title,
    items,
    pathname,
    hasModule,
    subscriptionLoading,
    collapsed,
}: {
    title: string;
    items: NavItem[];
    pathname: string;
    hasModule: (key: NonNullable<NavItem['module']>) => boolean;
    subscriptionLoading: boolean;
    collapsed: boolean;
}) {
    const visibleItems = items.filter((item) => !item.module || (!subscriptionLoading && hasModule(item.module)));
    if (visibleItems.length === 0) return null;

    return (
        <div className={collapsed ? 'px-2' : 'px-3'}>
            {collapsed ? (
                <div className="mx-3 mb-2 mt-5 border-t border-white/10" />
            ) : (
                <p className="px-3 pb-2 pt-5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-bone/40">{title}</p>
            )}
            <ul className="space-y-0.5">
                {visibleItems.map((item) => (
                    <li key={item.href}>
                        <NavLink item={item} active={pathname === item.href || pathname.startsWith(item.href + '/')} collapsed={collapsed} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function Sidebar({
    onNavigate,
    collapsed = false,
    onToggleCollapse,
}: {
    onNavigate?: () => void;
    /** Desktop icon-rail mode. The mobile drawer never collapses. */
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}) {
    const pathname = useLocation().pathname;
    const { user, logout } = useAuth();
    const { hasModule, modulesReady } = useSubscription();
    // Platform-admin flag is NOT on auth.me — it's the org-independent DB flag
    // served by admin.whoAmI. Server-side platformAdminProcedure is the real
    // gate; this only decides whether to show the nav entry.
    const whoAmI = trpc.admin.whoAmI.useQuery(undefined, { staleTime: 300_000 });
    const platformNav: NavItem[] = whoAmI.data?.isPlatformAdmin
        ? [{ label: 'Org Modules', href: '/app/admin/orgs', icon: 'grid' }]
        : [];

    return (
        <div className="flex h-full flex-col bg-olive-deep text-bone" onClick={onNavigate}>
            <div className={`relative border-b border-white/10 ${collapsed ? 'px-2 py-4' : 'px-5 py-5'}`}>
                <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark opacity-60" />
                {collapsed ? null : (
                    <>
                        <Link to="/app/dashboard" className="relative inline-flex">
                            <Logo variant="light" className="h-7 w-auto" />
                        </Link>
                        <p className="relative mt-2 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-bone/40">
                            Facility OS · Plant 01
                        </p>
                    </>
                )}
                {onToggleCollapse ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        className={`relative flex items-center justify-center rounded-lg py-1.5 text-bone/50 transition-colors hover:bg-white/10 hover:text-bone-light ${
                            collapsed ? 'mx-auto w-9' : 'absolute right-3 top-1/2 w-8 -translate-y-1/2'
                        }`}
                    >
                        <Icon name="arrow" width={15} height={15} className={collapsed ? '' : 'rotate-180'} />
                    </button>
                ) : null}
            </div>

            <nav className="scroll-thin flex-1 overflow-y-auto pb-4">
                <NavGroup title="Operations" items={operationsNav} pathname={pathname} hasModule={hasModule} subscriptionLoading={!modulesReady} collapsed={collapsed} />
                {platformNav.length > 0 ? (
                    <NavGroup title="Platform" items={platformNav} pathname={pathname} hasModule={hasModule} subscriptionLoading={false} collapsed={collapsed} />
                ) : null}
            </nav>

            <ProfileChip email={user?.email} onLogout={() => void logout()} collapsed={collapsed} />
        </div>
    );
}

/**
 * Bottom-of-sidebar user chip. Clicking it opens a small menu (anchored
 * above, since the chip sits at the viewport bottom) with Settings and
 * Sign out. The name/role line comes from auth.me (org-scoped role); the
 * Supabase email is the fallback while that loads.
 */
function ProfileChip({ email, onLogout, collapsed = false }: { email?: string; onLogout: () => void; collapsed?: boolean }) {
    const [open, setOpen] = useState(false);
    const me = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
    const displayName = me.data?.name ?? email ?? 'Operator';
    const roleLabel = me.data?.orgRole ? (ROLE_LABELS[me.data.orgRole] ?? me.data.orgRole) : 'Facility Operator';

    return (
        <div className={`relative border-t border-white/10 ${collapsed ? 'p-2' : 'p-3'}`}>
            {open ? (
                <>
                    {/* click-away backdrop */}
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
                    <div className={`absolute bottom-full z-20 mb-1 overflow-hidden rounded-lg border border-white/10 bg-olive-deep shadow-xl ${
                        collapsed ? 'left-2 w-56' : 'left-3 right-3'
                    }`}>
                        <div className="border-b border-white/10 px-3 py-2.5">
                            <p className="truncate text-sm font-semibold text-bone-light">{displayName}</p>
                            <p className="truncate text-xs text-bone/50">{email}</p>
                        </div>
                        <Link
                            to="/app/settings"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-bone/80 transition-colors hover:bg-white/10 hover:text-bone-light"
                        >
                            <Icon name="badge" width={15} height={15} className="text-bone/50" />
                            Settings
                        </Link>
                        <button
                            onClick={onLogout}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-bone/80 transition-colors hover:bg-white/10 hover:text-rust-light"
                        >
                            <Icon name="logout" width={15} height={15} className="text-bone/50" />
                            Sign out
                        </button>
                    </div>
                </>
            ) : null}
            <button
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
                aria-haspopup="menu"
                aria-expanded={open}
                title={collapsed ? displayName : undefined}
                className={`flex w-full items-center rounded-lg text-left transition-colors hover:bg-white/5 ${
                    collapsed ? 'justify-center px-0 py-1.5' : 'gap-3 px-2 py-1.5'
                }`}
            >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rust/80 font-display text-sm font-bold text-canvas">
                    {(displayName || 'OP').slice(0, 1).toUpperCase()}
                </div>
                {collapsed ? null : (
                    <>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-bone-light">{displayName}</p>
                            <p className="truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-bone/40">{roleLabel}</p>
                        </div>
                        <Icon name="arrow" width={14} height={14} className={`-rotate-90 text-bone/40 ${open ? '' : 'opacity-60'}`} />
                    </>
                )}
            </button>
        </div>
    );
}
