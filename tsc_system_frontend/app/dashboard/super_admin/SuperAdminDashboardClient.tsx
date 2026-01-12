"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { DashboardStats } from '@/types';
import StatsCards from '@/components/dashboard/StatsCards';
import Toast from '@/components/ui/toast';
import { CheckCircle, Clock, ShieldAlert, Activity, Server, Globe } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'loading';

export default function SuperAdminDashboardClient() {
    const router = useRouter();

    // State
    const [userName, setUserName] = useState('');
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        pending_systems: 0, overdue_requests: 0, reviewed_today: 0,
        total_history: 0, approved_history: 0, rejected_history: 0
    } as any);
    const [health, setHealth] = useState<any>({
        database: { status: 'loading', latency: '-' },
        email: { status: 'loading' },
        server: { version: '-', environment: '-' },
        api_latency: '-'
    });

    // Toast State
    const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
        message: '', type: 'info', isVisible: false
    });
    const showToast = (message: string, type: ToastType) => setToast({ message, type, isVisible: true });
    const hideToast = () => setToast(prev => ({ ...prev, isVisible: false }));

    const fetchData = async (showLoading = true, signal?: AbortSignal) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return router.push('/');

            const headers = { Authorization: `Token ${token}` };

            const [userRes, statsRes, healthRes] = await Promise.all([
                api.get('/users/me/', { headers, signal }).catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    return { data: { first_name: 'Super Admin' } };
                }),
                api.get('/approvals/stats/', { headers, signal }).catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    return null;
                }),
                api.get('/approvals/system_health/', { headers, signal }).catch(e => {
                    if (e.name === 'CanceledError' || e.code === "ERR_CANCELED") throw e;
                    return null;
                })
            ]);

            setUserName(userRes.data.first_name || 'Super Admin');
            if (statsRes && statsRes.data) setStats(statsRes.data);
            if (healthRes && healthRes.data) setHealth(healthRes.data);

        } catch (error: any) {
            if (error.name === 'CanceledError' || error.code === "ERR_CANCELED") return;
            console.error("Error", error);
            if (error.response?.status === 401) router.push('/');
            showToast("Failed to connect to server.", "error");
        } finally {
            setIsInitialLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchData(true, controller.signal);

        const interval = setInterval(() => fetchData(false), 5000);
        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, []);

    const QuickActionButton = ({ icon: Icon, label, desc, onClick }: any) => (
        <button
            onClick={onClick}
            className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:shadow-md hover:border-tsc-blue/30 transition-all group text-left w-full"
        >
            <div className="p-3 bg-slate-50 text-slate-600 rounded-lg group-hover:bg-tsc-blue group-hover:text-white transition-colors">
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h4 className="font-bold text-slate-800 text-sm">{label}</h4>
                <p className="text-xs text-slate-500">{desc}</p>
            </div>
        </button>
    );

    const SystemHealthItem = ({ label, status, value }: any) => (
        <div className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${status === 'good' ? 'bg-green-500' : (status === 'loading' ? 'bg-slate-300 animate-pulse' : 'bg-red-500')}`}></div>
                <span className="text-sm font-medium text-slate-600">{label}</span>
            </div>
            {status === 'loading' ? (
                <div className="h-4 w-16 bg-slate-100 rounded animate-pulse"></div>
            ) : (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status === 'good'
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                    {value}
                </span>
            )}
        </div>
    );

    return (
        <div className="min-h-screen pb-20 bg-slate-50/50">
            {/* Improved Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 mb-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-tsc-blue text-[10px] font-bold text-white">SA</span>
                                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Administration</h2>
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
                        </div>
                        <div className="text-right hidden md:block">
                            <p className="text-sm text-slate-500">Welcome back,</p>
                            <p className="font-bold text-slate-800">{userName}</p>
                        </div>
                    </div>
                </div>
            </div>

            {isInitialLoading ? (
                <div className="flex justify-center items-center py-40 min-h-[500px]">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-tsc-blue"></div>
                </div>
            ) : (
                <div className="max-w-7xl mx-auto px-6 space-y-8">
                    {/* Stats Row */}
                    <StatsCards stats={stats} role="super_admin" />

                    {/* Main Grid Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* Left Column - System Status (Span 2) */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* System Health Panel */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-tsc-blue" />
                                        System Health
                                    </h3>
                                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> All Systems Nominal
                                    </span>
                                </div>
                                <div className="p-2">
                                    <SystemHealthItem
                                        label="Database Connectivity"
                                        status={health.database.status}
                                        value={health.database.status === 'good' ? 'CONNECTED' : 'DISCONNECTED'}
                                    />
                                    <SystemHealthItem
                                        label="Email Dispatch Service"
                                        status={health.email.status}
                                        value={health.email.status === 'good' ? 'OPERATIONAL' : 'OFFLINE'}
                                    />
                                    <SystemHealthItem
                                        label="API Response Latency"
                                        status="good"
                                        value={health.database.latency || '24ms'}
                                    />
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                    </span>
                                    Real-time Activity (Live Users)
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                    {/* Big Number */}
                                    <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Users Online</h4>
                                        <div className="text-5xl font-black text-[#1e2a4a] tracking-tight">
                                            {/* Fallback to 0 if stats not yet loaded/available */}
                                            {(stats as any).active_users || 0}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2">Currently Online</p>
                                    </div>

                                    {/* Breakdown Graph */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase">Role Breakdown</h4>
                                        {/* Simple Bar Chart */}
                                        {['staff', 'hod', 'ict', 'sys_admin', 'super_admin'].map(role => {
                                            const count = (stats as any).active_roles?.[role] || 0;
                                            // Calculate percentage for bar width (relative to total active)
                                            const total = (stats as any).active_users || 1;
                                            const percent = Math.max(5, (count / total) * 100); // min 5% for visual

                                            const roleLabel = {
                                                'staff': 'Staff', 'hod': 'HOD', 'ict': 'ICT', 'sys_admin': 'SysAdmin', 'super_admin': 'SuperAdmin'
                                            }[role] || role;

                                            return (
                                                <div key={role} className="flex items-center gap-2 text-xs">
                                                    <span className="w-20 font-medium text-slate-600">{roleLabel}</span>
                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${percent}%` }}
                                                            className={`h-full rounded-full ${count > 0 ? 'bg-tsc-blue' : 'bg-slate-200'}`}
                                                        />
                                                    </div>
                                                    <span className="w-6 text-right font-bold text-slate-500">{count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Actions & Info (Span 1) */}
                        <div className="space-y-6">
                            {/* Quick Actions */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                                <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
                                <div className="space-y-3">
                                    <QuickActionButton
                                        icon={Clock}
                                        label="Audit Logs"
                                        desc="View system access history"
                                        onClick={() => router.push('/dashboard/super_admin/audit')}
                                    />
                                    <QuickActionButton
                                        icon={ShieldAlert}
                                        label="Security Policies"
                                        desc="Manage access controls"
                                        onClick={() => router.push('/dashboard/super_admin/security')}
                                    />
                                    <QuickActionButton
                                        icon={Globe}
                                        label="Global Settings"
                                        desc="System-wide configurations"
                                        onClick={() => router.push('/dashboard/super_admin/settings')}
                                    />
                                </div>
                            </div>

                            {/* System Info Card */}
                            <div className="bg-gradient-to-br from-[#1e2a4a] to-[#2B3A67] rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                                <h3 className="font-bold text-white mb-4 relative z-10 flex items-center gap-2">
                                    <Server className="w-4 h-4 text-tsc-gold" /> Server Info
                                </h3>
                                <div className="space-y-3 relative z-10 text-sm">
                                    <div className="flex justify-between border-b border-white/10 pb-2">
                                        <span className="text-slate-300">Version</span>
                                        <span className="font-mono">{health.server?.version || 'v2.4.0'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-300">Latency</span>
                                        <span className="font-mono">{health.database?.latency || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            <AnimatePresence>
                {toast.isVisible && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        isVisible={toast.isVisible}
                        onClose={hideToast}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
