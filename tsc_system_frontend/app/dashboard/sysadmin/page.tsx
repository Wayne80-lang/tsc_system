
import SysAdminDashboard from './SysAdminDashboardClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'System Admin Dashboard',
    description: 'Provision access and manage system rights',
};

export default function Page() {
    return <SysAdminDashboard />;
}
