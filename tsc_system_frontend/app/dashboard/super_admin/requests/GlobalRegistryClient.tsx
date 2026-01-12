"use client";

import { useState, useEffect, Fragment, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import api from '@/lib/api';
import { ChevronDown, ChevronRight, Search, Filter, Clock, XCircle, Shield } from 'lucide-react';
import { AccessRequest } from '@/types';
import Toast, { ToastType } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';

export default function GlobalRegistryClient() {
    const router = useRouter();

    // State
    const [loading, setLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [filteredRequests, setFilteredRequests] = useState<AccessRequest[]>([]);

    // Stats State
    const [stats, setStats] = useState({
        pending_systems: 0,
        reviewed_today: 0,
        total_history: 0,
        approved_history: 0,
        rejected_history: 0,
        overdue_requests: 0
    });

    // Pagination State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [nextUrl, setNextUrl] = useState<string | null>(null);
    const [prevUrl, setPrevUrl] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    // Expanded Rows
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const toggleRow = (id: number) => setExpandedRow(expandedRow === id ? null : id);

    // Toast State
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

            // Allow Unified View via tab=all (supported by backend now)
            // If url is provided (next/prev), use it. Otherwise default to tab=all
            let endpoint = url;
            if (!endpoint) {
                endpoint = '/approvals/?tab=all';
            }
            // Append search/filter params if not using direct URL (which usually includes them, but be safe)
            if (!url) {
                const params = new URLSearchParams();
                params.set('tab', 'all');
                // Note: Frontend filtering currently used (lines 112+), so we might just fetch 'all' and filter locally?
                // The current code fetches all (?) orpaginated?
                // Line 73 was: endpoint = '/approvals/?tab=all';
                // Backend 'all' returns distinct requests.
            }

            let requestUrl = url;
            if (url && !url.includes('tab=')) {
                requestUrl = url.includes('?') ? `${url}&tab=all` : `${url}?tab=all`;
            }

            let fetchRequests;
            if (requestUrl) {
                if (requestUrl.startsWith('http')) {
                    fetchRequests = axios.get(requestUrl, { headers });
                } else {
                    // Handle relative path (strip /api if present as api client adds it)
                    let path = requestUrl;
                    if (path.startsWith('/api')) path = path.substring(4);
                    fetchRequests = api.get(path, { headers });
                }
            } else {
                fetchRequests = api.get(endpoint || '/approvals/?tab=all', { headers });
            }

            const [requestsRes, statsRes] = await Promise.all([
                fetchRequests.catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    console.error("Requests fetch failed", e);
                    return null;
                }),
                api.get('/approvals/stats/', { headers, signal }).catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    return null;
                })
            ]);

            if (requestsRes) {
                if (requestsRes.data.results) {
                    setRequests(requestsRes.data.results);
                    // Filter Logic dependency? 
                    // The useEffect [requests] will trigger and re-apply filters. This is fine.
                    setFilteredRequests(requestsRes.data.results);
                    console.log("Pagination Debug:", { next: requestsRes.data.next, prev: requestsRes.data.previous, count: requestsRes.data.count });
                    setNextUrl(requestsRes.data.next);
                    setPrevUrl(requestsRes.data.previous);
                    setCount(requestsRes.data.count);
                } else {
                    setRequests(requestsRes.data);
                    setFilteredRequests(requestsRes.data);
                }
            }

            if (statsRes && statsRes.data) {
                setStats(statsRes.data);
            }

        } catch (error: any) {
            if (error.name === 'CanceledError' || error.code === "ERR_CANCELED") return;
            console.error("Error", error);
            if (error.response?.status === 401) router.push('/');
            showToast("Failed to connect to server.", "error");
        } finally {
            if (showLoading) setLoading(false);
            setIsInitialLoading(false);
        }
    };

    // Helper for pagination click
    const handlePageChange = (url: string | null, direction: 'next' | 'prev') => {
        let targetUrl = url;
        if (!targetUrl) {
            // Synthesized fallback if API link is missing but logic works
            if (direction === 'next') targetUrl = `/approvals/?page=${currentPage + 1}&tab=all`;
            if (direction === 'prev') targetUrl = currentPage - 1 === 1 ? '/approvals/?tab=all' : `/approvals/?page=${currentPage - 1}&tab=all`;
        }

        if (!targetUrl) return;
        fetchData(targetUrl);
        setCurrentPage(p => direction === 'next' ? p + 1 : p - 1);
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchData(null, true, controller.signal);

        const interval = setInterval(() => fetchData(null, false), 5000);
        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, []);

    // Filter Logic
    useEffect(() => {
        let result = requests;

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(req =>
                req.requester_name.toLowerCase().includes(lowerTerm) ||
                req.tsc_no?.toLowerCase().includes(lowerTerm) ||
                req.directorate_name?.toLowerCase().includes(lowerTerm) ||
                req.id.toString().includes(lowerTerm)
            );
        }

        if (statusFilter !== 'all') {
            result = result.filter(req => {
                const sysStatuses = req.requested_systems.map(s => s.sysadmin_status);
                if (statusFilter === 'pending') return sysStatuses.some(s => s === 'pending');
                if (statusFilter === 'approved') return sysStatuses.every(s => s === 'approved');
                if (statusFilter === 'rejected') return sysStatuses.every(s => s === 'rejected');
                return true;
            });
        }

        setFilteredRequests(result);
    }, [searchTerm, statusFilter, requests]);

    const handleOverride = async (requestId: number, systemId: number, action: 'approve' | 'reject', stageName: string) => {
        const actionText = action === 'approve' ? `APPROVE (as ${stageName})` : 'REJECT';
        if (!confirm(`Confirm Action: \nAre you sure you want to ${actionText}?\nThis will act on behalf of the current approver.`)) return;

        try {
            const token = localStorage.getItem('token');
            await api.post(`/approvals/${requestId}/decide/`, {
                system_id: systemId,
                action: action,
                comment: `Super Admin acting as ${stageName}`
            }, {
                headers: { Authorization: `Token ${token}` }
            });

            showToast(`Action successful: System ${action}d.`, 'success');
            fetchData();
        } catch (error) {
            console.error("Override failed", error);
            showToast("Failed to override decision.", "error");
        }
    };

    return (
        <div className="min-h-screen pb-20">
            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                        <h2 className="text-xs font-bold text-tsc-gold uppercase tracking-[0.2em] mb-2">Global Registry</h2>
                        <h1 className="text-3xl font-black text-[#1e2a4a]">Command Center</h1>
                        <p className="text-slate-500">Unified view of all access requests and overriding capabilities.</p>
                    </div>
                    {/* Stats Summary REMOVED */}
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 mb-6 sticky top-4 z-20">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by Name, TSC No, Directorate..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-tsc-blue/20 transition-all font-outfit"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative min-w-[200px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                        className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tsc-blue/20 appearance-none font-outfit text-slate-600"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Active</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Unified Table */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#1e2a4a] text-white">
                        <tr>
                            <th className="p-4 font-semibold text-sm w-20">ID</th>
                            <th className="p-4 font-semibold text-sm">Requester</th>
                            <th className="p-4 font-semibold text-sm">Directorate</th>
                            <th className="p-4 font-semibold text-sm">Systems Overview</th>
                            <th className="p-4 font-semibold text-sm text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isInitialLoading ? (
                            <tr><td colSpan={5} className="p-12 text-center text-slate-500">
                                <div className="flex justify-center items-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e2a4a]"></div>
                                </div>
                            </td></tr>
                        ) : filteredRequests.length === 0 && !loading ? (
                            <tr><td colSpan={5} className="p-12 text-center text-slate-500">No requests found.</td></tr>
                        ) : filteredRequests.map(req => (
                            <Fragment key={req.id}>
                                <tr
                                    onClick={() => toggleRow(req.id)}
                                    className={`hover:bg-slate-50 transition-colors cursor-pointer border-l-4 ${expandedRow === req.id ? 'border-tsc-gold bg-slate-50' : 'border-transparent'}`}
                                >
                                    <td className="p-4 font-mono text-xs text-slate-500 font-bold">#{req.id}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                                                {(req.requester_name || 'U').charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-[#2B3A67] text-sm">{req.requester_name}</div>
                                                <div className="text-xs text-slate-500 font-mono">{req.tsc_no}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-slate-700">{req.directorate_name || '-'}</td>
                                    <td className="p-4">
                                        <div className="flex -space-x-1 overflow-hidden py-1">
                                            {req.requested_systems.map((sys: any, i) => (
                                                <div
                                                    key={i}
                                                    className={`
                                                        relative inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-white text-[10px] font-bold shadow-sm transition-transform hover:scale-110 hover:z-10
                                                        ${sys.is_overdue ? 'ring-2 ring-red-500 z-10' : ''}
                                                        ${sys.sysadmin_status === 'approved' ? 'bg-green-100 text-green-700' :
                                                            sys.sysadmin_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                                'bg-slate-100 text-slate-600'}
                                                    `}
                                                    title={`${sys.system_display} - ${sys.current_stage || sys.sysadmin_status}`}
                                                >
                                                    {sys.system_display.substring(0, 2)}
                                                    {sys.is_overdue && (
                                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className={`p-2 rounded-full transition-transform duration-300 ${expandedRow === req.id ? 'rotate-180 bg-slate-200' : 'hover:bg-slate-100'}`}>
                                            <ChevronDown className="w-5 h-5 text-slate-500" />
                                        </button>
                                    </td>
                                </tr>

                                {/* Detailed View */}
                                <AnimatePresence>
                                    {expandedRow === req.id && (
                                        <tr>
                                            <td colSpan={5} className="p-0 border-t border-slate-100 bg-slate-50/50">
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="p-6 grid grid-cols-1 gap-4">
                                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">System Status Breakdown</h4>

                                                        {req.requested_systems.map((sys: any) => (
                                                            <div key={sys.id} className="bg-white border border-l-4 rounded-lg p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <h5 className="font-bold text-[#1e2a4a]">{sys.system_display}</h5>
                                                                        {sys.is_overdue && (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-full border border-red-100">
                                                                                <Clock className="w-3 h-3" /> Overdue ({sys.days_open} days)
                                                                            </span>
                                                                        )}
                                                                        {sys.current_stage === 'Active' && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">Active</span>}
                                                                        {sys.current_stage === 'Rejected' && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">Rejected</span>}
                                                                        {sys.current_stage?.startsWith('Stage') && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">{sys.current_stage}</span>}
                                                                    </div>

                                                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                                                        <span>Pending: <span className="font-medium text-slate-700">{sys.pending_approver || 'None'}</span></span>
                                                                        <span className="text-slate-300">|</span>
                                                                        <span>Access Level: <span className="font-medium text-slate-700">{sys.level_of_access || 'Standard'}</span></span>
                                                                    </div>
                                                                </div>

                                                                {/* SMART ACTIONS */}
                                                                {sys.sysadmin_status === 'pending' && sys.current_stage !== 'Rejected' && (
                                                                    <div className="flex items-center gap-2">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="text-red-600 border-red-200 hover:bg-red-50"
                                                                            onClick={() => handleOverride(req.id, sys.id, 'reject', 'Admin')}
                                                                        >
                                                                            <XCircle className="w-4 h-4 mr-1" /> Reject
                                                                        </Button>

                                                                        {sys.current_stage?.startsWith('Stage') && (
                                                                            <Button
                                                                                size="sm"
                                                                                className="bg-[#1e2a4a] hover:bg-[#2B3A67] text-white shadow-lg shadow-blue-900/10"
                                                                                onClick={() => {
                                                                                    // Extract stage name for confirmation (e.g. "Stage 1: HOD" -> "HOD")
                                                                                    const stageShort = sys.current_stage.split(': ')[1] || 'Pending Stage';
                                                                                    handleOverride(req.id, sys.id, 'approve', stageShort);
                                                                                }}
                                                                            >
                                                                                <Shield className="w-4 h-4 mr-2" />
                                                                                Approve as {sys.current_stage.split(': ')[1]}
                                                                            </Button>
                                                                        )}
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
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="bg-white border-t border-slate-100 p-4 rounded-b-xl shadow-sm flex justify-between items-center mt-[-1rem] z-10 relative">
                <div className="text-xs text-slate-500 font-medium">
                    Page {currentPage} of {Math.ceil(count / 10)}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(prevUrl, 'prev')}
                        disabled={currentPage === 1 || loading}
                        className="text-xs h-8"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(nextUrl, 'next')}
                        disabled={(count > 0 && currentPage >= Math.ceil(count / 10)) || loading}
                        className="text-xs h-8"
                    >
                        Next
                    </Button>
                </div>
            </div>

            <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />
        </div>
    );
}
