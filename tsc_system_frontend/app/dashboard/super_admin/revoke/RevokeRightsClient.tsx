'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import api from '@/lib/api';
import { Search, Shield, AlertTriangle } from 'lucide-react';
import Toast, { ToastType } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import PaginationControls from '@/components/ui/PaginationControls';

function RevokeRightsContent() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [systems, setSystems] = useState<any[]>([]);
    const [filteredSystems, setFilteredSystems] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination State
    const [nextUrl, setNextUrl] = useState<string | null>(null);
    const [prevUrl, setPrevUrl] = useState<string | null>(null);
    const [count, setCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);

    const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);

    const fetchMySystems = async (url: string | null = null) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/');
                return;
            }

            // Target the global active assignments endpoint
            const endpoint = '/systems/active_assignments/';

            let fetchRequest;
            if (url) {
                if (url.startsWith('http')) {
                    fetchRequest = axios.get(url, { headers: { Authorization: `Token ${token}` } });
                } else {
                    let path = url;
                    if (path.startsWith('/api')) path = path.substring(4);
                    fetchRequest = api.get(path, { headers: { Authorization: `Token ${token}` } });
                }
            } else {
                fetchRequest = api.get(endpoint, { headers: { Authorization: `Token ${token}` } });
            }

            const response = await fetchRequest;

            if (response.data.results) {
                setSystems(response.data.results);
                setFilteredSystems(response.data.results);
                setNextUrl(response.data.next);
                setPrevUrl(response.data.previous);
                setCount(response.data.count);
            } else if (Array.isArray(response.data)) {
                // Fallback for flat array
                setSystems(response.data);
                setFilteredSystems(response.data);
                setCount(response.data.length);
            } else {
                // Unknown format or empty
                setSystems([]);
                setFilteredSystems([]);
                setCount(0);
            }
        } catch (error) {
            console.error('Failed to fetch systems', error);
            setToast({ message: 'Failed to load accessible systems.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMySystems();
    }, []);

    const handlePageChange = (url: string | null, direction: 'next' | 'prev') => {
        if (!url) return;
        fetchMySystems(url);
        setCurrentPage(p => direction === 'next' ? p + 1 : p - 1);
    };

    useEffect(() => {
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            setFilteredSystems(systems.filter(s =>
                s.system_name.toLowerCase().includes(lower) ||
                (s.user_name && s.user_name.toLowerCase().includes(lower)) ||
                (s.tsc_no && s.tsc_no.toLowerCase().includes(lower))
            ));
        } else {
            setFilteredSystems(systems);
        }
    }, [searchTerm, systems]);

    const handleRevoke = async (systemId: number) => {
        if (!confirm('Are you sure you want to revoke access to this system? This action cannot be undone immediately.')) return;

        try {
            const token = localStorage.getItem('token');
            // Assuming there's an endpoint to revoke or deactivate
            // Using /requests/ with type='deactivate' is the standard flow, 
            // but if there's a direct action:
            // api.post(`/systems/${systemId}/revoke/`) ...
            // For now, redirecting to New Request with type=deactivate is safer as per models
            router.push(`/dashboard/new?type=deactivate&system=${systemId}`);
        } catch (error) {
            setToast({ message: 'Failed to initiate revocation.', type: 'error' });
        }
    };

    return (
        <div className="max-w-5xl mx-auto pb-12">
            <h1 className="text-3xl font-bold text-[#2B3A67] mb-2">Global Access Revocation</h1>
            <p className="text-slate-500 mb-8">Manage and revoke system access for all users across the organization.</p>

            {/* Search */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 flex items-center gap-4">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search by User, TSC No, or System..."
                    className="flex-1 bg-transparent outline-none text-slate-700"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSystems.map((sys: any) => (
                    <div key={sys.system_id} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Shield className="h-24 w-24 text-[#2B3A67]" />
                        </div>

                        <div className="relative z-10">
                            <h3 className="font-bold text-[#2B3A67] text-lg mb-1">{sys.system_name}</h3>
                            <div className="text-sm font-bold text-slate-700 mb-1">{sys.user_name}</div>
                            <div className="text-xs font-mono text-slate-500 mb-4 flex items-center gap-2">
                                <span className="bg-slate-100 px-2 py-0.5 rounded">{sys.tsc_no}</span>
                                <span className="text-slate-300">|</span>
                                <span>{sys.directorate}</span>
                            </div>

                            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-6">
                                <span className={`w-2 h-2 rounded-full bg-green-500`} />
                                Active since {new Date(sys.granted_date).toLocaleDateString()}
                            </div>

                            <Button
                                variant="destructive"
                                className="w-full gap-2"
                                onClick={() => handleRevoke(sys.system_code)}
                            >
                                <AlertTriangle className="h-4 w-4" />
                                <span className="font-semibold">Revoke Access</span>
                            </Button>
                        </div>
                    </div>
                ))}

                {filteredSystems.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center text-slate-500">
                        No active systems found.
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            <div className="mt-8">
                <PaginationControls
                    currentPage={currentPage}
                    count={count}
                    pageSize={10}
                    nextUrl={nextUrl}
                    prevUrl={prevUrl}
                    loading={loading}
                    onPageChange={handlePageChange}
                />
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} isVisible={true} />}
        </div>
    );
}

export default function RevokeRightsClient() {
    return (
        <Suspense fallback={<div className="p-12 text-center text-slate-500">Loading Systems...</div>}>
            <RevokeRightsContent />
        </Suspense>
    );
}
