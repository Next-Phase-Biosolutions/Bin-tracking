import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useSplashGate } from '../../lib/hooks';
import { FacilityLoader } from '../app/FacilityLoader';
import { Sidebar } from '../app/Sidebar';
import { TopBar } from '../app/TopBar';
import { MARKETING_URL } from '../../lib/marketingUrl';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function AppShellLayout() {
    const { user, loading } = useAuth();
    const [drawer, setDrawer] = useState(false);
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    const showSplash = useSplashGate(loading || !user);

    const toggleCollapsed = () => {
        setCollapsed((v) => {
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? '0' : '1');
            return !v;
        });
    };

    useEffect(() => {
        if (!loading && !user) window.location.href = `${MARKETING_URL}/login`;
    }, [loading, user]);

    if (loading || !user) {
        return showSplash ? <FacilityLoader variant="splash" /> : null;
    }

    return (
        <div className={`min-h-screen bg-canvas lg:grid ${collapsed ? 'lg:grid-cols-[4.25rem_1fr]' : 'lg:grid-cols-[16rem_1fr]'}`}>
            <aside className="sticky top-0 hidden h-screen lg:block">
                <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
            </aside>

            <AnimatePresence>
                {drawer && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setDrawer(false)}
                            className="fixed inset-0 z-40 bg-olive-deep/50 lg:hidden"
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'tween', duration: 0.25 }}
                            className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
                        >
                            <Sidebar onNavigate={() => setDrawer(false)} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            <div className="flex min-h-screen flex-col">
                <TopBar onMenu={() => setDrawer(true)} />
                <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
