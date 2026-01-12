import { motion } from 'framer-motion';
import { DashboardStats } from '@/types';

interface StatsCardsProps {
    stats: DashboardStats;
    role: 'hod' | 'ict' | 'sys_admin' | 'super_admin';
}

export default function StatsCards({ stats, role }: StatsCardsProps) {
    const cards = [
        {
            label: role === 'super_admin' ? 'Total Pending Requests' : 'Pending Approvals',
            value: stats.pending_systems || 0,
            icon: (
                <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ),
            bg: role === 'super_admin' ? 'bg-gradient-to-br from-[#D4AF37] to-[#8a701f]' : 'bg-gradient-to-br from-[#2B3A67] to-[#1e2a4a]', // Gold for Super Admin
            text: 'text-white'
        },
        {
            label: 'Overdue Requests',
            value: stats.overdue_requests || 0,
            icon: (
                <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            ),
            bg: 'bg-white',
            text: 'text-slate-700',
            border: true
        },
        {
            label: 'Actioned Today',
            value: stats.reviewed_today || 0,
            icon: (
                <svg className="w-8 h-8 text-tsc-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ),
            bg: 'bg-white',
            text: 'text-slate-700',
            border: true
        }
    ];

    // History Stats (Show when viewing Overview/History?)
    // For now, let's just stick to the top 3 cards for consistency.
    // Super Admin explicitly wants "Global Overview".

    if (role === 'super_admin') {
        cards.push({
            label: 'Total History',
            value: stats.total_history || 0,
            icon: (
                <svg className="w-8 h-8 text-tsc-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            ),
            bg: 'bg-white',
            text: 'text-slate-700',
            border: true
        });
    }

    const gridCols = role === 'super_admin'
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        : 'grid-cols-1 sm:grid-cols-3';

    return (
        <div className={`grid ${gridCols} gap-6`}>
            {cards.map((card, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`${card.bg} rounded-2xl p-6 ${card.text} shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 ${card.border ? 'border border-slate-100' : ''}`}
                >
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className={`text-sm font-semibold uppercase tracking-wider ${card.text === 'text-white' ? 'text-white/80' : 'text-slate-500'}`}>{card.label}</p>
                            <h3 className="text-4xl font-extrabold mt-2 tracking-tight">{card.value}</h3>
                        </div>
                        <div className={`p-3 rounded-xl ${card.text === 'text-white' ? 'bg-white/20' : 'bg-slate-100'}`}>
                            {card.icon}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
