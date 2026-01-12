"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function SessionTimeout() {
    const router = useRouter();
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [isEnabled, setIsEnabled] = useState(false);
    const [timeoutDuration, setTimeoutDuration] = useState(15 * 60 * 1000); // Default 15 mins

    console.log("--- SESSION TIMEOUT VERSION: STRICT-15-MIN ---");

    // 1. Check Policy on Mount
    useEffect(() => {
        const checkConfig = async () => {
            try {
                // Fetch Policies
                const policyRes = await api.get('/security-policies/');
                // Handle pagination if results exist, else use data directly
                const policies = policyRes.data.results || policyRes.data;
                const sessionPolicy = policies.find((p: any) => p.key === 'session_timeout');

                if (sessionPolicy && sessionPolicy.is_enabled) {
                    setIsEnabled(true);
                    setTimeoutDuration(15 * 60 * 1000); // Fixed 15 minutes as per requirement
                    console.log("Session Timeout Enabled: 15 minutes");
                } else {
                    setIsEnabled(false);
                    console.log("Session Timeout Disabled");
                }
            } catch (error) {
                console.error("Failed to fetch session config", error);
            }
        };

        if (localStorage.getItem('token')) {
            checkConfig();
        }
    }, []);

    // 2. Activity Listener
    useEffect(() => {
        if (!isEnabled) return;

        const updateActivity = () => setLastActivity(Date.now());

        window.addEventListener('mousemove', updateActivity);
        window.addEventListener('keydown', updateActivity);
        window.addEventListener('click', updateActivity);
        window.addEventListener('scroll', updateActivity);

        return () => {
            window.removeEventListener('mousemove', updateActivity);
            window.removeEventListener('keydown', updateActivity);
            window.removeEventListener('click', updateActivity);
            window.removeEventListener('scroll', updateActivity);
        };
    }, [isEnabled]);

    // 3. Timeout Checker
    useEffect(() => {
        if (!isEnabled) return;

        const interval = setInterval(() => {
            const now = Date.now();
            if (now - lastActivity > timeoutDuration) {
                performLogout();
            }
        }, 10000); // Check every 10 seconds

        return () => clearInterval(interval);
    }, [isEnabled, lastActivity, timeoutDuration, router]);

    const performLogout = async () => {
        try {
            await api.post('/logout/');
        } catch (e) {
            console.error("Logout failed", e);
        } finally {
            localStorage.removeItem('token');
            router.push('/');
        }
    };

    return null;
}
