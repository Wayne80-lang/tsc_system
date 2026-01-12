"use client";

import { useEffect, useState, Fragment, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import {
    CheckCircle, XCircle, Search,
    ChevronRight, AlertCircle, LayoutGrid, HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Toast, { ToastType } from '@/components/ui/toast';
import PaginationControls from '@/components/ui/PaginationControls';

interface RequestedSystem {
    id: number;
    system: string;
    system_display: string;
    level_of_access: string;
    hod_status: string;
    ict_status: string;
    sysadmin_status: string;
    sysadmin_comment: string;
}

interface AccessRequest {
    id: number;
    tsc_no: string;
    requester_name: string;
    email: string;
    directorate: string;
    directorate_name?: string;
    designation: string;
    status: string;
    submitted_at: string;
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

function SysAdminDashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const activeTab = searchParams.get('tab') || 'pending';
    const urlSearch = searchParams.get('search') || '';
    const urlStartDate = searchParams.get('start_date') || '';
    const urlEndDate = searchParams.get('end_date') || '';

    const [searchTerm, setSearchTerm] = useState(urlSearch);
    const [startDate, setStartDate] = useState(urlStartDate);
    const [endDate, setEndDate] = useState(urlEndDate);

    // Pagination State
    const [nextUrl, setNextUrl] = useState<string | null>(null);
    const [prevUrl, setPrevUrl] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [activeSystems, setActiveSystems] = useState<any[]>([]);
    const [userName, setUserName] = useState('');
    const [assignedSystem, setAssignedSystem] = useState<string>('');
    const [assignedSystemName, setAssignedSystemName] = useState<string>('');

    const [stats, setStats] = useState<DashboardStats>({
        pending_systems: 0, overdue_requests: 0, reviewed_today: 0,
        total_history: 0, approved_history: 0, rejected_history: 0
    });

    const [loading, setLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    const [processingId, setProcessingId] = useState<number | null>(null);
    const [rejectComment, setRejectComment] = useState('');
    const [rejectingSystemId, setRejectingSystemId] = useState<number | null>(null);

    const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
        message: '', type: 'info', isVisible: false
    });

    const showToast = (message: string, type: ToastType) => setToast({ message, type, isVisible: true });
    const hideToast = () => setToast(prev => ({ ...prev, isVisible: false }));

    const fetchData = async (url: string | null = null, showLoading = true, signal?: AbortSignal) => {
        if (showLoading) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) return router.push('/');

            const headers = { Authorization: `Token ${token}` };
            const params = new URLSearchParams();
            params.set('tab', activeTab);
            if (urlSearch) params.set('search', urlSearch);
            if (urlStartDate) params.set('start_date', urlStartDate);
            if (urlEndDate) params.set('end_date', urlEndDate);

            // Determine endpoint base based on tab, or use provided url
            let approvalsUrl = `/approvals/?${params.toString()}`;
            let systemsUrl = `/systems/?status=approved`; // simplified for manage tab

            if (url) {
                // If url is provided, it applies to the currently active list
                if (activeTab === 'manage') {
                    systemsUrl = url.startsWith('http') ? url : url;
                } else {
                    approvalsUrl = url.startsWith('http') ? url : url;
                }
            }

            const [userRes, requestsRes, activeRes, statsRes] = await Promise.all([
                api.get('/users/me/', { headers, signal }).catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    return { data: { first_name: 'System Admin' } };
                }),
                api.get(approvalsUrl, { headers, signal }).catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    console.error("Requests fetch failed", e);
                    return null;
                }),
                activeTab === 'manage' ? api.get(systemsUrl, { headers, signal }).catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    return null;
                }) : Promise.resolve({ data: [] }),
                api.get('/approvals/stats/', { headers, signal }).catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    return { data: {} };
                })
            ]);

            const name = userRes.data.first_name || userRes.data.email?.split('@')[0] || 'System Admin';
            setUserName(name);
            setAssignedSystem(userRes.data.system_assigned || '');
            setAssignedSystemName(userRes.data.system_assigned_name || '');

            // Handle Pagination Data based on Active Tab
            if (activeTab === 'manage') {
                if (activeRes) {
                    if (activeRes.data.results) {
                        setActiveSystems(activeRes.data.results);
                        setNextUrl(activeRes.data.next);
                        setPrevUrl(activeRes.data.previous);
                        setCount(activeRes.data.count);
                    } else {
                        setActiveSystems(activeRes.data);
                        setCount(activeRes.data.length);
                    }
                }
                // Update requests if available, though strict separation might be better?
                // For now, keep existing logic but guarded
                if (requestsRes) setRequests(requestsRes.data.results || requestsRes.data);
            } else {
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
                if (activeRes && activeRes.data) setActiveSystems(activeRes.data.results || activeRes.data);
            }

            if (statsRes.data) setStats(statsRes.data);

        } catch (error: any) {
            if (error.name === 'CanceledError' || error.code === "ERR_CANCELED") return;
            console.error("Error", error);
            if (error.response?.status === 401) router.push('/');
            showToast("Failed to load data.", "error");
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
        setSearchTerm(urlSearch); setStartDate(urlStartDate); setEndDate(urlEndDate);

        const interval = setInterval(() => fetchData(null, false), 5000);
        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, [activeTab, urlSearch, urlStartDate, urlEndDate]);

    const handleTabChange = (tab: 'pending' | 'history' | 'manage') => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`/dashboard/sysadmin?${params.toString()}`);
    };

    const handleSearch = () => {
        const params = new URLSearchParams(searchParams.toString());
        if (searchTerm) params.set('search', searchTerm); else params.delete('search');
        if (startDate) params.set('start_date', startDate); else params.delete('start_date');
        if (endDate) params.set('end_date', endDate); else params.delete('end_date');
        router.push(`/dashboard/sysadmin?${params.toString()}`);
    };

    const clearFilters = () => {
        setSearchTerm(''); setStartDate(''); setEndDate('');
        const params = new URLSearchParams(); params.set('tab', activeTab);
        router.push(`/dashboard/sysadmin?${params.toString()}`);
    };

    const handleDecision = async (reqId: number, systemId: number, action: 'approve' | 'reject') => {
        if (action === 'reject' && !rejectingSystemId) {
            setRejectingSystemId(systemId); return;
        }

        const token = localStorage.getItem('token');
        setProcessingId(systemId);
        showToast(`Processing ${action}...`, "loading");

        try {
            await api.post(`/approvals/${reqId}/decide/`, {
                system_id: systemId,
                action: action,
                comment: action === 'reject' ? rejectComment : 'System Provisioned'
            }, { headers: { Authorization: `Token ${token}` } });

            await fetchData();
            setRejectingSystemId(null); setRejectComment('');
            showToast(`System ${action}d successfully.`, "success");
        } catch (error) {
            showToast("Failed to process decision.", "error");
        } finally {
            setProcessingId(null);
        }
    };

    const handleRevoke = async (systemId: number) => {
        if (!window.confirm("Are you sure you want to revoke access? This action is immediate.")) return;

        const comment = prompt("Reason for revocation (mandatory):");
        if (!comment) return;

        setProcessingId(systemId);
        showToast("Revoking access...", "loading");

        try {
            await api.post(`/systems/${systemId}/revoke/`, { comment }, {
                headers: { Authorization: `Token ${localStorage.getItem('token')}` }
            });
            showToast("Access revoked successfully.", "success");
            fetchData();
        } catch (error) {
            showToast("Failed to revoke access.", "error");
        } finally {
            setProcessingId(null);
        }
    };

    const toggleRow = (id: number) => setExpandedRow(expandedRow === id ? null : id);


    // Helper to filter systems relevant to this admin
    const getVisibleSystems = (req: AccessRequest) => {
        return req.requested_systems.filter(s => {
            // 1. Must match assigned system if set
            // Ensure both are treated as strings for comparison
            if (assignedSystem && String(s.system) !== String(assignedSystem)) return false;

            // 2. Tab logic
            if (activeTab === 'pending') {
                return s.sysadmin_status === 'pending';
            } else {
                return s.sysadmin_status !== 'pending';
            }
        });
    };

    return (
        <div className="space-y-8 min-h-screen pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100">
                <div>
                    <h2 className="text-sm font-semibold text-tsc-gold uppercase tracking-wider mb-1">System Administration</h2>
                    <h1 className="text-4xl font-extrabold text-[#2B3A67] tracking-tight">
                        {assignedSystemName ? assignedSystemName : 'System Admin'} Workspace
                    </h1>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => handleTabChange('pending')} className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'pending' ? 'bg-white text-[#2B3A67] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Pending Provisioning</button>
                    <button onClick={() => handleTabChange('history')} className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white text-[#2B3A67] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>History</button>
                    <button onClick={() => handleTabChange('manage')} className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'manage' ? 'bg-white text-[#2B3A67] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Manage Access</button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {activeTab === 'pending' ? (
                    <>
                        <div className="bg-gradient-to-br from-[#2B3A67] to-[#1e2a4a] rounded-2xl p-6 text-white shadow-xl shadow-[#2B3A67]/20 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><HardDrive className="w-24 h-24 -mr-4 -mt-4" /></div>
                            <div className="relative z-10">
                                <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Pending Provisioning</p>
                                <h3 className="text-4xl font-extrabold">{stats.pending_systems}</h3>
                                <p className="text-white/40 text-xs mt-2 font-medium">Ready for setup</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg shadow-slate-200/50 relative overflow-hidden group hover:border-red-100 transition-colors duration-300">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><AlertCircle className="w-24 h-24 text-red-500 -mr-4 -mt-4" /></div>
                            <div className="relative z-10">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Overdue</p>
                                <h3 className="text-4xl font-extrabold text-red-600">{stats.overdue_requests}</h3>
                                <p className="text-slate-400 text-xs mt-2 font-medium">&gt; 3 days pending</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg shadow-slate-200/50 relative overflow-hidden group hover:border-green-100 transition-colors duration-300">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><CheckCircle className="w-24 h-24 text-green-500 -mr-4 -mt-4" /></div>
                            <div className="relative z-10">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Provisioned Today</p>
                                <h3 className="text-4xl font-extrabold text-green-600">{stats.reviewed_today}</h3>
                                <p className="text-slate-400 text-xs mt-2 font-medium">Systems enabled</p>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-lg shadow-slate-200/50 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><LayoutGrid className="w-24 h-24 text-[#2B3A67] -mr-4 -mt-4" /></div>
                            <div className="relative z-10">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Processed</p>
                                <h3 className="text-4xl font-extrabold text-[#2B3A67]">{stats.total_history}</h3>
                                <p className="text-slate-400 text-xs mt-2 font-medium">Lifetime stats</p>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-6 border border-green-100 shadow-lg shadow-green-200/50 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle className="w-24 h-24 text-green-600 -mr-4 -mt-4" /></div>
                            <div className="relative z-10">
                                <p className="text-green-700/60 text-xs font-bold uppercase tracking-wider mb-1">Provisioned</p>
                                <h3 className="text-4xl font-extrabold text-green-700">{stats.approved_history}</h3>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-2xl p-6 border border-red-100 shadow-lg shadow-red-200/50 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><XCircle className="w-24 h-24 text-red-600 -mr-4 -mt-4" /></div>
                            <div className="relative z-10">
                                <p className="text-red-700/60 text-xs font-bold uppercase tracking-wider mb-1">Rejected</p>
                                <h3 className="text-4xl font-extrabold text-red-700">{stats.rejected_history}</h3>
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
                        <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#2B3A67]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                    </div>
                </div>
                <div className="flex gap-2 items-end">
                    <Button onClick={handleSearch} className="bg-[#2B3A67] text-white">Filter</Button>
                    {(urlSearch || urlStartDate || urlEndDate) && <Button variant="ghost" onClick={clearFilters}>Clear</Button>}
                </div>
            </div>

            {/* Content Area */}
            <div className={`transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                {isInitialLoading ? (
                    <div className="flex justify-center items-center py-20 min-h-[300px]">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2B3A67]"></div>
                    </div>
                ) : requests.length === 0 && !loading && activeTab !== 'manage' ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        {(urlSearch || urlStartDate || urlEndDate) ? (
                            <>
                                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Search className="h-10 w-10 text-slate-400" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">No records found</h3>
                                <p className="mt-2 text-slate-500">Try adjusting your search or filters.</p>
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
                                <p className="mt-2 text-slate-500">No pending tasks found for your assigned system.</p>
                            </>
                        )}
                    </div>
                ) : activeTab === 'manage' ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-[#2B3A67]">Active Users - {assignedSystemName}</h3>
                            <p className="text-sm text-slate-500">Users with currently active access to this system.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Requester</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">TSC No</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Granted Date</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Access Level</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {activeSystems.map((sys: any) => (
                                        <tr key={sys.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-[#2B3A67]">{sys.requester_name || 'Unknown'}</div>
                                                <div className="text-xs text-slate-500">{sys.requester_email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                                                {sys.requester_tsc || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {new Date(sys.sysadmin_decision_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                                                    {sys.level_of_access || 'Standard'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <Button
                                                    size="sm"
                                                    className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                                                    onClick={() => handleRevoke(sys.id)}
                                                    disabled={processingId === sys.id}
                                                >
                                                    {processingId === sys.id ? 'Revoking...' : 'Revoke Access'}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {activeSystems.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-slate-500">No active users found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Requester</th>
                                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Directorate</th>
                                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                        <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Systems</th>
                                        <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {requests.map((req) => {
                                        const visibleSystems = getVisibleSystems(req);
                                        if (visibleSystems.length === 0) return null;

                                        return (
                                            <Fragment key={req.id}>
                                                <tr
                                                    onClick={() => toggleRow(req.id)}
                                                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="h-10 w-10 flex-shrink-0 bg-gradient-to-br from-[#2B3A67] to-[#1e2a4a] text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md">
                                                                {(req.requester_name || 'U').charAt(0)}
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="text-sm font-bold text-[#2B3A67]">{req.requester_name || 'Unknown User'}</div>
                                                                <div className="text-xs text-slate-500">{req.email}</div>
                                                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">{req.tsc_no}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                            {req.directorate_name || req.directorate || '-'}
                                                        </span>
                                                        <div className="text-xs text-slate-400 mt-1 pl-1">{req.designation}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                        {new Date(req.submitted_at).toLocaleDateString()}
                                                        <div className="text-xs text-slate-400">{new Date(req.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex -space-x-2 overflow-hidden">
                                                            {visibleSystems.slice(0, 3).map((sys, idx) => (
                                                                <div key={idx} className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-white text-[10px] font-bold ${sys.sysadmin_status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`} title={sys.system_display}>
                                                                    {sys.system_display.substring(0, 2)}
                                                                </div>
                                                            ))}
                                                            {visibleSystems.length > 3 && (
                                                                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2B3A67] ring-2 ring-white text-[10px] font-bold text-white">
                                                                    +{visibleSystems.length - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-1.5 font-medium">
                                                            {visibleSystems.length} System(s) Requested
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <ChevronRight className={`ml-auto h-5 w-5 text-slate-400 transition-transform duration-300 ${expandedRow === req.id ? 'rotate-90' : ''}`} />
                                                    </td>
                                                </tr>

                                                {/* Expanded Details Row */}
                                                <AnimatePresence>
                                                    {expandedRow === req.id && (
                                                        <tr>
                                                            <td colSpan={5} className="px-0 py-0 border-t border-slate-100 bg-slate-50/30">
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                                                    className="overflow-hidden"
                                                                >
                                                                    <div className="p-6 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                                                        {visibleSystems.map(system => (
                                                                            <div key={system.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow ${system.sysadmin_status === 'pending' ? 'border-[#2B3A67]/20 ring-1 ring-[#2B3A67]/10' : 'border-slate-200'}`}>
                                                                                <div className="flex justify-between items-start mb-3">
                                                                                    <div>
                                                                                        <h4 className="font-bold text-[#2B3A67] flex items-center gap-2">
                                                                                            {system.system_display}
                                                                                            {system.level_of_access && (
                                                                                                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">{system.level_of_access}</span>
                                                                                            )}
                                                                                        </h4>
                                                                                        <p className="text-xs text-slate-500 mt-1">ICT Status: <span className={`${system.ict_status === 'approved' ? 'text-green-600' : 'text-slate-500'} font-medium`}>{system.ict_status.toUpperCase()}</span></p>
                                                                                    </div>
                                                                                    {activeTab === 'pending' && (
                                                                                        <div className={`h-2 w-2 rounded-full ${system.sysadmin_status === 'pending' ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'}`} />
                                                                                    )}
                                                                                </div>

                                                                                {activeTab === 'pending' && system.sysadmin_status === 'pending' ? (
                                                                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                                                                        {rejectingSystemId === system.id ? (
                                                                                            <div className="space-y-3">
                                                                                                <textarea
                                                                                                    placeholder="Reason for rejection..."
                                                                                                    className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-slate-900 placeholder:text-slate-400"
                                                                                                    rows={2}
                                                                                                    value={rejectComment}
                                                                                                    onChange={(e) => setRejectComment(e.target.value)}
                                                                                                    autoFocus
                                                                                                />
                                                                                                <div className="flex gap-2 justify-end">
                                                                                                    <Button
                                                                                                        variant="ghost"
                                                                                                        size="sm"
                                                                                                        onClick={() => { setRejectingSystemId(null); setRejectComment(''); }}
                                                                                                        className="text-slate-500 hover:text-slate-700"
                                                                                                    >
                                                                                                        Cancel
                                                                                                    </Button>
                                                                                                    <Button
                                                                                                        size="sm"
                                                                                                        className="bg-red-600 hover:bg-red-700 text-white"
                                                                                                        onClick={() => handleDecision(req.id, system.id, 'reject')}
                                                                                                        disabled={!rejectComment.trim() || processingId === system.id}
                                                                                                    >
                                                                                                        Confirm Reject
                                                                                                    </Button>
                                                                                                </div>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="flex gap-2">
                                                                                                <Button
                                                                                                    className="flex-1 bg-[#2B3A67] hover:bg-[#1e2a4a] text-white shadow-lg shadow-[#2B3A67]/20"
                                                                                                    onClick={() => handleDecision(req.id, system.id, 'approve')}
                                                                                                    disabled={processingId !== null}
                                                                                                >
                                                                                                    {processingId === system.id ? 'Processing...' : 'Provision Access'}
                                                                                                </Button>
                                                                                                <Button
                                                                                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20"
                                                                                                    onClick={() => { setRejectingSystemId(system.id) }}
                                                                                                    disabled={processingId !== null}
                                                                                                >
                                                                                                    Reject
                                                                                                </Button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="mt-4 pt-3 border-t border-slate-100">
                                                                                        <div className="flex justify-between text-xs">
                                                                                            <span className="text-slate-500">Status</span>
                                                                                            <span className={`font-bold ${system.sysadmin_status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                                                                                                {system.sysadmin_status.toUpperCase()}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </motion.div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </AnimatePresence>
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <PaginationControls
                    currentPage={currentPage}
                    count={count}
                    nextUrl={nextUrl}
                    prevUrl={prevUrl}
                    loading={loading}
                    onPageChange={handlePageChange}
                />
            </div>

            <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />
        </div >
    );
}

export default function SysAdminDashboard() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading System Admin Workspace...</div>}>
            <SysAdminDashboardContent />
        </Suspense>
    );
}
