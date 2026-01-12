"use client";

import { useEffect, useState, Fragment, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import Toast, { ToastType } from '@/components/ui/toast';
import {
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    LayoutGrid,
    Search,
    Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PaginationControls from '@/components/ui/PaginationControls';

interface RequestedSystem {
    id: number;
    system_display: string;
    hod_status: string;
    hod_comment: string;
    ict_status: string;
    ict_comment: string;
    sysadmin_status: string;
    sysadmin_comment: string;
    hod_decision_date?: string;
    ict_decision_date?: string;
}

interface AccessRequest {
    id: number;
    tsc_no: string;
    request_type: string;
    status: string;
    submitted_at: string;
    directorate_name: string;
    requester_details: {
        full_name: string;
        email: string;
        designation?: string;
    };
    requested_systems: RequestedSystem[];
}

interface DashboardStats {
    pending_systems: number;
    overdue_requests: number;
    reviewed_today: number;
    total_history: number;
    approved_history: number;
    rejected_history: number;
}

function HodDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Derive active tab and filters from URL
    const activeTab = searchParams?.get('tab') === 'history' ? 'history' : 'pending';
    const urlSearch = searchParams?.get('search') || '';
    const urlStartDate = searchParams?.get('start_date') || '';
    const urlEndDate = searchParams?.get('end_date') || '';

    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [loading, setLoading] = useState(false); // For background/manual operations
    const [isInitialLoading, setIsInitialLoading] = useState(true); // For first mount
    const [userName, setUserName] = useState('');
    const [userDirectorate, setUserDirectorate] = useState('');
    const [expandedRequest, setExpandedRequest] = useState<number | null>(null);

    // Local filter state (for inputs)
    const [searchTerm, setSearchTerm] = useState(urlSearch);
    const [startDate, setStartDate] = useState(urlStartDate);
    const [endDate, setEndDate] = useState(urlEndDate);

    // Pagination State
    const [nextUrl, setNextUrl] = useState<string | null>(null);
    const [prevUrl, setPrevUrl] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    // Decision State
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [rejectComment, setRejectComment] = useState('');
    const [rejectingSystemId, setRejectingSystemId] = useState<number | null>(null);

    // Stats State
    const [stats, setStats] = useState<DashboardStats>({
        pending_systems: 0,
        overdue_requests: 0,
        reviewed_today: 0,
        total_history: 0,
        approved_history: 0,
        rejected_history: 0
    });

    // Toast State
    const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
        message: '',
        type: 'info',
        isVisible: false
    });

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type, isVisible: true });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, isVisible: false }));
    };

    const fetchData = async (url: string | null = null, showLoading = true, signal?: AbortSignal) => {
        if (showLoading) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/';
                return;
            }

            const headers = { Authorization: `Token ${token}` };

            // Build Query
            const params = new URLSearchParams();
            params.set('tab', activeTab);
            if (urlSearch) params.set('search', urlSearch);
            if (urlStartDate) params.set('start_date', urlStartDate);
            if (urlEndDate) params.set('end_date', urlEndDate);

            let endpoint = `/approvals/?${params.toString()}`;
            if (url) {
                endpoint = url.startsWith('http') ? url : url;
            }

            // Pass signal to axios calls
            const [userRes, requestsRes, statsRes] = await Promise.all([
                api.get('/users/me/', { headers, signal }).catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    return { data: { first_name: 'HOD' } };
                }),
                api.get(endpoint, { headers, signal }).catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    console.error("Requests fetch failed", e);
                    return null;
                }),
                api.get('/approvals/stats/', { headers, signal }).catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    return { data: {} };
                })
            ]);

            const name = userRes.data.first_name || userRes.data.email?.split('@')[0] || 'HOD';
            setUserName(name);
            setUserDirectorate(userRes.data.directorate_name || '');

            // Handle Paginated Response
            if (requestsRes) {
                if (requestsRes.data.results) {
                    setRequests(requestsRes.data.results);
                    setNextUrl(requestsRes.data.next);
                    setPrevUrl(requestsRes.data.previous);
                    setCount(requestsRes.data.count);
                } else {
                    setRequests(requestsRes.data);
                    setCount(requestsRes.data.length);
                }
            }

            if (statsRes.data) setStats(statsRes.data);

        } catch (error: any) {
            if (error.name === 'CanceledError' || error.code === "ERR_CANCELED") {
                console.log("Request canceled");
                return; // Do nothing if canceled
            }
            console.error("Dashboard Load Error", error);
            if (error.response?.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/';
            }
        } finally {
            if (showLoading) setLoading(false);
            setIsInitialLoading(false);
        }
    };

    // Pagination Handler
    const handlePageChange = (url: string | null, direction: 'next' | 'prev') => {
        if (!url) return;
        fetchData(url);
        setCurrentPage(p => direction === 'next' ? p + 1 : p - 1);
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchData(null, true, controller.signal);

        // Sync local state
        setSearchTerm(urlSearch);
        setStartDate(urlStartDate);
        setEndDate(urlEndDate);

        const interval = setInterval(() => {
            // For polling, we don't abort the main controller, but we could use a separate one?
            // Actually, for simplicity, let's just let polling run without abort signal OR manage it carefully.
            // If we use the SAME controller, checking "aborted" might be tricky if we want to cancel on unmount only.
            // A better pattern:
            fetchData(null, false);
        }, 5000);

        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, [activeTab, urlSearch, urlStartDate, urlEndDate]);

    const handleTabChange = (tab: 'pending' | 'history') => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        // Clear filters on tab switch? Optional. Let's keep them logic-wise or clear them.
        // Usually clearing filters on major tab switch is better UX unless intention is to filter history.
        // For now, let's keep them to support "Search in History" flow.
        router.push(`/dashboard/hod?${params.toString()}`);
    };

    const handleSearch = () => {
        const params = new URLSearchParams(searchParams.toString());
        if (searchTerm) params.set('search', searchTerm);
        else params.delete('search');

        if (startDate) params.set('start_date', startDate);
        else params.delete('start_date');

        if (endDate) params.set('end_date', endDate);
        else params.delete('end_date');

        router.push(`/dashboard/hod?${params.toString()}`);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
        const params = new URLSearchParams();
        params.set('tab', activeTab);
        router.push(`/dashboard/hod?${params.toString()}`);
    };

    const handleDecision = async (requestId: number, systemId: number, action: 'approve' | 'reject', comment: string = '') => {
        setProcessingId(systemId);

        // Check pending count to determine if this is the final action
        const request = requests.find(r => r.id === requestId);
        const pendingCount = request?.requested_systems.filter(s => s.hod_status === 'pending').length || 0;
        const isLastSystem = pendingCount === 1;

        if (isLastSystem && action === 'approve') {
            showToast("Processing final approval & sending email...", "loading");
        }

        try {
            const token = localStorage.getItem('token');
            await api.post(`/approvals/${requestId}/decide/`, {
                system_id: systemId,
                action,
                comment
            }, { headers: { Authorization: `Token ${token}` } });

            await fetchData();
            setRejectingSystemId(null);
            setRejectComment('');

            if (isLastSystem && action === 'approve') {
                showToast("Request finalized and email notification sent.", "success");
            } else {
                showToast(`System ${action}d successfully.`, "success");
            }

        } catch (error) {
            console.error("Decision failed", error);
            showToast("Failed to process decision. Please try again.", "error");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-8 min-h-screen pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100">
                <div>
                    <h2 className="text-sm font-semibold text-tsc-gold uppercase tracking-wider mb-1">HOD Workspace &bull; {userDirectorate}</h2>
                    <h1 className="text-4xl font-extrabold text-[#2B3A67] tracking-tight">
                        {activeTab === 'pending' ? 'Pending Approvals' : 'Approval History'}
                    </h1>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => handleTabChange('pending')}
                        className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'pending' ? 'bg-white text-[#2B3A67] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Pending
                    </button>
                    <button
                        onClick={() => handleTabChange('history')}
                        className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white text-[#2B3A67] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        History
                    </button>
                </div>
            </div>



            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {activeTab === 'pending' ? (
                    <>
                        <div className="bg-gradient-to-br from-[#2B3A67] to-[#1e2a4a] rounded-2xl p-6 text-white shadow-xl shadow-[#2B3A67]/20 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Clock className="w-24 h-24 -mr-4 -mt-4" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Pending Requests</p>
                                <h3 className="text-4xl font-extrabold">{stats.pending_systems}</h3>
                                <p className="text-white/40 text-xs mt-2 font-medium">Awaiting your approval</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg shadow-slate-200/50 relative overflow-hidden group hover:border-red-100 transition-colors duration-300">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <AlertCircle className="w-24 h-24 text-red-500 -mr-4 -mt-4" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Overdue Requests</p>
                                <h3 className="text-4xl font-extrabold text-red-600">{stats.overdue_requests}</h3>
                                <p className="text-slate-400 text-xs mt-2 font-medium">Older than 3 days</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg shadow-slate-200/50 relative overflow-hidden group hover:border-green-100 transition-colors duration-300">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <CheckCircle className="w-24 h-24 text-green-500 -mr-4 -mt-4" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Reviewed Today</p>
                                <h3 className="text-4xl font-extrabold text-green-600">{stats.reviewed_today}</h3>
                                <p className="text-slate-400 text-xs mt-2 font-medium">Systems actioned by you</p>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg shadow-slate-200/50 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <LayoutGrid className="w-24 h-24 text-[#2B3A67] -mr-4 -mt-4" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Processed</p>
                                <h3 className="text-4xl font-extrabold text-[#2B3A67]">{stats.total_history}</h3>
                                <p className="text-slate-400 text-xs mt-2 font-medium">All time decisions</p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-6 border border-green-100 shadow-lg shadow-green-200/50 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <CheckCircle className="w-24 h-24 text-green-600 -mr-4 -mt-4" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-green-700/60 text-xs font-bold uppercase tracking-wider mb-1">Systems Approved</p>
                                <h3 className="text-4xl font-extrabold text-green-700">{stats.approved_history}</h3>
                                <p className="text-green-600/40 text-xs mt-2 font-medium">Granted access</p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-2xl p-6 border border-red-100 shadow-lg shadow-red-200/50 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <XCircle className="w-24 h-24 text-red-600 -mr-4 -mt-4" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-red-700/60 text-xs font-bold uppercase tracking-wider mb-1">Systems Denied</p>
                                <h3 className="text-4xl font-extrabold text-red-700">{stats.rejected_history}</h3>
                                <p className="text-red-600/40 text-xs mt-2 font-medium">Rejected requests</p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Filter Section */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-end lg:items-center">
                <div className="flex-1 w-full lg:w-auto">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Search</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search TSC No or Name..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-[#2B3A67]/20 focus:border-[#2B3A67] outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                </div>
                <div className="flex gap-4 w-full lg:w-auto">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Start Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:ring-2 focus:ring-[#2B3A67]/20 focus:border-[#2B3A67] outline-none"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">End Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:ring-2 focus:ring-[#2B3A67]/20 focus:border-[#2B3A67] outline-none"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex gap-2 w-full lg:w-auto mt-2 lg:mt-0">
                    <Button onClick={handleSearch} className="bg-[#2B3A67] text-white hover:bg-[#1e2a4a] flex-1 lg:flex-none">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                    </Button>
                    {(urlSearch || urlStartDate || urlEndDate) && (
                        <Button onClick={clearFilters} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 flex-1 lg:flex-none">
                            <XCircle className="h-4 w-4 mr-2" />
                            Clear
                        </Button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className={`transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                {isInitialLoading ? (
                    <div className="flex justify-center items-center py-20 min-h-[300px]">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2B3A67]"></div>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        {(urlSearch || urlStartDate || urlEndDate) ? (
                            <>
                                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Search className="h-10 w-10 text-slate-400" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">No records found</h3>
                                <p className="mt-2 text-slate-500">Try adjusting your search or filters to find what you're looking for.</p>
                                <Button variant="ghost" onClick={clearFilters} className="mt-2 text-[#2B3A67] hover:bg-slate-50">
                                    Clear Filters
                                </Button>
                            </>
                        ) : (
                            <>
                                <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle className="h-10 w-10 text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">All caught up!</h3>
                                <p className="mt-2 text-slate-500">No {activeTab} requests found for your directorate.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead>
                                    <tr className="bg-[#2B3A67] text-white">
                                        <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest opacity-90">Requested On</th>
                                        <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest opacity-90">Requester</th>
                                        <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest opacity-90">TSC No</th>
                                        <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest opacity-90">Pending Systems</th>
                                        <th className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest opacity-90">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {requests.map((req) => {
                                        const pendingCount = req.requested_systems.filter(s => s.hod_status === 'pending').length;
                                        return (
                                            <Fragment key={req.id}>
                                                <tr
                                                    onClick={() => setExpandedRequest(expandedRequest === req.id ? null : req.id)}
                                                    className={`cursor-pointer transition-all duration-200 group hover:bg-slate-50 ${expandedRequest === req.id ? 'bg-blue-50/50' : ''}`}
                                                >
                                                    <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-500">
                                                        {new Date(req.submitted_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-8 py-5 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-[#2B3A67]">{req.requester_details?.full_name}</span>
                                                            <span className="text-xs text-slate-400">{req.requester_details?.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 whitespace-nowrap text-sm font-mono text-slate-600">
                                                        {req.tsc_no}
                                                    </td>
                                                    <td className="px-8 py-5 whitespace-nowrap">
                                                        {pendingCount > 0 ? (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                                {pendingCount} Pending
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                Review Complete
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-[#2B3A67]">
                                                        {expandedRequest === req.id ? 'Close' : 'Review'}
                                                    </td>
                                                </tr>

                                                {/* Expanded Content */}
                                                {expandedRequest === req.id && (
                                                    <tr className="bg-slate-50/50">
                                                        <td colSpan={5} className="px-8 py-6">
                                                            <motion.div
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                className="grid grid-cols-1 gap-4"
                                                            >
                                                                {req.requested_systems.map(sys => (
                                                                    <div key={sys.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                                                                <LayoutGrid className="h-5 w-5 text-slate-500" />
                                                                            </div>
                                                                            <div>
                                                                                <h4 className="font-bold text-slate-900">{sys.system_display}</h4>
                                                                                <div className="flex items-center gap-2 mt-1">
                                                                                    <span className={`text-xs font-bold uppercase tracking-wide
                                                                                        ${sys.hod_status === 'approved' ? 'text-green-600' :
                                                                                            sys.hod_status === 'rejected' ? 'text-red-600' : 'text-amber-600'}
                                                                                    `}>
                                                                                        {sys.hod_status}
                                                                                    </span>
                                                                                    {sys.hod_decision_date && (
                                                                                        <span className="text-xs text-slate-400">
                                                                                            &bull; {new Date().toLocaleDateString()}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Action Buttons */}
                                                                        {activeTab === 'pending' && sys.hod_status === 'pending' && (
                                                                            <div className="flex items-center gap-3 w-full md:w-auto">
                                                                                {rejectingSystemId === sys.id ? (
                                                                                    <div className="flex items-center gap-2 w-full animate-fadeIn">
                                                                                        <input
                                                                                            type="text"
                                                                                            placeholder="Reason for rejection..."
                                                                                            className="flex-1 text-sm border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                                                                                            value={rejectComment}
                                                                                            onChange={e => setRejectComment(e.target.value)}
                                                                                            autoFocus
                                                                                        />
                                                                                        <Button
                                                                                            size="sm"
                                                                                            className="bg-red-600 hover:bg-red-700 text-white"
                                                                                            onClick={() => handleDecision(req.id, sys.id, 'reject', rejectComment)}
                                                                                            disabled={processingId === sys.id || !rejectComment.trim()}
                                                                                        >
                                                                                            Confirm
                                                                                        </Button>
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="ghost"
                                                                                            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                                                                            onClick={() => { setRejectingSystemId(null); setRejectComment(''); }}
                                                                                        >
                                                                                            Cancel
                                                                                        </Button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <>
                                                                                        <Button
                                                                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                                                                            onClick={() => handleDecision(req.id, sys.id, 'approve')}
                                                                                            disabled={processingId === sys.id}
                                                                                        >
                                                                                            {processingId === sys.id ? 'Processing...' : 'Approve'}
                                                                                        </Button>
                                                                                        <Button
                                                                                            className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-sm"
                                                                                            onClick={() => setRejectingSystemId(sys.id)}
                                                                                            disabled={processingId === sys.id}
                                                                                        >
                                                                                            Reject
                                                                                        </Button>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </motion.div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <PaginationControls
                currentPage={currentPage}
                count={count}
                nextUrl={nextUrl}
                prevUrl={prevUrl}
                loading={loading}
                onPageChange={handlePageChange}
            />

            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={hideToast}
            />
        </div >
    );
}

export default function HodDashboard() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading HOD Workspace...</div>}>
            <HodDashboardContent />
        </Suspense>
    );
}
