import { Cog, LayoutDashboard, LogIn, Mic, Package, Snowflake, Truck, Utensils } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';

const navLinks = [
    { label: 'Main Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, href: '/app/facility' },
    { label: 'Receiving', icon: <LogIn className="w-5 h-5" />, href: '/app/facility/receiving' },
    { label: 'Kill Floor', icon: <Cog className="w-5 h-5" />, href: '/app/facility/killfloor' },
    { label: 'Processing', icon: <Utensils className="w-5 h-5" />, href: '#' },
    { label: 'Wet Aging', icon: <Snowflake className="w-5 h-5" />, href: '/app/facility/wetaging' },
    { label: 'Value Add', icon: <Package className="w-5 h-5" />, href: '/app/facility/valueadd' },
    { label: 'Shipping', icon: <Truck className="w-5 h-5" />, href: '#' },
];

export default function FacilityLayout() {
    const { pathname } = useLocation();

    function isActive(href: string) {
        if (href === '/app/facility') return pathname === '/app/facility';
        return pathname === href;
    }

    return (
        <div className="bg-[#fbf9f8] text-gray-900 font-sans antialiased min-h-screen">

            {/* Shared sidebar — sits below each page's fixed header */}
            <nav className="hidden md:flex fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-gray-50 border-r border-gray-200 flex-col p-4 z-40">
                <div className="mb-6 px-2">
                    <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">Facility Zones</span>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                    {navLinks.map((link) => (
                        <Link
                            key={link.label}
                            to={link.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                                isActive(link.href)
                                    ? 'bg-[#cee5da] text-[#374b43]'
                                    : link.label === 'Main Dashboard'
                                    ? 'bg-gray-200/60 text-gray-600 mb-1'
                                    : 'text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            {link.icon}
                            {link.label}
                        </Link>
                    ))}
                </div>
                <div className="border-t border-gray-200 pt-3">
                    <Link
                        to="/app/dashboard"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-500 hover:bg-gray-100 transition-all text-xs font-bold uppercase tracking-wider"
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Ops Dashboard
                    </Link>
                </div>
            </nav>

            {/* Content — offset to the right of sidebar on desktop */}
            <div className="md:ml-64">
                <Outlet />
            </div>

            {/* Desktop Mic FAB */}
            <button className="fixed bottom-8 right-6 hidden md:flex bg-[#5f5e5b] text-white w-16 h-16 rounded-2xl shadow-lg items-center justify-center hover:bg-gray-800 active:scale-95 transition-all z-50 border border-gray-400/30 group">
                <Mic className="w-6 h-6 group-hover:animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4e635a] opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4e635a]" />
                </span>
            </button>

            {/* Mobile bottom nav */}
            <nav className="fixed bottom-0 w-full z-50 bg-white/80 backdrop-blur-md border-t border-gray-200 flex justify-around items-center px-4 h-16 pb-2 md:hidden">
                <Link
                    to="/app/facility"
                    className="flex flex-col items-center justify-center text-gray-500 p-2 hover:text-[#5f5e5b] transition-colors active:scale-95"
                >
                    <Cog className="w-5 h-5" />
                    <span className="font-mono text-[10px] uppercase mt-1">Floor</span>
                </Link>
                <div className="relative -top-4">
                    <button className="flex flex-col items-center justify-center bg-[#5f5e5b] text-white rounded-full px-8 py-3 shadow-lg active:scale-95 transition-transform ring-4 ring-[#fbf9f8]">
                        <Mic className="w-5 h-5" />
                        <span className="font-mono text-[10px] uppercase mt-1">Butcher Talk</span>
                    </button>
                </div>
                <Link
                    to="/app/dashboard"
                    className="flex flex-col items-center justify-center text-gray-500 p-2 hover:text-[#5f5e5b] transition-colors active:scale-95"
                >
                    <LayoutDashboard className="w-5 h-5" />
                    <span className="font-mono text-[10px] uppercase mt-1">Back Office</span>
                </Link>
            </nav>
        </div>
    );
}
