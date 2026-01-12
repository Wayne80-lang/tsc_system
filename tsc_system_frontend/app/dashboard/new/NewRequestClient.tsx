"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft,
    Save,
    Check,
    ChevronDown,
    Sparkles,
    Shield,
    User,
    Monitor
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// Copied from models.py
const SYSTEM_CHOICES = [
    { value: '1', label: 'Active Directory' },
    { value: '2', label: 'CRM' },
    { value: '3', label: 'EDMS' },
    { value: '4', label: 'Email' },
    { value: '5', label: 'Help Desk' },
    { value: '6', label: 'HRMIS' },
    { value: '7', label: 'IDEA' },
    { value: '8', label: 'IFMIS' },
    { value: '9', label: 'Knowledge Base' },
    { value: '10', label: 'Services' },
    { value: '11', label: 'Teachers Online' },
    { value: '12', label: 'TeamMate' },
    { value: '13', label: 'TPAD' },
    { value: '14', label: 'TPAY' },
    { value: '15', label: 'Pydio' }
];

interface Directorate {
    id: number;
    name: string;
}

function NewRequestContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [directorates, setDirectorates] = useState<Directorate[]>([]);
    const [mySystems, setMySystems] = useState<string[]>([]); // URLs of active systems ID
    const [submitting, setSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        tsc_no: '',
        email: '',
        designation: '',
        directorate: '',
        request_type: 'new',
        requested_systems: [] as string[]
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            const headers = { Authorization: `Token ${token}` };

            // Fetch basic data
            api.get('/directorates/', { headers })
                .then(res => {
                    // Check for pagination
                    if (res.data.results) {
                        setDirectorates(res.data.results);
                    } else {
                        setDirectorates(res.data);
                    }
                })
                .catch(err => console.error("Failed to fetch directorates", err));

            // Fetch My Systems and User Data
            Promise.all([
                api.get('/users/me/', { headers }).catch(e => ({ data: {} })),
                api.get('/users/my_systems/', { headers }).catch(e => ({ data: [] }))
            ]).then(([userRes, systemsRes]) => {
                const user = userRes.data;
                const activeSystemIds = systemsRes.data.map((s: any) => s.system);
                setMySystems(activeSystemIds);

                // Initialize Form
                const urlType = searchParams.get('type');
                const urlSystem = searchParams.get('system');

                // Smart Default Request Type
                let defaultType = 'new';
                if (activeSystemIds.length > 0) {
                    defaultType = 'modify';
                }
                if (urlType && ['new', 'modify', 'deactivate'].includes(urlType)) {
                    defaultType = urlType;
                }

                setFormData(prev => ({
                    ...prev,
                    tsc_no: user.tsc_no || '',
                    email: user.email || '',
                    directorate: user.directorate_id ? String(user.directorate_id) : '',
                    request_type: defaultType,
                    requested_systems: urlSystem ? [urlSystem] : []
                }));
            });
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.requested_systems.length === 0) {
            alert("Please select at least one system.");
            return;
        }
        setSubmitting(true);
        const payload = {
            ...formData,
            requested_systems: formData.requested_systems.map(sys => ({ system: sys }))
        };

        try {
            const token = localStorage.getItem('token');
            await api.post('/requests/', payload, {
                headers: { Authorization: `Token ${token}` }
            });
            setShowSuccessModal(true);
        } catch (error: any) {
            console.error('Submission failed', error);
            alert('Failed to submit request. Please check your inputs.');
            setSubmitting(false);
        }
    };

    const toggleSystem = (value: string) => {
        setFormData(prev => {
            const systems = prev.requested_systems.includes(value)
                ? prev.requested_systems.filter(s => s !== value)
                : [...prev.requested_systems, value];
            return { ...prev, requested_systems: systems };
        });
    };

    // Filter Systems based on Request Type
    const getAvailableSystems = () => {
        if (formData.request_type === 'deactivate') {
            // Can only deactivate systems I HAVE
            return SYSTEM_CHOICES.filter(s => mySystems.includes(s.value));
        } else if (formData.request_type === 'modify') {
            // 'Modify' usually means ADD new rights to existing user
            // So show systems I DON'T have
            return SYSTEM_CHOICES.filter(s => !mySystems.includes(s.value));
        } else {
            // 'New' - technically for fresh users, but if they select it, maybe show all or just systems they dont have
            // User rules: "if the user has never been given right to any system at all will use new"
            // If they are using 'new' but have systems, we should probably treat it like 'modify' in terms of choices
            return SYSTEM_CHOICES.filter(s => !mySystems.includes(s.value));
        }
    };

    const availableSystems = getAvailableSystems();

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2
            }
        }
    };

    const itemVariants: Variants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.4, ease: "easeOut" }
        }
    };

    return (
        <div className="max-w-5xl mx-auto pb-12">
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8"
            >
                <Link href="/dashboard" className="inline-flex items-center text-slate-500 hover:text-[#2B3A67] transition-colors group">
                    <div className="p-2 rounded-full bg-white group-hover:bg-[#2B3A67]/5 mr-2 transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-sm">Back to Dashboard</span>
                </Link>
            </motion.div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
                {/* Header Section */}
                <motion.div variants={itemVariants} className="lg:col-span-12 mb-4">
                    <h1 className="text-4xl font-extrabold text-[#2B3A67] tracking-tight mb-2">
                        {formData.request_type === 'deactivate' ? 'Revoke Access' : 'New System Access'}
                    </h1>
                    <p className="text-slate-500 text-lg">
                        {formData.request_type === 'deactivate'
                            ? 'Submit a request to remove rights from specific systems.'
                            : 'Submit a formal request for system privileges and permissions.'}
                    </p>
                </motion.div>

                {/* Main Form Area */}
                <motion.div variants={itemVariants} className="lg:col-span-8 space-y-8">
                    <form onSubmit={handleSubmit}>
                        {/* User Details Card */}
                        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group hover:shadow-2xl transition-all duration-300 mb-8">
                            <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-[#D4AF37] to-[#F2D06B]" />
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                <User className="h-32 w-32 text-[#2B3A67]" />
                            </div>

                            <h2 className="text-lg font-bold text-[#2B3A67] mb-6 flex items-center gap-3">
                                <div className="p-2 bg-[#2B3A67]/5 rounded-lg">
                                    <User className="h-5 w-5 text-[#2B3A67]" />
                                </div>
                                Personal Details
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">TSC Number</label>
                                    <Input
                                        value={formData.tsc_no}
                                        readOnly
                                        className="bg-slate-800 border-transparent font-mono text-white focus:ring-0 cursor-not-allowed opacity-100"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                                    <Input
                                        value={formData.email}
                                        readOnly
                                        className="bg-slate-800 border-transparent text-white focus:ring-0 cursor-not-allowed opacity-100"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Directorate</label>
                                    <div className="relative">
                                        <select
                                            className="flex h-11 w-full rounded-xl border border-transparent bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none cursor-not-allowed appearance-none opacity-100 disabled:opacity-100 disabled:text-white"
                                            value={formData.directorate}
                                            disabled
                                        >
                                            <option value="">Loading Directorate...</option>
                                            {directorates.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Request Details Card */}
                        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative group hover:shadow-2xl transition-all duration-300">
                            {/* Decorative Background Container - Clipped */}
                            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-[#2B3A67] to-[#1e2a4a]" />
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Monitor className="h-32 w-32 text-[#2B3A67]" />
                                </div>
                            </div>

                            <div className="relative z-10">
                                <h2 className="text-lg font-bold text-[#2B3A67] mb-6 flex items-center gap-3">
                                    <div className="p-2 bg-[#2B3A67]/5 rounded-lg">
                                        <Shield className="h-5 w-5 text-[#2B3A67]" />
                                    </div>
                                    Access Requirements
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-[#2B3A67] uppercase tracking-wider">Official Designation</label>
                                        <Input
                                            value={formData.designation}
                                            onChange={e => setFormData({ ...formData, designation: e.target.value })}
                                            required
                                            placeholder="e.g. Senior ICT Director"
                                            className="h-11 !bg-white border-slate-200 !text-black placeholder:text-slate-400 focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 rounded-xl transition-all font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-[#2B3A67] uppercase tracking-wider">Request Type</label>
                                        <div className="relative">
                                            <select
                                                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/10 appearance-none transition-all"
                                                value={formData.request_type}
                                                onChange={e => {
                                                    setFormData({ ...formData, request_type: e.target.value, requested_systems: [] });
                                                    // Clear selection when changing type to avoid invalid states
                                                }}
                                            >
                                                <option value="new">New User Creation</option>
                                                <option value="modify">Modify Existing Access</option>
                                                <option value="deactivate">Deactivate/Revoke Access</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3" ref={dropdownRef}>
                                    <label className="text-xs font-bold text-[#2B3A67] uppercase tracking-wider flex items-center gap-2">
                                        Target Systems <span className="text-[#D4AF37] text-[10px] bg-[#D4AF37]/10 px-2 py-0.5 rounded-full">Required</span>
                                    </label>

                                    <div className="relative">
                                        <div
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                            className={`
                                                min-h-[56px] w-full rounded-xl border bg-white px-4 py-3 cursor-pointer transition-all duration-200
                                                ${isDropdownOpen ? 'border-[#D4AF37] ring-4 ring-[#D4AF37]/10' : 'border-slate-200 hover:border-[#D4AF37]/50'}
                                            `}
                                        >
                                            <div className="flex flex-wrap gap-2">
                                                {formData.requested_systems.length === 0 && (
                                                    <span className="text-slate-400 text-sm my-auto">Select one or more systems...</span>
                                                )}
                                                {formData.requested_systems.map(sysValue => {
                                                    const label = SYSTEM_CHOICES.find(s => s.value === sysValue)?.label || sysValue;
                                                    return (
                                                        <motion.span
                                                            layout
                                                            key={sysValue}
                                                            initial={{ opacity: 0, scale: 0.8 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2B3A67] px-3 py-1.5 text-xs font-semibold text-white shadow-sm ring-1 ring-white/20"
                                                        >
                                                            {label}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); toggleSystem(sysValue); }}
                                                                className="rounded-full hover:bg-white/20 p-0.5 transition-colors"
                                                            >
                                                                <div className="h-3 w-3 relative">
                                                                    <div className="absolute inset-0 bg-white rotate-45 transform h-[1px] top-1/2" />
                                                                    <div className="absolute inset-0 bg-white -rotate-45 transform h-[1px] top-1/2" />
                                                                </div>
                                                            </button>
                                                        </motion.span>
                                                    );
                                                })}
                                            </div>
                                            <div className="absolute right-4 top-4">
                                                <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-[#D4AF37]' : ''}`} />
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {isDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    className="absolute z-50 mt-2 w-full max-h-[300px] overflow-y-auto rounded-xl bg-white shadow-2xl ring-1 ring-slate-200 py-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
                                                >
                                                    {availableSystems.length === 0 ? (
                                                        <div className="p-4 text-center text-slate-500 text-sm">
                                                            {formData.request_type === 'deactivate'
                                                                ? "You don't have any active systems to revoke."
                                                                : "You already have access to all available systems."}
                                                        </div>
                                                    ) : (
                                                        availableSystems.map(system => {
                                                            const isSelected = formData.requested_systems.includes(system.value);
                                                            return (
                                                                <div
                                                                    key={system.value}
                                                                    onClick={() => toggleSystem(system.value)}
                                                                    className={`
                                                                        relative cursor-pointer py-3 px-4 flex items-center justify-between transition-colors
                                                                        ${isSelected ? 'bg-[#2B3A67]/5' : 'hover:bg-slate-50'}
                                                                    `}
                                                                >
                                                                    <span className={`text-sm ${isSelected ? 'font-bold text-[#2B3A67]' : 'text-slate-800'}`}>
                                                                        {system.label}
                                                                    </span>
                                                                    {isSelected && (
                                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                                                            <Check className="h-4 w-4 text-[#D4AF37]" />
                                                                        </motion.div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6">
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="bg-[#2B3A67] hover:bg-[#1e2a4a] text-white px-8 py-6 rounded-xl text-lg font-bold shadow-lg shadow-[#2B3A67]/20 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 min-w-[200px]"
                            >
                                {submitting ? (
                                    <div className="flex items-center gap-2">
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Processing...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Save className="h-5 w-5" />
                                        <span>Submit Request</span>
                                    </div>
                                )}
                            </Button>
                        </div>
                    </form>
                </motion.div>

                {/* Sidebar / Info Panel */}
                <motion.div variants={itemVariants} className="lg:col-span-4 space-y-6">
                    <div className="bg-gradient-to-br from-[#2B3A67] to-[#1e2a4a] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Sparkles className="h-40 w-40" />
                        </div>
                        <h3 className="text-xl font-bold text-[#D4AF37] mb-4">Request Guidelines</h3>
                        <ul className="space-y-4 text-sm text-slate-200 relative z-10">
                            <li className="flex gap-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] mt-2 flex-shrink-0" />
                                Ensure your designation matches your official employment records.
                            </li>
                            <li className="flex gap-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] mt-2 flex-shrink-0" />
                                Select all systems required for your role. Justification may be required by the HOD.
                            </li>
                            <li className="flex gap-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] mt-2 flex-shrink-0" />
                                Requests trigger an automated approval workflow: HOD &rarr; ICT &rarr; System Admin.
                            </li>
                        </ul>
                    </div>

                    <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Need Help?</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            If you are unsure which systems to select, please contact the ICT Help Desk.
                        </p>
                        <div className="flex items-center gap-2 text-[#2B3A67] font-semibold text-sm cursor-pointer hover:underline">
                            <span className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">?</span>
                            Contact Support
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            {/* Success Modal */}
            <AnimatePresence>
                {showSuccessModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#2B3A67] via-[#D4AF37] to-[#2B3A67]" />

                            <div className="mb-6 flex justify-center">
                                <div className="h-20 w-20 bg-green-50 rounded-full flex items-center justify-center border-4 border-green-100">
                                    <Check className="h-10 w-10 text-green-600" />
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-[#2B3A67] mb-2">Request Submitted!</h2>
                            <p className="text-slate-600 mb-6">
                                Your system access request has been successfully processed.
                                <br />
                                <span className="font-semibold text-[#2B3A67]">An email notification has been sent</span> to the relevant approvers.
                            </p>

                            <Button
                                onClick={() => router.push('/dashboard')}
                                className="w-full bg-[#2B3A67] hover:bg-[#1e2a4a] text-white py-6 rounded-xl text-lg font-bold shadow-lg shadow-[#2B3A67]/20"
                            >
                                Return to Dashboard
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function NewRequestClient() {
    return (
        <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2B3A67]" /></div>}>
            <NewRequestContent />
        </Suspense>
    );
}
