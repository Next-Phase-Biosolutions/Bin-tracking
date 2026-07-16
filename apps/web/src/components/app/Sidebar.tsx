import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { Icon } from '../ui/Icon';
import { operationsNav, type NavItem } from '../../lib/nav';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';

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
    const { hasModule, isLoading: subscriptionLoading } = useSubscription();

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
                <NavGroup title="Operations" items={operationsNav} pathname={pathname} hasModule={hasModule} subscriptionLoading={subscriptionLoading} />
            </nav>

            <div className="border-t border-white/10 p-3">
                <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rust/80 font-display text-sm font-bold text-canvas">
                        {(user?.email ?? 'OP').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-bone-light">{user?.email ?? 'Operator'}</p>
                        <p className="truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-bone/40">Facility Operator</p>
                    </div>
                    <button
                        onClick={() => void logout()}
                        aria-label="Sign out"
                        className="rounded-md p-1.5 text-bone/50 transition-colors hover:bg-white/10 hover:text-rust-light"
                    >
                        <Icon name="logout" width={16} height={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
