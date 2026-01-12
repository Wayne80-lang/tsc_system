"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, Home, PlusCircle } from 'lucide-react';

export default function Navbar() {
    const router = useRouter();

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                await fetch('http://localhost:8000/api/logout/', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Logout failed', error);
        } finally {
            localStorage.removeItem('token');
            router.push('/');
        }
    };

    return (
        <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">TSC Access</span>
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            <Link href="/dashboard" className="inline-flex items-center px-1 pt-1 border-b-2 border-indigo-500 text-sm font-medium text-slate-900 dark:text-slate-100">
                                Dashboard
                            </Link>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <Button variant="ghost" size="sm" onClick={handleLogout} className="flex items-center gap-2">
                            <LogOut className="h-4 w-4" />
                            Sign out
                        </Button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
