import type { Metadata } from 'next';
import NewRequestClient from './NewRequestClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'New Access Request',
    description: 'Submit detailed requests for system access',
};

export default function NewRequestPage() {
    return <NewRequestClient />;
}
