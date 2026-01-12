"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import Image from 'next/image';

export default function Login() {
    const router = useRouter();
    const [tscNo, setTscNo] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Clear any existing session on mount
        localStorage.removeItem('token');
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Get Token
            const tokenRes = await api.post('/token/', { username: tscNo, password });
            const token = tokenRes.data.token;
            localStorage.setItem('token', token);

            // 2. Get User Profile & Role
            const userRes = await api.get('/users/me/', {
                headers: { Authorization: `Token ${token}` }
            });
            const user = userRes.data;

            // 3. Redirect based on Role
            if (user.role === 'hod') {
                router.push('/dashboard/hod');
            } else if (user.role === 'ict') {
                router.push('/dashboard/ict');
            } else if (user.role === 'sys_admin') {
                router.push('/dashboard/sysadmin');
            } else if (user.role === 'super_admin') {
                router.push('/dashboard/super_admin');
            } else {
                router.push('/dashboard');
            }

        } catch (err: any) {
            console.error(err);
            if (err.response && err.response.data && err.response.data.non_field_errors) {
                setError(err.response.data.non_field_errors[0]);
            } else {
                setError('Invalid TSC Number or Password');
            }
            localStorage.removeItem('token');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900">
            {/* Left Side - Brand & Aesthetic */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900">
                {/* Richer, more dynamic gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-tsc-blue via-[#1e2a4a] to-slate-900 opacity-100 z-10" />

                {/* Decorative Elements for "Premium" feel */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-10 opacity-20">
                    <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-tsc-gold/30 via-transparent to-transparent animate-pulse" style={{ animationDuration: '10s' }} />
                </div>

                <div className="relative z-20 flex flex-col justify-center items-center w-full h-full text-white p-12 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="mb-8"
                    >
                        {/* Using the new logo without background container */}
                        <Image src="/logo-new.jpeg" alt="TSC Logo" width={200} height={200} className="w-auto h-48 object-contain drop-shadow-xl rounded-xl" />
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-4xl font-black tracking-tight mb-4 text-[#D4AF37] drop-shadow-md"
                    >
                        TSC System Access Request Portal
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-lg text-slate-300 max-w-lg font-light leading-relaxed"
                    >
                        System request and access management for Secretariat
                    </motion.p>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="w-full max-w-md space-y-8 bg-white dark:bg-slate-800 p-10 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700"
                >
                    <div className="text-center lg:text-left">
                        {/* Mobile Logo */}
                        <div className="lg:hidden flex justify-center mb-6">
                            <Image src="/logo-new.jpeg" alt="TSC Logo" width={80} height={80} className="w-auto h-20 mix-blend-multiply dark:mix-blend-normal" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Welcome Back</h2>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Please sign in with your Service details</p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">TSC Number</label>
                                <Input
                                    id="tscNo"
                                    type="text"
                                    required
                                    value={tscNo}
                                    onChange={(e) => setTscNo(e.target.value)}
                                    placeholder="Enter your TSC Number"
                                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-[#D4AF37] focus:ring-[#D4AF37] h-12"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-[#D4AF37] focus:ring-[#D4AF37] h-12"
                                />
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="rounded-md bg-red-50 p-3 text-sm text-red-500 text-center border border-red-100"
                            >
                                {error}
                            </motion.div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 text-base font-bold bg-[#D4AF37] hover:bg-yellow-500 text-[#2B3A67] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    metrics...
                                </span>
                            ) : "Sign In"}
                        </Button>
                    </form>

                    <div className="pt-4 text-center text-xs text-slate-400">
                        &copy; 2025 Teachers Service Commission. All rights reserved.
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
