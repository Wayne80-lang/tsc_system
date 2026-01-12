
import Dashboard from './DashboardClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Staff Dashboard',
    description: 'Manage your system access requests and view status',
};

export default function Page() {
    return <Dashboard />;
}