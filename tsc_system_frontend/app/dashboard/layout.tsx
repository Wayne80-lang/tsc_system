"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    PlusCircle,
    LogOut,
    Menu,
    X,
    UserCircle,
    ChevronRight,
    CheckCircle,
    FileText,
    Users,
    Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState('');
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const token = localStorage.getItem('token');
                if (token) {
                    const response = await api.get('/users/me/', {
                        headers: { Authorization: `Token ${token}` }
                    });
                    const name = response.data.first_name || response.data.email?.split('@')[0] || 'User';
                    setUserName(name);

                    // Format role for display
                    const rawRole = response.data.role || 'staff';
                    // Map backend roles to display titles
                    const roleMap: Record<string, string> = {
                        'hod': 'HOD',
                        'ict': 'ICT Director',
                        'sys_admin': 'System Admin',
                        'super_admin': 'Administrator',
                        'staff': 'Staff Member'
                    };
                    setUserRole(roleMap[rawRole] || 'System User');
                }
            } catch (error) {
                console.error('Failed to fetch user', error);
            }
        };
        fetchUser();
    }, []);

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

    // Dynamic Navigation based on Role
    let navigation = [
        { name: 'My Requests', href: '/dashboard', icon: LayoutDashboard },
        { name: 'New Request', href: '/dashboard/new', icon: PlusCircle },
    ];

    if (userRole === 'HOD') {
        navigation = [
            { name: 'Approvals', href: '/dashboard/hod', icon: LayoutDashboard },
            { name: 'History', href: '/dashboard/hod?tab=history', icon: CheckCircle }, // Assuming you handle query params in tab logic
        ];
    } else if (userRole === 'ICT Director') {
        navigation = [
            { name: 'ICT Dashboard', href: '/dashboard/ict', icon: LayoutDashboard },
            { name: 'All Requests', href: '/dashboard/ict?tab=history', icon: CheckCircle },
        ];
    } else if (userRole === 'System Admin') {
        navigation = [
            { name: 'SysAdmin Tasks', href: '/dashboard/sysadmin', icon: LayoutDashboard },
            { name: 'Task History', href: '/dashboard/sysadmin?tab=history', icon: CheckCircle },
            { name: 'Manage Access', href: '/dashboard/sysadmin?tab=manage', icon: Shield },
        ];
    } else if (userRole === 'Administrator') {
        navigation = [
            { name: 'Overview', href: '/dashboard/super_admin', icon: LayoutDashboard },
            { name: 'Global Registry', href: '/dashboard/super_admin/requests', icon: FileText },
            { name: 'User Management', href: '/dashboard/super_admin/users', icon: Users },
            { name: 'Revoke Rights', href: '/dashboard/super_admin/revoke', icon: Shield },
        ];
    }

    // Helper to determine active state including query params
    const isLinkActive = (href: string) => {
        const [linkPath, linkQuery] = href.split('?');
        if (pathname !== linkPath) return false;

        // If link has query params, they must match current URL params
        if (linkQuery) {
            const currentTab = searchParams.get('tab');
            const linkTab = new URLSearchParams(linkQuery).get('tab');
            return currentTab === linkTab;
        }

        // If link has NO query params, current URL must NOT have 'tab' param (or be empty)
        // This ensures 'Approvals' (no tab) is not active when 'History' (?tab=history) is active
        const currentTab = searchParams.get('tab');
        return !currentTab;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Mobile Header */}
            <div className="lg:hidden flex items-center justify-between p-4 bg-gradient-to-r from-[#2B3A67] to-[#1e2a4a] text-white shadow-md">
                <div className="flex items-center space-x-3">
                    <div className="p-1 bg-white/10 rounded-lg backdrop-blur-sm">
                        <Image src="/logo-new.jpeg" alt="TSC Logo" width={32} height={32} className="w-8 h-8 object-contain rounded-md" />
                    </div>
                    <span className="font-bold text-lg text-[#D4AF37]">TSC System Access</span>
                </div>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    {isSidebarOpen ? <X className="text-white" /> : <Menu className="text-white" />}
                </button>
            </div>

            <div className="flex h-screen overflow-hidden">
                {/* Sidebar - Desktop */}
                <aside className="hidden lg:flex flex-col w-72 bg-gradient-to-b from-[#2B3A67] to-[#1e2a4a] text-white shadow-2xl z-20 border-r border-white/5">
                    <div className="flex flex-col items-center justify-center pt-10 pb-8 px-6 text-center border-b border-white/10 mx-4 mb-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative w-24 h-24 mb-4 bg-white/10 rounded-2xl p-4 backdrop-blur-sm shadow-xl ring-1 ring-white/20 flex items-center justify-center group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-[#D4AF37]/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Image src="/logo-new.jpeg" alt="TSC Logo" width={80} height={80} className="w-full h-full object-contain drop-shadow-lg" />
                        </motion.div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#D4AF37] to-[#F2D06B] tracking-tight">TSC SYSTEM</h1>
                        <p className="text-xs text-slate-300 font-medium tracking-[0.2em] uppercase mt-1 opacity-80">Access Portal</p>
                    </div>

                    <nav className="flex-1 px-4 space-y-3 py-4">
                        {navigation.map((item) => {
                            const isActive = isLinkActive(item.href);
                            return (
                                <Link key={item.name} href={item.href}>
                                    <div className={`
                                        relative group flex items-center px-5 py-3.5 rounded-full transition-all duration-300
                                        ${isActive
                                            ? 'bg-gradient-to-r from-white/15 to-white/5 text-[#D4AF37] font-bold shadow-lg ring-1 ring-white/10 backdrop-blur-md'
                                            : 'text-slate-300 hover:bg-white/5 hover:text-white hover:pl-6'
                                        }
                                    `}>
                                        <item.icon className={`mr-3 h-5 w-5 transition-colors ${isActive ? 'text-[#D4AF37]' : 'text-slate-400 group-hover:text-white'}`} />
                                        <span className="flex-1">{item.name}</span>
                                        {isActive && (
                                            <motion.div layoutId="activeDot" className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                                        )}
                                        {!isActive && <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-50 -ml-4 group-hover:ml-0 transition-all" />}
                                    </div>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 mt-auto">
                        <div className="bg-[#121b33]/60 rounded-2xl p-4 border border-white/5 backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
                                <div className="p-2 bg-gradient-to-br from-[#D4AF37] to-[#b39023] rounded-full shadow-lg">
                                    <UserCircle className="h-5 w-5 text-[#2B3A67]" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold text-white truncate">{userName || 'Loading...'}</p>
                                    <p className="text-xs text-slate-400 truncate uppercase tracking-wider">{userRole || 'System User'}</p>
                                </div>
                            </div>
                            <Button
                                onClick={handleLogout}
                                variant="ghost"
                                className="w-full justify-start text-red-300 hover:text-red-100 hover:bg-red-500/10 rounded-xl group"
                            >
                                <LogOut className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                                <span className="font-medium">Sign Out</span>
                            </Button>
                        </div>
                    </div>
                </aside>

                {/* Sidebar - Mobile Overlay */}
                <AnimatePresence>
                    {isSidebarOpen && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.5 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsSidebarOpen(false)}
                                className="fixed inset-0 bg-black z-30 lg:hidden"
                            />
                            <motion.aside
                                initial={{ x: '-100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '-100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed inset-y-0 left-0 w-72 bg-[#2B3A67] text-white z-40 lg:hidden flex flex-col shadow-2xl"
                            >
                                <div className="p-6 flex items-center justify-between border-b border-white/10">
                                    <span className="font-bold text-xl text-[#D4AF37]">Menu</span>
                                    <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                                <nav className="flex-1 px-4 py-8 space-y-2">
                                    {navigation.map((item) => {
                                        const isActive = pathname === item.href.split('?')[0];
                                        return (
                                            <Link key={item.name} href={item.href} onClick={() => setIsSidebarOpen(false)}>
                                                <div className={`
                                                    flex items-center px-4 py-3.5 rounded-xl transition-all
                                                    ${isActive ? 'bg-[#D4AF37] text-[#2B3A67] font-bold shadow-lg' : 'text-slate-100 hover:bg-white/10'}
                                                `}>
                                                    <item.icon className="mr-3 h-5 w-5" />
                                                    {item.name}
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </nav>
                                <div className="p-6 border-t border-white/10">
                                    <Button
                                        onClick={handleLogout}
                                        variant="ghost"
                                        className="w-full justify-start text-red-300 hover:text-red-100 hover:bg-red-900/20"
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Sign Out
                                    </Button>
                                </div>
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto bg-slate-50 relative">
                    {/* Top decoration/gradient for main content */}
                    <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#eef2ff] to-transparent pointer-events-none" />

                    <div className="max-w-7xl mx-auto p-4 lg:p-10 relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                        >
                            {children}
                        </motion.div>
                    </div>
                </main>
            </div>
        </div>
    );
}
