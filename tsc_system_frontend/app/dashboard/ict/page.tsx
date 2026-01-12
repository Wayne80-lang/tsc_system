
import ICTDashboard from './IctDashboardClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'ICT Dashboard',
    description: 'Technical review and approval of access requests',
};

export default function Page() {
    return <ICTDashboard />;
}
