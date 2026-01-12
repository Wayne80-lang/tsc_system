"use client";

import { useEffect, useState, Fragment, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, FileText, CheckCircle, XCircle, Clock, AlertCircle, ChevronDown, LayoutGrid, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
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
}

interface AccessRequest {
    id: number;
    tsc_no: string;
    request_type: string;
    status: string;
    submitted_at: string;
    directorate_name: string;
    requested_systems: RequestedSystem[];
}

const statusColor = (status: string) => {
    switch (status) {
        case 'approved': return 'bg-green-100 text-green-800';
        case 'rejected_hod':
        case 'rejected_ict':
            return 'bg-red-100 text-red-800';
        case 'pending_hod':
        case 'pending_ict':
            return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-slate-100 text-slate-800';
    }
};

const statusIcon = (status: string) => {
    switch (status) {
        case 'approved': return <CheckCircle className="h-4 w-4" />;
        case 'rejected_hod':
        case 'rejected_ict':
            return <XCircle className="h-4 w-4" />;
        case 'pending_hod':
        case 'pending_ict':
            return <Clock className="h-4 w-4" />;
        default: return <AlertCircle className="h-4 w-4" />;
    }
};

function DashboardContent() {
    const router = useRouter(); // Helper for navigation if needed
    const searchParams = useSearchParams();
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [mySystems, setMySystems] = useState<any[]>([]); // New State
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'requests' | 'my_systems'>('requests'); // Tab State
    const [userName, setUserName] = useState('');
    const [expandedRequest, setExpandedRequest] = useState<number | null>(null);

    // Pagination State for Requests
    const [nextUrl, setNextUrl] = useState<string | null>(null);
    const [prevUrl, setPrevUrl] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchData = async (url: string | null = null) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/';
                return;
            }

            const headers = { Authorization: `Token ${token}` };

            // Handle pagination URL vs Base URL
            // We strip any complexity by using axios directly for absolute URLs provided by the backend (pagination)
            // and our api client for standard relative requests
            const fetchRequests = url
                ? axios.get(url, { headers })
                : api.get('/requests/', { headers });

            const [userRes, requestsRes, mySystemsRes] = await Promise.all([
                api.get('/users/me/', { headers }).catch(e => ({ data: { first_name: 'User' } })),
                fetchRequests,
                api.get('/users/my_systems/', { headers }).catch(e => ({ data: [] }))
            ]);

            // Extract name safely
            const name = userRes.data.first_name || userRes.data.email?.split('@')[0] || 'User';
            setUserName(name);

            // Handle Paginated Response for Requests
            if (requestsRes.data.results) {
                setRequests(requestsRes.data.results);
                setNextUrl(requestsRes.data.next);
                setPrevUrl(requestsRes.data.previous);
                setCount(requestsRes.data.count);
            } else {
                setRequests(requestsRes.data);
                setCount(requestsRes.data.length);
            }

            setMySystems(mySystemsRes.data);

        } catch (error: any) {
            console.error('Dashboard fetch error:', error);
            if (error.response && error.response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/';
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handlePageChange = (url: string | null, direction: 'next' | 'prev') => {
        if (!url) return;
        fetchData(url);
        setCurrentPage(p => direction === 'next' ? p + 1 : p - 1);
    };

    // Derived Stats
    // NOTE: If paginated, these counts might be only for the current page if we rely on `requests.length`.
    // We should use `count` from API for total requests.
    // For specific status counts, we might miss them if not on page 1.
    // Ideally, we need a separate stats endpoint for staff too, or just accept that summary cards show "Visible" or "Total".
    // For now, let's use `count` for Total Requests, and `requests.length` for others (or we'd need to fetch all).
    // Given the constraints, let's just use what we have. API stats endpoint is better long term.
    const totalRequests = count || requests.length;
    const pendingRequests = requests.filter(r => r.status.includes('pending')).length;
    const approvedRequests = requests.filter(r => r.status === 'approved').length;
    const activeSystemsCount = mySystems.length;

    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="space-y-8">
            {/* Header Section with Greeting */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100">
                <div>
                    <h2 className="text-sm font-semibold text-tsc-gold uppercase tracking-wider mb-1">{currentDate}</h2>
                    <h1 className="text-4xl font-extrabold text-[#2B3A67] tracking-tight">
                        Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, <span className="text-slate-900">{userName}</span>
                    </h1>
                </div>
                <div className="flex gap-4">
                    <Link href="/dashboard/new">
                        <Button className="bg-[#2B3A67] hover:bg-[#1e2a4a] text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all px-6 py-6 text-md font-semibold rounded-xl">
                            <Plus className="h-5 w-5 mr-2" />
                            New Access Request
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Active Systems</p>
                            <h3 className="text-3xl font-bold text-[#2B3A67] mt-1">{activeSystemsCount}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 text-[#2B3A67] rounded-xl">
                            <Shield className="h-6 w-6" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total Requests</p>
                            <h3 className="text-3xl font-bold text-slate-900 mt-1">{totalRequests}</h3>
                        </div>
                        <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                            <FileText className="h-6 w-6" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Pending Action</p>
                            <h3 className="text-3xl font-bold text-amber-600 mt-1">{pendingRequests}</h3>
                        </div>
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <Clock className="h-6 w-6" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Approved</p>
                            <h3 className="text-3xl font-bold text-green-600 mt-1">{approvedRequests}</h3>
                        </div>
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                            <CheckCircle className="h-6 w-6" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`px-8 py-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'requests' ? 'border-[#2B3A67] text-[#2B3A67]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    My Request History
                </button>
                <button
                    onClick={() => setActiveTab('my_systems')}
                    className={`px-8 py-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'my_systems' ? 'border-[#2B3A67] text-[#2B3A67]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    My Active Systems
                </button>
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2B3A67]"></div>
                </div>
            ) : (
                <>
                    {activeTab === 'requests' && (
                        <div className="space-y-4">
                            {requests.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm"
                                >
                                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                        <FileText className="h-10 w-10 text-slate-300" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900">No requests yet</h3>
                                    <p className="mt-2 text-slate-500 max-w-sm mx-auto">Get started by creating your first system access request.</p>
                                    <div className="mt-8">
                                        <Link href="/dashboard/new">
                                            <Button className="bg-[#2B3A67] hover:bg-[#1e2a4a] text-white px-8 py-6 rounded-xl text-md shadow-lg shadow-blue-900/10">Create Request</Button>
                                        </Link>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50"
                                >
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-100">
                                            <thead>
                                                <tr className="bg-[#2B3A67] text-white">
                                                    <th scope="col" className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest opacity-90">Date</th>
                                                    <th scope="col" className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest opacity-90">Request Type</th>
                                                    <th scope="col" className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest opacity-90">TSC No</th>
                                                    <th scope="col" className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest opacity-90">Directorate</th>
                                                    <th scope="col" className="px-8 py-5 text-left text-xs font-bold uppercase tracking-widest opacity-90">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {requests.map((request, index) => (
                                                    <Fragment key={request.id}>
                                                        <tr
                                                            onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}
                                                            className={`
                                                            cursor-pointer transition-all duration-200 group border-l-4
                                                            ${expandedRequest === request.id ? 'bg-blue-50/50 border-l-[#2B3A67]' : 'hover:bg-slate-50 border-l-transparent'}
                                                        `}
                                                        >
                                                            <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-500">
                                                                {new Date(request.submitted_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                            </td>
                                                            <td className="px-8 py-5 whitespace-nowrap text-sm font-semibold text-[#2B3A67] capitalize group-hover:translate-x-1 transition-transform">
                                                                {request.request_type}
                                                            </td>
                                                            <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-600 font-medium">
                                                                {request.tsc_no}
                                                            </td>
                                                            <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-600">
                                                                {request.directorate_name}
                                                            </td>
                                                            <td className="px-8 py-5 whitespace-nowrap">
                                                                <div className="flex items-center gap-4">
                                                                    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide border ${statusColor(request.status)} shadow-sm`}>
                                                                        {statusIcon(request.status)}
                                                                        <span className="capitalize">{request.status.replace('_', ' ')}</span>
                                                                    </span>
                                                                    <span className="text-xs font-bold text-[#2B3A67] uppercase tracking-wider hover:text-[#D4AF37] transition-colors min-w-[40px] text-right">
                                                                        {expandedRequest === request.id ? 'Close' : 'View'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {expandedRequest === request.id && (
                                                            <tr className="bg-slate-50/50">
                                                                <td colSpan={5} className="px-8 py-6">
                                                                    <motion.div
                                                                        initial={{ opacity: 0, height: 0 }}
                                                                        animate={{ opacity: 1, height: 'auto' }}
                                                                        exit={{ opacity: 0, height: 0 }}
                                                                        className="space-y-4 overflow-hidden"
                                                                    >
                                                                        <div className="flex items-center gap-2 mb-4">
                                                                            <div className="p-2 bg-[#2B3A67]/10 rounded-lg">
                                                                                <LayoutGrid className="h-5 w-5 text-[#2B3A67]" />
                                                                            </div>
                                                                            <h4 className="text-sm font-bold text-[#2B3A67] uppercase tracking-wider">Requested Systems & Approvals</h4>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                            {request.requested_systems.map((sys) => (
                                                                                <div key={sys.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                                                                                    <div className="flex justify-between items-start mb-4">
                                                                                        <h5 className="font-bold text-slate-900 border-b-2 border-[#D4AF37] pb-1">{sys.system_display}</h5>
                                                                                    </div>

                                                                                    <div className="space-y-4">
                                                                                        {/* HOD Stage */}
                                                                                        <div className="relative pl-4 border-l-2 border-slate-100">
                                                                                            <div className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${sys.hod_status === 'approved' ? 'bg-green-500' : sys.hod_status === 'rejected' ? 'bg-red-500' : 'bg-slate-300'}`} />
                                                                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">HOD Approval</p>
                                                                                            <div className="flex items-center gap-2 text-sm">
                                                                                                {sys.hod_status === 'approved' ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                                                                                                    sys.hod_status === 'rejected' ? <XCircle className="h-4 w-4 text-red-600" /> :
                                                                                                        <Clock className="h-4 w-4 text-slate-400" />}
                                                                                                <span className={`capitalize font-medium ${sys.hod_status === 'approved' ? 'text-green-700' : sys.hod_status === 'rejected' ? 'text-red-700' : 'text-slate-600'}`}>
                                                                                                    {sys.hod_status || 'Pending'}
                                                                                                </span>
                                                                                            </div>
                                                                                            {sys.hod_status === 'rejected' && sys.hod_comment && (
                                                                                                <div className="mt-2 bg-red-50 border border-red-100 p-2 rounded text-xs text-red-800 italic">
                                                                                                    "{sys.hod_comment}"
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* ICT Stage */}
                                                                                        <div className="relative pl-4 border-l-2 border-slate-100">
                                                                                            <div className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${sys.ict_status === 'approved' ? 'bg-green-500' : sys.ict_status === 'rejected' ? 'bg-red-500' : 'bg-slate-300'}`} />
                                                                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">ICT Approval</p>
                                                                                            <div className="flex items-center gap-2 text-sm">
                                                                                                {sys.ict_status === 'approved' ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                                                                                                    sys.ict_status === 'rejected' ? <XCircle className="h-4 w-4 text-red-600" /> :
                                                                                                        <Clock className="h-4 w-4 text-slate-400" />}
                                                                                                <span className={`capitalize font-medium ${sys.ict_status === 'approved' ? 'text-green-700' : sys.ict_status === 'rejected' ? 'text-red-700' : 'text-slate-600'}`}>
                                                                                                    {sys.ict_status || 'Pending'}
                                                                                                </span>
                                                                                            </div>
                                                                                            {sys.ict_status === 'rejected' && sys.ict_comment && (
                                                                                                <div className="mt-2 bg-red-50 border border-red-100 p-2 rounded text-xs text-red-800 italic">
                                                                                                    "{sys.ict_comment}"
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* System Admin Stage */}
                                                                                        <div className="relative pl-4 border-l-2 border-transparent">
                                                                                            <div className={`absolute -left-[5px] top-1 h-2 w-2 rounded-full ${sys.sysadmin_status === 'approved' ? 'bg-green-500' : sys.sysadmin_status === 'rejected' ? 'bg-red-500' : 'bg-slate-300'}`} />
                                                                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">System Admin</p>
                                                                                            <div className="flex items-center gap-2 text-sm">
                                                                                                {sys.sysadmin_status === 'approved' ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                                                                                                    sys.sysadmin_status === 'rejected' ? <XCircle className="h-4 w-4 text-red-600" /> :
                                                                                                        <Clock className="h-4 w-4 text-slate-400" />}
                                                                                                <span className={`capitalize font-medium ${sys.sysadmin_status === 'approved' ? 'text-green-700' : sys.sysadmin_status === 'rejected' ? 'text-red-700' : 'text-slate-600'}`}>
                                                                                                    {sys.sysadmin_status || 'Pending'}
                                                                                                </span>
                                                                                            </div>
                                                                                            {sys.sysadmin_status === 'rejected' && sys.sysadmin_comment && (
                                                                                                <div className="mt-2 bg-red-50 border border-red-100 p-2 rounded text-xs text-red-800 italic">
                                                                                                    "{sys.sysadmin_comment}"
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </motion.div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
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
                    )}

                    {activeTab === 'my_systems' && (
                        <div className="space-y-4">
                            {mySystems.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm"
                                >
                                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                        <Shield className="h-10 w-10 text-slate-300" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900">No active systems found</h3>
                                    <p className="mt-2 text-slate-500 max-w-sm mx-auto">You do not not have any active system rights assigned to you yet.</p>
                                </motion.div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {mySystems.map((sys) => (
                                        <motion.div
                                            key={sys.system}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group"
                                        >
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
                                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                                </div>
                                                <Link href={`/dashboard/new?type=deactivate&system=${sys.system}`}>
                                                    <Button variant="outline" className="text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 text-xs h-8">
                                                        Revoke Access
                                                    </Button>
                                                </Link>
                                            </div>

                                            <h3 className="text-xl font-bold text-slate-900 mb-2">{sys.system_display}</h3>
                                            <div className="space-y-2">
                                                <p className="text-sm text-slate-500 flex items-center gap-2">
                                                    <Clock className="h-4 w-4" />
                                                    Granted: <span className="font-medium text-slate-700">{new Date(sys.granted_date).toLocaleDateString()}</span>
                                                </p>
                                                <p className="text-xs text-slate-400 uppercase tracking-wider">
                                                    Via Request #{sys.request_id}
                                                </p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function Dashboard() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Dashboard...</div>}>
            <DashboardContent />
        </Suspense>
    );
}
