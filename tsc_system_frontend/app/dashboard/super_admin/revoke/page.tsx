import type { Metadata } from 'next';
import RevokeRightsClient from './RevokeRightsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Revoke Access',
    description: 'Manage and revoke your system access rights',
};

export default function RevokeRightsPage() {
    return <RevokeRightsClient />;
}
