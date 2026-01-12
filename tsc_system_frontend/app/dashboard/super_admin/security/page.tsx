import type { Metadata } from 'next';
import SecurityPoliciesClient from './SecurityPoliciesClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Security Policies',
    description: 'Configure system-wide security policies',
};

export default function SecurityPoliciesPage() {
    return <SecurityPoliciesClient />;
}
