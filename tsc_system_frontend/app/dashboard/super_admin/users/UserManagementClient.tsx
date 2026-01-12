'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import axios from 'axios';
import { Search, Plus, Shield, Lock, Unlock, Edit2, X, Filter, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import Toast, { ToastType } from '@/components/ui/toast';
import PaginationControls from '@/components/ui/PaginationControls';

interface User {
    id: number;
    email: string;
    full_name: string;
    tsc_no: string;
    role: string;
    is_active: boolean;
    directorate_id?: number;
    directorate_name?: string;
    directorate?: number;
    system_assigned?: string;
    system_assigned_name?: string;
    role_directorate?: number;
    role_directorate_name?: string;
}

interface Directorate {
    id: number;
    name: string;
}

interface System {
    id: number;
    name: string;
    description?: string;
}

const ROLES = [
    { value: 'all', label: 'All Users' },
    { value: 'staff', label: 'Staff' },
    { value: 'hod', label: 'HOD' },
    { value: 'ict', label: 'ICT Director' },
    { value: 'sys_admin', label: 'System Admin' },
    { value: 'super_admin', label: 'Super Admin' },
];

function UserManagementContent() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [directorates, setDirectorates] = useState<Directorate[]>([]);
    const [systems, setSystems] = useState<System[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    // Debounce search
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Pagination State
    const [nextUrl, setNextUrl] = useState<string | null>(null);
    const [prevUrl, setPrevUrl] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        tsc_no: '',
        directorate: '',
        role: 'staff',
        role_directorate: '',
        system_assigned: '',
        is_active: true
    });

    const [processing, setProcessing] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
        message: '', type: 'info', isVisible: false
    });
    const showToast = (message: string, type: ToastType) => setToast({ message, type, isVisible: true });
    const hideToast = () => setToast(prev => ({ ...prev, isVisible: false }));

    const fetchUsers = async (url: string | null = null) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Token ${token}` };

            // Fetch dependencies if missing
            if (directorates.length === 0 || systems.length === 0) {
                try {
                    const [dirRes, sysRes] = await Promise.all([
                        api.get('/directorates/', { headers }),
                        api.get('/systems/available/', { headers }) // Corrected to fetch available list
                    ]);
                    setDirectorates(dirRes.data.results || dirRes.data);
                    setSystems(sysRes.data.results || sysRes.data);
                } catch (e) {
                    console.error("Failed to load dependencies", e);
                }
            }

            // Construct Endpoint
            // If URL is provided (pagination), use it directly via axios
            // If NOT provided, construct relative path with current filters via api
            let requestPromise;

            if (url) {
                requestPromise = axios.get(url, { headers });
            } else {
                const params = new URLSearchParams();
                if (debouncedSearch) params.set('search', debouncedSearch);
                if (roleFilter !== 'all') params.set('role', roleFilter);

                requestPromise = api.get(`/users/?${params.toString()}`, { headers });
            }

            const res = await requestPromise;

            if (res.data.results) {
                setUsers(res.data.results);
                setNextUrl(res.data.next);
                setPrevUrl(res.data.previous);
                setCount(res.data.count);
            } else {
                setUsers(res.data);
                setCount(res.data.length);
            }

        } catch (error) {
            console.error(error);
            showToast("Failed to load users.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (url: string | null, direction: 'next' | 'prev') => {
        if (!url) return;
        fetchUsers(url);
        setCurrentPage(p => direction === 'next' ? p + 1 : p - 1);
    };

    useEffect(() => {
        // Reset to page 1 when filters change
        setCurrentPage(1);
        fetchUsers();
    }, [debouncedSearch, roleFilter]);

    const resetForm = () => {
        setFormData({
            full_name: '',
            email: '',
            tsc_no: '',
            directorate: '',
            role: 'staff',
            role_directorate: '',
            system_assigned: '',
            is_active: true
        });
        setEditingUser(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            full_name: user.full_name,
            email: user.email,
            tsc_no: user.tsc_no || '',
            directorate: user.directorate?.toString() || user.directorate_id?.toString() || '',
            role: user.role || 'staff',
            role_directorate: user.role_directorate?.toString() || '',
            system_assigned: user.system_assigned || '',
            is_active: user.is_active
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Token ${token}` };

            const payload: any = {
                full_name: formData.full_name,
                email: formData.email,
                tsc_no: formData.tsc_no,
                directorate: formData.directorate || null,
                is_active: formData.is_active,
                // Flattened fields as expected by UserManagementSerializer
                role: formData.role,
                role_directorate: formData.role === 'hod' ? (formData.role_directorate || formData.directorate) : null,
                system_assigned: formData.role === 'sys_admin' ? formData.system_assigned : null
            };

            if (payload.directorate === '') payload.directorate = null;
            if (payload.userrole.directorate === '') payload.userrole.directorate = null;

            // Ensure numbers for IDs if present
            if (payload.directorate) payload.directorate = parseInt(payload.directorate);
            if (payload.role_directorate) payload.role_directorate = parseInt(payload.role_directorate);
            // System assigned uses string keys ('1', '2'), do not parse to int

            if (editingUser) {
                await api.put(`/users/${editingUser.id}/`, payload, { headers });
                showToast("User updated successfully.", "success");
            } else {
                await api.post('/users/', payload, { headers });
                showToast("User created successfully.", "success");
            }

            setIsModalOpen(false);
            fetchUsers();
            resetForm();
        } catch (error: any) {
            console.error("Save failed", error.response?.data);
            showToast("Failed to save user. Check Inputs.", "error");
        } finally {
            setProcessing(false);
        }
    };

    const handleToggleStatus = async (user: User) => {
        if (!confirm(`Are you sure you want to ${user.is_active ? 'BLOCK' : 'ACTIVATE'} this user?`)) return;

        try {
            const token = localStorage.getItem('token');
            await api.patch(`/users/${user.id}/`, { is_active: !user.is_active }, {
                headers: { Authorization: `Token ${token}` }
            });
            showToast(`User ${user.is_active ? 'blocked' : 'activated'}.`, "success");
            fetchUsers();
        } catch (error) {
            showToast("Failed to update status.", "error");
        }
    };

    const handleDelete = async (user: User) => {
        if (!confirm(`Are you sure you want to PERMANENTLY DELETE user ${user.full_name}? This action cannot be undone.`)) return;

        try {
            const token = localStorage.getItem('token');
            await api.delete(`/users/${user.id}/`, {
                headers: { Authorization: `Token ${token}` }
            });
            showToast("User deleted successfully.", "success");
            setUsers(prev => prev.filter(u => u.id !== user.id));
        } catch (error) {
            showToast("Failed to delete user.", "error");
        }
    };

    // Server-side filtering is now used, so we display 'users' directly
    const filteredUsers = users;

    return (
        <div className="min-h-screen pb-20 relative">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-xs font-bold text-tsc-gold uppercase tracking-[0.2em] mb-2">Administration</h2>
                    <h1 className="text-3xl font-black text-[#1e2a4a]">User Management</h1>
                    <p className="text-slate-500">Register new users, assign roles, and manage account status.</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-[#1e2a4a] text-white hover:bg-[#2B3A67]">
                    <Plus className="w-4 h-4 mr-2" /> Register User
                </Button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-64 space-y-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                            <Filter className="w-3 h-3 mr-2" /> Filter Roles
                        </h3>
                        <div className="space-y-1">
                            {ROLES.map(role => (
                                <button
                                    key={role.value}
                                    onClick={() => setRoleFilter(role.value)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex justify-between items-center ${roleFilter === role.value
                                        ? 'bg-[#1e2a4a] text-white shadow-md'
                                        : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {role.label}
                                    {roleFilter === role.value && <ChevronRight className="w-3 h-3 opacity-50" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 space-y-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or TSC number..."
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:border-tsc-blue focus:ring-4 focus:ring-tsc-blue/10 outline-none shadow-sm transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="p-4 font-bold text-slate-500 text-xs uppercase">User Details</th>
                                    <th className="p-4 font-bold text-slate-500 text-xs uppercase">Role</th>
                                    <th className="p-4 font-bold text-slate-500 text-xs uppercase">Directorate</th>
                                    <th className="p-4 font-bold text-slate-500 text-xs uppercase text-center">Status</th>
                                    <th className="p-4 font-bold text-slate-500 text-xs uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={5} className="p-12 text-center text-slate-400">Loading users...</td></tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr><td colSpan={5} className="p-12 text-center text-slate-400">No users found matching filters.</td></tr>
                                ) : filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs border border-slate-200">
                                                    {(user.full_name || 'U').charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[#1e2a4a] text-sm">{user.full_name}</div>
                                                    <div className="text-xs text-slate-500">{user.email}</div>
                                                    {user.tsc_no && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{user.tsc_no}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex px-2 py-1 rounded text-xs font-bold uppercase tracking-wide border ${user.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                user.role === 'sys_admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                                    user.role === 'ict' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        user.role === 'hod' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                            'bg-slate-50 text-slate-600 border-slate-100'
                                                }`}>
                                                {ROLES.find(r => r.value === user.role)?.label || user.role || 'Staff'}
                                            </span>
                                            {user.role === 'sys_admin' && (user.system_assigned_name || user.system_assigned) && (
                                                <div className="text-[10px] text-slate-500 mt-1 pl-1 border-l-2 border-slate-200">
                                                    Sys: {user.system_assigned_name || user.system_assigned}
                                                </div>
                                            )}
                                            {user.role === 'hod' && user.role_directorate_name && (
                                                <div className="text-[10px] text-slate-500 mt-1 pl-1 border-l-2 border-slate-200">
                                                    Dept: {user.role_directorate_name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">
                                            {user.directorate_name || directorates.find(d => d.id === user.directorate)?.name || '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            {user.is_active ? (
                                                <span className="inline-flex items-center gap-1 text-green-600 text-[10px] font-bold uppercase bg-green-50 px-2 py-1 rounded-full border border-green-100">
                                                    <Shield className="w-3 h-3" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-red-600 text-[10px] font-bold uppercase bg-red-50 px-2 py-1 rounded-full border border-red-100">
                                                    <Lock className="w-3 h-3" /> Blocked
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => handleOpenEdit(user)}>
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className={`h-8 w-8 rounded-lg ${user.is_active ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}
                                                onClick={() => handleToggleStatus(user)}
                                            >
                                                {user.is_active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                onClick={() => handleDelete(user)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls
                        currentPage={currentPage}
                        count={count}
                        nextUrl={nextUrl}
                        prevUrl={prevUrl}
                        loading={loading}
                        onPageChange={handlePageChange}
                    />
                </div>
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-lg rounded-2xl shadow-xl z-50 relative overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="font-bold text-lg text-[#1e2a4a]">{editingUser ? 'Edit User' : 'Register New User'}</h3>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">TSC Number</label>
                                        <input
                                            required
                                            className="w-full p-2 border border-slate-200 rounded text-sm text-slate-900 bg-white focus:border-tsc-blue outline-none"
                                            value={formData.tsc_no}
                                            onChange={e => setFormData({ ...formData, tsc_no: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                                        <input
                                            required
                                            className="w-full p-2 border border-slate-200 rounded text-sm text-slate-900 bg-white focus:border-tsc-blue outline-none"
                                            value={formData.full_name}
                                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                                    <input
                                        type="email" required
                                        className="w-full p-2 border border-slate-200 rounded text-sm text-slate-900 bg-white focus:border-tsc-blue outline-none"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Directorate (Department)</label>
                                    <select
                                        className="w-full p-2 border border-slate-200 rounded text-sm text-slate-900 bg-white focus:border-tsc-blue outline-none"
                                        value={formData.directorate}
                                        onChange={e => setFormData({ ...formData, directorate: e.target.value })}
                                    >
                                        <option value="">-- Select Directorate --</option>
                                        {directorates.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <label className="text-xs font-bold text-tsc-gold uppercase mb-2 block">System Role Assignment</label>
                                    <select
                                        className="w-full p-2 border border-slate-200 rounded text-sm text-slate-900 bg-white focus:border-tsc-blue outline-none mb-4"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="staff">Staff Member (Default)</option>
                                        <option value="hod">Directorate HOD</option>
                                        <option value="ict">ICT Director</option>
                                        <option value="sys_admin">System Administrator</option>
                                        <option value="super_admin">Super Administrator</option>
                                    </select>

                                    {formData.role === 'hod' && (
                                        <div className="space-y-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                            <label className="text-xs font-bold text-blue-700 uppercase">HOD For Directorate:</label>
                                            <select
                                                className="w-full p-2 border border-blue-200 rounded text-sm text-slate-900 bg-white outline-none"
                                                value={formData.role_directorate}
                                                onChange={e => setFormData({ ...formData, role_directorate: e.target.value })}
                                            >
                                                <option value="">Same as Primary Directorate</option>
                                                {directorates.map(d => (
                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-blue-600">This user will approve requests for this directorate.</p>
                                        </div>
                                    )}

                                    {formData.role === 'sys_admin' && (
                                        <div className="space-y-2 bg-purple-50 p-3 rounded-lg border border-purple-100">
                                            <label className="text-xs font-bold text-purple-700 uppercase">Assigned System:</label>
                                            <select
                                                className="w-full p-2 border border-purple-200 rounded text-sm text-slate-900 bg-white outline-none"
                                                value={formData.system_assigned}
                                                onChange={e => setFormData({ ...formData, system_assigned: e.target.value })}
                                            >
                                                <option value="">-- Select System --</option>
                                                {systems.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name || s.description || `System ${s.id}`}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={processing} className="bg-[#1e2a4a] text-white">
                                        {processing ? 'Saving...' : 'Save User'}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />
        </div>
    );
}

export default function UserManagementClient() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading User Management...</div>}>
            <UserManagementContent />
        </Suspense>
    );
}
