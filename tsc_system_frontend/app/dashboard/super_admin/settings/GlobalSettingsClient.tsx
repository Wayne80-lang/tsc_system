"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Toast from '@/components/ui/toast';
import { ArrowLeft, Save, Bell, Mail, Power, Settings as SettingsIcon, Clock, Globe } from 'lucide-react';

export default function GlobalSettingsClient() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('general');
    const [settings, setSettings] = useState<any[]>([]);
    const [toast, setToast] = useState({ message: '', type: 'info', isVisible: false });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/global-settings/');
            if (Array.isArray(res.data)) {
                setSettings(res.data);
            } else if (res.data.results && Array.isArray(res.data.results)) {
                setSettings(res.data.results);
            } else {
                setSettings([]);
            }
        } catch (error: any) {
            console.error("Failed to fetch settings", error);
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                setToast({ message: 'Session expired or unauthorized. Redirecting...', type: 'error', isVisible: true });
                setTimeout(() => router.push('/'), 2000);
            }
        }
    };

    const getValue = (key: string) => {
        if (!Array.isArray(settings)) return '';
        return settings.find(s => s.key === key)?.value || '';
    };
    const setValue = (key: string, val: string) => {
        setSettings(prev => {
            const exists = prev.find(s => s.key === key);
            if (exists) return prev.map(s => s.key === key ? { ...s, value: val } : s);
            return [...prev, { key, value: val, label: key, group: activeTab }];
        });
    };

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === id
                ? 'border-tsc-blue text-tsc-blue'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
        >
            <Icon className="w-4 h-4" /> {label}
        </button>
    );

    const EditableInput = ({ label, value, onChange, placeholder, type = 'text', icon: Icon, helperText }: any) => {
        const [isEditing, setIsEditing] = useState(false);
        const inputRef = useRef<HTMLInputElement>(null);

        useEffect(() => {
            if (isEditing && inputRef.current) {
                inputRef.current.focus();
            }
        }, [isEditing]);

        return (
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <div className="flex items-center">
                            {Icon && <div className="p-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-lg text-slate-500"><Icon className="w-4 h-4" /></div>}
                            <input
                                ref={inputRef}
                                type={type}
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                placeholder={placeholder}
                                disabled={!isEditing}
                                className={`w-full p-3 border transition-all ${Icon ? 'rounded-r-lg' : 'rounded-lg'} ${isEditing
                                    ? 'bg-white border-tsc-blue ring-2 ring-tsc-blue/20'
                                    : 'bg-slate-50 border-slate-200 text-slate-500'
                                    }`}
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`text-sm font-bold px-3 py-2 rounded-lg transition-colors ${isEditing
                            ? 'bg-tsc-blue text-white hover:bg-tsc-blue/90'
                            : 'text-tsc-blue hover:bg-tsc-blue/10'
                            }`}
                    >
                        {isEditing ? 'Done' : 'Edit'}
                    </button>
                </div>
                {helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
            </div>
        );
    };

    const EditableTextArea = ({ label, value, onChange, placeholder, helperText }: any) => {
        const [isEditing, setIsEditing] = useState(false);
        const inputRef = useRef<HTMLTextAreaElement>(null);

        useEffect(() => {
            if (isEditing && inputRef.current) {
                inputRef.current.focus();
            }
        }, [isEditing]);

        return (
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
                <div className="flex gap-3 items-start">
                    <div className="relative flex-1">
                        <textarea
                            ref={inputRef}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            disabled={!isEditing}
                            rows={6}
                            className={`w-full p-3 border rounded-lg transition-all ${isEditing
                                ? 'bg-white border-tsc-blue ring-2 ring-tsc-blue/20'
                                : 'bg-slate-50 border-slate-200 text-slate-500'
                                }`}
                        />
                    </div>
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`text-sm font-bold px-3 py-2 rounded-lg transition-colors ${isEditing
                            ? 'bg-tsc-blue text-white hover:bg-tsc-blue/90'
                            : 'text-tsc-blue hover:bg-tsc-blue/10'
                            }`}
                    >
                        {isEditing ? 'Done' : 'Edit'}
                    </button>
                </div>
                {helperText && <p className="mt-1 text-xs text-slate-500 whitespace-pre-wrap">{helperText}</p>}
            </div>
        );
    };

    const handleSave = async () => {
        try {
            const settingsToSave = settings.filter(s => s.group === activeTab || (activeTab === 'notifications' && s.group === 'notification'));

            for (const s of settingsToSave) {
                if (s.id) {
                    await api.patch(`/global-settings/${s.id}/`, { value: s.value });
                } else {
                    await api.post('/global-settings/', { key: s.key, value: s.value, group: s.group || activeTab });
                }
            }
            setToast({ message: 'Settings saved successfully.', type: 'success', isVisible: true });
            fetchSettings();
        } catch (error) {
            console.error(error);
            setToast({ message: 'Failed to save settings.', type: 'error', isVisible: true });
        }
    };

    const renderGeneralTab = () => (
        <div className="max-w-3xl space-y-8">
            <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 border-b pb-2">System Identity</h3>
                <EditableInput
                    label="System Name"
                    value={getValue('system_name')}
                    onChange={(val: string) => setValue('system_name', val)}
                    placeholder="TSC System Access Portal"
                    icon={Globe}
                />

                <h3 className="text-lg font-bold text-slate-900 border-b pb-2 pt-4">Communication Channels</h3>
                <EditableInput
                    label="Support Email Address"
                    value={getValue('support_email')}
                    onChange={(val: string) => setValue('support_email', val)}
                    placeholder="support@tsc.go.ke"
                    icon={Mail}
                    helperText="Visible to users for general inquiries."
                />
                <EditableInput
                    label="ICT Team Email"
                    value={getValue('ict_email')}
                    onChange={(val: string) => setValue('ict_email', val)}
                    placeholder="ict.support@tsc.go.ke"
                    icon={Mail}
                    helperText="Receives technical escalation emails."
                />
                <EditableInput
                    label="System Email (Outgoing)"
                    value={getValue('system_email')}
                    onChange={(val: string) => setValue('system_email', val)}
                    placeholder="no-reply@tsc.go.ke"
                    icon={Mail}
                    helperText="Used as the 'From' address for system notifications."
                />
            </div>

            <div className="pt-8 flex justify-end">
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-8 py-3 bg-tsc-blue text-white rounded-lg font-bold hover:bg-tsc-blue/90 shadow-lg shadow-tsc-blue/20 transition-all transform hover:-translate-y-0.5"
                >
                    <Save className="w-5 h-5" /> Confirm Changes
                </button>
            </div>
        </div>
    );

    const renderNotificationsTab = () => {
        const templates = [
            {
                title: "HOD Approval (to ICT)",
                subjectKey: "email_hod_approval_subject",
                bodyKey: "email_hod_approval_body",
                vars: "{requester_name}, {tsc_no}, {directorate}, {system_list}"
            },
            {
                title: "HOD Review Complete (to Requester)",
                subjectKey: "email_hod_review_subject",
                bodyKey: "email_hod_review_body",
                vars: "{requester_name}, {summary_list}"
            },
            {
                title: "ICT Review Complete (to Requester)",
                subjectKey: "email_ict_review_subject",
                bodyKey: "email_ict_review_body",
                vars: "{requester_name}, {summary_list}"
            },
            {
                title: "Access Granted (System Admin)",
                subjectKey: "email_access_granted_subject",
                bodyKey: "email_access_granted_body",
                vars: "{requester_name}, {system_name}, {comment}"
            },
            {
                title: "Access Revoked (System Admin)",
                subjectKey: "email_access_revoked_subject",
                bodyKey: "email_access_revoked_body",
                vars: "{requester_name}, {system_name}, {comment}"
            },
            {
                title: "Request Rejected (System Admin)",
                subjectKey: "email_request_rejected_subject",
                bodyKey: "email_request_rejected_body",
                vars: "{requester_name}, {system_name}, {comment}"
            }
        ];

        return (
            <div className="space-y-6 max-w-3xl">
                {templates.map((tpl, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">{tpl.title}</h3>
                        <div className="space-y-4">
                            <EditableInput
                                label="Subject"
                                value={getValue(tpl.subjectKey)}
                                onChange={(val: string) => setValue(tpl.subjectKey, val)}
                                placeholder="Email Subject"
                            />
                            <EditableTextArea
                                label="Body Content"
                                value={getValue(tpl.bodyKey)}
                                onChange={(val: string) => setValue(tpl.bodyKey, val)}
                                placeholder="Email Body"
                                helperText={`Available Variables: ${tpl.vars}`}
                            />
                        </div>
                    </div>
                ))}

                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-tsc-blue text-white px-6 py-2.5 rounded-lg font-bold hover:bg-tsc-blue/90 transition-all shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        Save All Templates
                    </button>
                </div>
            </div>
        );
    };

    const toggleMaintenance = async (checked: boolean) => {
        const newVal = checked ? 'true' : 'false';
        setValue('maintenance_mode', newVal);

        const setting = settings.find(s => s.key === 'maintenance_mode');
        try {
            if (setting && setting.id) {
                await api.patch(`/global-settings/${setting.id}/`, { value: newVal });
            } else {
                await api.post('/global-settings/', { key: 'maintenance_mode', value: newVal, group: 'maintenance' });
            }
            setToast({ message: `Maintenance mode ${checked ? 'enabled' : 'disabled'}.`, type: 'success', isVisible: true });
            fetchSettings();
        } catch (error) {
            console.error("Failed to toggle maintenance mode", error);
            setToast({ message: 'Failed to update maintenance mode.', type: 'error', isVisible: true });
            setValue('maintenance_mode', !checked ? 'true' : 'false');
        }
    };

    const renderMaintenanceTab = () => (
        <div className="space-y-6 max-w-2xl">
            <div className={`flex items-center justify-between p-6 border rounded-xl transition-all ${getValue('maintenance_mode') === 'true'
                ? 'bg-amber-50 border-amber-200 shadow-amber-100'
                : 'bg-white border-slate-200'
                }`}>
                <div className="flex-1 pr-4">
                    <h3 className={`font-bold text-lg mb-1 ${getValue('maintenance_mode') === 'true' ? 'text-amber-900' : 'text-slate-900'
                        }`}>Maintenance Mode</h3>
                    <p className={`text-sm ${getValue('maintenance_mode') === 'true' ? 'text-amber-700' : 'text-slate-500'
                        }`}>
                        {getValue('maintenance_mode') === 'true'
                            ? 'System is currently locked. Only administrators can access.'
                            : 'System is online and accessible to all users.'}
                    </p>
                </div>
                <div className="relative inline-block w-14 align-middle select-none">
                    <input
                        type="checkbox"
                        name="maintenance_mode"
                        id="maintenance_mode"
                        checked={getValue('maintenance_mode') === 'true'}
                        onChange={(e) => toggleMaintenance(e.target.checked)}
                        className="peer absolute block w-7 h-7 rounded-full bg-white border-2 border-slate-300 appearance-none cursor-pointer transition-all duration-300
                            checked:translate-x-7 checked:border-amber-500"
                    />
                    <label
                        htmlFor="maintenance_mode"
                        className={`block overflow-hidden h-7 rounded-full cursor-pointer transition-colors duration-300 ${getValue('maintenance_mode') === 'true' ? 'bg-amber-400' : 'bg-slate-200'
                            }`}
                    ></label>
                </div>
            </div>

            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
                <h3 className="font-bold text-slate-900 mb-2">Database Management</h3>
                <p className="text-sm text-slate-500 mb-4">Initialize the database with default security policies and settings.</p>
                <button
                    onClick={async () => {
                        const token = localStorage.getItem('token');
                        if (!token) {
                            setToast({ message: 'Authentication Error: No session token found. Please log in again.', type: 'error', isVisible: true });
                            return;
                        }
                        try {
                            await api.post('/global-settings/seed/');
                            setToast({ message: 'Database seeded successfully!', type: 'success', isVisible: true });
                            fetchSettings();
                        } catch (e: any) {
                            console.error("Seed failed", e);
                            setToast({ message: `Failed to seed database: ${e.response?.data?.detail || e.message}`, type: 'error', isVisible: true });
                        }
                    }}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                    Seed Database Defaults
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 mb-8">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5 text-slate-500" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Global Settings</h1>
                            <p className="text-sm text-slate-500">Manage system-wide configurations</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 px-6">
                        <TabButton id="general" label="General" icon={SettingsIcon} />
                        <TabButton id="notifications" label="Notifications" icon={Bell} />
                        <TabButton id="maintenance" label="Maintenance" icon={Power} />
                    </div>

                    {/* Content */}
                    <div className="p-8">
                        {activeTab === 'general' && renderGeneralTab()}
                        {activeTab === 'notifications' && renderNotificationsTab()}
                        {activeTab === 'maintenance' && renderMaintenanceTab()}
                    </div>
                </div>
            </div >


            {toast.isVisible && (
                <Toast
                    message={toast.message}
                    type={toast.type as any}
                    isVisible={toast.isVisible}
                    onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
                />
            )
            }
        </div >
    );
}
