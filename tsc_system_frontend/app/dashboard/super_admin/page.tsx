
import SuperAdminDashboard from './SuperAdminDashboardClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Super Admin Dashboard',
    description: 'Overview of system activity and user management',
};

export default function Page() {
    return <SuperAdminDashboard />;
}
