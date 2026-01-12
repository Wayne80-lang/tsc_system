
import HodDashboard from './HodDashboardClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'HOD Dashboard',
    description: 'Review and approve access requests for your directorate',
};

export default function Page() {
    return <HodDashboard />;
}
