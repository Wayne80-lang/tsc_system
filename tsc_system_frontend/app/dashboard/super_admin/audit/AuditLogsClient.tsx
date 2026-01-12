"use client";

import { useEffect, useState, Fragment, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import axios from 'axios';
import api from '@/lib/api';
import { ChevronLeft, Search, Filter, Shield, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuditLog {
    id: number;
    user_name: string;
    user_tsc_no: string | null;
    action: string;
    target: string | null;
    ip_address: string | null;
    status: 'success' | 'failure' | 'warning';
    timestamp: string;
}

function AuditLogsPageContent() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);

    // Pagination State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [nextUrl, setNextUrl] = useState<string | null>(null);
    const [prevUrl, setPrevUrl] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchLogs = async (url: string = '/audit-logs/') => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) return router.push('/');

            let response;
            if (url) {
                if (url.startsWith('http')) {
                    response = await axios.get(url, { headers: { Authorization: `Token ${token}` } });
                } else {
                    let path = url;
                    if (path.startsWith('/api')) path = path.substring(4);
                    response = await api.get(path, { headers: { Authorization: `Token ${token}` } });
                }
            } else {
                response = await api.get('/audit-logs/', {
                    headers: { Authorization: `Token ${token}` }
                });
            }

            // Check if paginated response
            if (response.data.results) {
                setLogs(response.data.results);
                setFilteredLogs(response.data.results);
                setNextUrl(response.data.next);
                setPrevUrl(response.data.previous);
                setCount(response.data.count);
            } else {
                // Fallback for non-paginated (shouldn't happen with new settings)
                setLogs(response.data);
                setFilteredLogs(response.data);
                setCount(response.data.length);
            }
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handlePageChange = (url: string | null, direction: 'next' | 'prev') => {
        if (!url) return;
        fetchLogs(url);
        setCurrentPage(p => direction === 'next' ? p + 1 : p - 1);
    };

    // Filter Logic
    useEffect(() => {
        let result = logs;

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(log =>
                log.action.toLowerCase().includes(lowerTerm) ||
                (log.user_name ? log.user_name.toLowerCase().includes(lowerTerm) : false) ||
                (log.target ? log.target.toLowerCase().includes(lowerTerm) : false)
            );
        }

        if (statusFilter !== 'all') {
            result = result.filter(log => log.status === statusFilter);
        }

        setFilteredLogs(result);
    }, [searchTerm, statusFilter, logs]);


    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'failure': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            default: return <Clock className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <div className="min-h-screen pb-20">
            {/* Header */}
            <div className="mb-8 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-slate-100">
                    <ChevronLeft className="w-6 h-6 text-slate-600" />
                </Button>
                <div>
                    <h2 className="text-xs font-bold text-tsc-gold uppercase tracking-[0.2em] mb-1">System Security</h2>
                    <h1 className="text-3xl font-black text-[#1e2a4a]">Audit Logs</h1>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by User, Action, or Target..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tsc-blue/20 transition-all font-outfit"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative min-w-[200px]">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                        className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tsc-blue/20 appearance-none font-outfit text-slate-600"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Events</option>
                        <option value="success">Success</option>
                        <option value="failure">Failure</option>
                        <option value="warning">Warning</option>
                    </select>
                </div>
            </div>

            {/* Timeline View */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-[#2B3A67]">Recent Activity</h3>
                    <span className="text-xs font-mono text-slate-400">{filteredLogs.length} Events</span>
                </div>

                <div className="divide-y divide-slate-100">
                    {filteredLogs.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 font-light">
                            {loading ? 'Loading audit trail...' : 'No logs found matching your criteria.'}
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-[#1e2a4a]/5 text-slate-600 text-xs uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="p-4 w-48">Timestamp</th>
                                    <th className="p-4 w-16 text-center">Status</th>
                                    <th className="p-4">User</th>
                                    <th className="p-4">Action</th>
                                    <th className="p-4">Target</th>
                                    <th className="p-4 text-right">IP Address</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-mono text-xs text-slate-500">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center">{getStatusIcon(log.status)}</div>
                                        </td>
                                        <td className="p-4 font-medium text-[#2B3A67]">
                                            <div>{log.user_name || 'System'}</div>
                                            {log.user_tsc_no && (
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">{log.user_tsc_no}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-700 font-medium">
                                            {log.action}
                                        </td>
                                        <td className="p-4 text-slate-500 font-mono text-xs">
                                            {log.target || '-'}
                                        </td>
                                        <td className="p-4 text-right text-slate-400 font-mono text-xs">
                                            {log.ip_address || '127.0.0.1'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="text-xs text-slate-500 font-medium">
                    Page {currentPage} of {Math.ceil(count / 10)}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(prevUrl, 'prev')}
                        disabled={!prevUrl || loading}
                        className="text-xs h-8"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(nextUrl, 'next')}
                        disabled={!nextUrl || loading}
                        className="text-xs h-8"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function AuditLogsClient() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Audit Logs...</div>}>
            <AuditLogsPageContent />
        </Suspense>
    );
}
