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

function NavGroup({
    title,
    items,
    pathname,
    hasModule,
    subscriptionLoading,
}: {
    title: string;
    items: NavItem[];
    pathname: string;
    hasModule: (key: NonNullable<NavItem['module']>) => boolean;
    subscriptionLoading: boolean;
}) {
    const visibleItems = items.filter((item) => !item.module || (!subscriptionLoading && hasModule(item.module)));
    if (visibleItems.length === 0) return null;

    return (
        <div className="px-3">
            <p className="px-3 pb-2 pt-5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-bone/40">{title}</p>
            <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <li key={item.href}>
                            <Link
                                to={item.href}
                                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                                    active ? 'bg-white/10 text-bone-light' : 'text-bone/65 hover:bg-white/5 hover:text-bone-light'
                                }`}
                            >
                                <Icon name={item.icon} width={17} height={17} className={active ? 'text-rust-light' : 'text-bone/45 group-hover:text-bone/70'} />
                                <span className="font-medium">{item.label}</span>
                                {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-rust-light" /> : null}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = useLocation().pathname;
    const { user, logout } = useAuth();
    const { hasModule, modulesReady } = useSubscription();

    return (
        <div className="flex h-full flex-col bg-olive-deep text-bone" onClick={onNavigate}>
            <div className="relative border-b border-white/10 px-5 py-5">
                <div aria-hidden className="pointer-events-none absolute inset-0 data-grid-bg-dark opacity-60" />
                <Link to="/app/dashboard" className="relative inline-flex">
                    <Logo variant="light" className="h-7 w-auto" />
                </Link>
                <p className="relative mt-2 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-bone/40">
                    Facility OS · Plant 01
                </p>
            </div>

            <nav className="scroll-thin flex-1 overflow-y-auto pb-4">
                <NavGroup title="Operations" items={operationsNav} pathname={pathname} hasModule={hasModule} subscriptionLoading={!modulesReady} />
            </nav>

            <ProfileChip email={user?.email} onLogout={() => void logout()} />
        </div>
    );
}

/**
 * Bottom-of-sidebar user chip. Clicking it opens a small menu (anchored
 * above, since the chip sits at the viewport bottom) with Settings and
 * Sign out. The name/role line comes from auth.me (org-scoped role); the
 * Supabase email is the fallback while that loads.
 */
function ProfileChip({ email, onLogout }: { email?: string; onLogout: () => void }) {
    const [open, setOpen] = useState(false);
    const me = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
    const displayName = me.data?.name ?? email ?? 'Operator';
    const roleLabel = me.data?.orgRole ? (ROLE_LABELS[me.data.orgRole] ?? me.data.orgRole) : 'Facility Operator';

    return (
        <div className="relative border-t border-white/10 p-3">
            {open ? (
                <>
                    {/* click-away backdrop */}
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
                    <div className="absolute bottom-full left-3 right-3 z-20 mb-1 overflow-hidden rounded-lg border border-white/10 bg-olive-deep shadow-xl">
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
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
            >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rust/80 font-display text-sm font-bold text-canvas">
                    {(displayName || 'OP').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-bone-light">{displayName}</p>
                    <p className="truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-bone/40">{roleLabel}</p>
                </div>
                <Icon name="arrow" width={14} height={14} className={`-rotate-90 text-bone/40 ${open ? '' : 'opacity-60'}`} />
            </button>
        </div>
    );
}
