import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { CountdownTimer } from '../../components/CountdownTimer';
import { LayoutDashboard, AlertTriangle, ArrowRightCircle, PackageCheck, Box, RefreshCw } from 'lucide-react';
import { setAuthToken } from '../../lib/trpc';
import { Link } from 'react-router-dom';

// Temporarily hardcode an admin token for MVP testing since there's no login yet
const TEST_ADMIN_TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6ImJiNjJmODNiLTNjMTAtNDcxZC1iYTg5LWNjOGMzNWMxZDkxYSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NhcWt5aWlsdWJsdXR3dXN3dWxrLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJkN2NhNGZiMy1hYmFlLTQ4ZWItYTk4My0xM2M1ZTVmNzUxZTgiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzcyMDA4NDMyLCJpYXQiOjE3NzIwMDQ4MzIsImVtYWlsIjoiYWRtaW5AYmludHJhY2tlci5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYW1lIjoiU3lzdGVtIEFkbWluIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NzIwMDQ4MzJ9XSwic2Vzc2lvbl9pZCI6IjJhMmM2YzU5LWY2ZmQtNDFhNy1iNjc0LTU5MjM1YTkzYmQxYiIsImlzX2Fub255bW91cyI6ZmFsc2V9.X_X8hUrhcNGmF9zlQpTlWVbtj4GpSFBYCdzBrVbJ1R6aYbfQWtgzDTk6yFadTdyV2tBBZ_tIL2frazME0hZRKw";

export function DashboardPage() {
    const [selectedFacility, setSelectedFacility] = useState<string | undefined>(undefined);

    // Temporary auth injection for testing without login
    useState(() => {
        setAuthToken(TEST_ADMIN_TOKEN);
    });

    // Poll the active bins every 10 seconds for the priority queue
    const { data: activeBins, isLoading: isBinsLoading, refetch } = trpc.dashboard.priorityQueue.useQuery(
        { limit: 50 },
        { refetchInterval: 10000 }
    );

    const { data: stats } = trpc.dashboard.stats.useQuery();

    const handleManualRefresh = () => {
        refetch();
    };

    // Filter locally for now, since we fetch the queue globally
    const filteredBins = selectedFacility
        ? activeBins?.items.filter(item => item.facilityId === selectedFacility)
        : activeBins?.items;

    // Get unique facilities from the active bins for the dropdown filter
    const facilities = Array.from(new Set(activeBins?.items.map(item => item.facilityId) || []));

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">

            {/* Header Navbar */}
            <header className="bg-[#043F2E] text-white p-4 shadow-md sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-lg">
                            <LayoutDashboard className="w-6 h-6" />
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Ops Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/app/driver"
                            className="bg-white hover:bg-gray-100 text-[#043F2E] px-4 py-2 rounded-lg text-sm font-semibold transition-colors hidden md:block"
                        >
                            Driver
                        </Link>
                        <Link
                            to="/app/bin"
                            className="bg-white hover:bg-gray-100 text-[#043F2E] px-4 py-2 rounded-lg text-sm font-semibold transition-colors hidden md:block"
                        >
                            Bin
                        </Link>
                        <button
                            onClick={handleManualRefresh}
                            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span className="hidden md:inline">Refresh</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8">

                {/* Top Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Active Bins</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalActiveBins || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                            <Box className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Overdue</p>
                            <p className="text-3xl font-bold text-red-600 mt-2">{stats?.totalOverdue || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center relative">
                            {stats?.totalOverdue ? <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></span> : null}
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Completed Today</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalCompletedToday || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                            <PackageCheck className="w-6 h-6" />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Compliance Rate</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.complianceRate || 100}%</p>
                        </div>
                        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center tracking-tighter font-bold">
                            CR
                        </div>
                    </div>

                </div>

                {/* Main Table Section */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

                    <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            Priority Queue
                            <span className="bg-[#3d5aa8] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {filteredBins?.length || 0}
                            </span>
                        </h2>

                        <div className="flex items-center gap-3">
                            <label htmlFor="facility-filter" className="text-sm font-medium text-gray-600">Filter:</label>
                            <select
                                id="facility-filter"
                                value={selectedFacility || ''}
                                onChange={(e) => setSelectedFacility(e.target.value || undefined)}
                                className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-[#3d5aa8] focus:border-[#3d5aa8] p-2 pr-8"
                            >
                                <option value="">All Facilities</option>
                                {facilities.map(fid => (
                                    <option key={fid} value={fid}>{fid}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100 w-32">Countdown</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">Bin ID</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">Organ Type</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">Status</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">Facility / Location</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100">Started</th>
                                    <th className="p-4 font-semibold text-gray-600 text-sm border-b border-gray-100 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isBinsLoading ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500">
                                            <div className="flex items-center justify-center gap-3">
                                                <div className="w-6 h-6 border-4 border-[#3d5aa8] border-t-transparent rounded-full animate-spin"></div>
                                                Loading priority queue...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredBins && filteredBins.length > 0 ? (
                                    filteredBins.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4 align-middle">
                                                {item.status === 'COMPLETED' ? (
                                                    <span className="font-mono px-2 py-1 rounded inline-block min-w-[90px] text-center text-green-700 font-bold bg-green-50 ring-1 ring-inset ring-green-600/20">
                                                        DONE
                                                    </span>
                                                ) : (
                                                    <CountdownTimer
                                                        deadline={item.deadline}
                                                        isOverdue={item.isOverdue}
                                                    />
                                                )}
                                            </td>
                                            <td className="p-4 align-middle">
                                                <p className="font-semibold text-gray-900 truncate max-w-[150px]" title={item.bin.qrCode}>
                                                    {item.bin.qrCode}
                                                </p>
                                                <p className="text-xs text-gray-400 font-mono mt-0.5">#{item.id.slice(0, 8)}</p>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full 
                                                        ${item.bin.binType.urgency === 'CRITICAL' ? 'bg-red-500' : 'bg-green-500'}
                                                    `}></div>
                                                    <span className="capitalize font-medium text-gray-700">
                                                        {item.bin.binType.organType}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                                    ${item.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' :
                                                        item.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
                                                            item.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                                'bg-gray-100 text-gray-800'}`}>
                                                    {item.status === 'COMPLETED' ? 'delivered' : item.status.toLowerCase().replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle text-gray-600 text-sm font-medium">
                                                {/* In a real app we'd fetch the facility name, using ID as fallback */}
                                                {item.facilityId}
                                            </td>
                                            <td className="p-4 align-middle text-gray-500 text-sm">
                                                {new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <button className="text-[#3d5aa8] hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500 bg-gray-50/50">
                                            No active bins found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </main>
        </div>
    );
}

export default DashboardPage;
