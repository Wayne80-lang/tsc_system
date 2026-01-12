"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Toast from '@/components/ui/toast';
import { ArrowLeft, Shield, Lock, Globe, Key, AlertTriangle, Check } from 'lucide-react';

export default function SecurityPoliciesClient() {
    const router = useRouter();

    const PolicyCard = ({ title, desc, icon: Icon, enabled, setEnabled, locked = false }: any) => (
        <div className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start transition-shadow ${locked ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:shadow-md'}`}>
            <div className="flex gap-4">
                <div className={`p-3 rounded-lg ${enabled ? 'bg-tsc-blue/10 text-tsc-blue' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 mb-1">{title} {locked && <span className="text-xs text-slate-500 font-normal ml-2">(Coming Soon)</span>}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-sm">{desc}</p>
                    <div className="mt-3 flex items-center gap-2">
                        {enabled ? (
                            <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded border border-green-100">
                                <Check className="w-3 h-3" /> Active
                            </span>
                        ) : (
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                Disabled
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div>
                <button
                    onClick={() => !locked && setEnabled(!enabled)}
                    disabled={locked}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-tsc-blue' : 'bg-slate-200'} ${locked ? 'cursor-not-allowed' : ''}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
    );

    const [policies, setPolicies] = useState<any[]>([]);
    const [toast, setToast] = useState({ message: '', type: 'info', isVisible: false });

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async () => {
        try {
            const res = await api.get('/security-policies/');
            if (Array.isArray(res.data)) {
                setPolicies(res.data);
            } else if (res.data.results && Array.isArray(res.data.results)) {
                setPolicies(res.data.results);
            } else {
                setPolicies([]);
            }
        } catch (error) {
            console.error("Failed to fetch policies");
            setPolicies([]);
        }
    };

    const togglePolicy = async (policy: any) => {
        try {
            const updated = { is_enabled: !policy.is_enabled };
            await api.patch(`/security-policies/${policy.id}/`, updated);
            setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, ...updated } : p));
            setToast({ message: 'Policy updated successfully.', type: 'success', isVisible: true });
        } catch (error: any) {
            console.error("Policy toggle failed for policy:", policy.id);
            setToast({ message: `Failed: ${error.message} (Status: ${error.response?.status})`, type: 'error', isVisible: true });
        }
    };

    const getPolicy = (key: string) => {
        if (!Array.isArray(policies)) return { key, name: 'Unknown', is_enabled: false };
        return policies.find(p => p.key === key) || { key, name: 'Unknown', is_enabled: false };
    };

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 mb-8">
                <div className="max-w-7xl mx-auto flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Security Policies</h1>
                        <p className="text-sm text-slate-500">Configure access controls and system protection</p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <PolicyCard
                    title="Multi-Factor Authentication"
                    desc="Require all administrators to use 2FA for login access."
                    icon={Shield}
                    enabled={getPolicy('mfa').is_enabled}
                    setEnabled={() => togglePolicy(getPolicy('mfa'))}
                    locked={true}
                />
                <PolicyCard
                    title="IP Whitelisting"
                    desc="Restrict system access to known corporate IP ranges only."
                    icon={Globe}
                    enabled={getPolicy('ip_whitelist').is_enabled}
                    setEnabled={() => togglePolicy(getPolicy('ip_whitelist'))}
                    locked={true}
                />
                <PolicyCard
                    title="Strong Password Policy"
                    desc="Enforce complexity requirements (12+ chars, symbols, mixed case)."
                    icon={Key}
                    enabled={getPolicy('strong_password').is_enabled}
                    setEnabled={() => togglePolicy(getPolicy('strong_password'))}
                />
                <PolicyCard
                    title="Session Timeout"
                    desc="Automatically log out users after 15 minutes of inactivity."
                    icon={Lock}
                    enabled={getPolicy('session_timeout').is_enabled}
                    setEnabled={() => togglePolicy(getPolicy('session_timeout'))}
                />
            </div>
            {toast.isVisible && (
                <Toast
                    message={toast.message}
                    type={toast.type as any}
                    isVisible={toast.isVisible}
                    onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
                />
            )}
        </div>
    );
}
