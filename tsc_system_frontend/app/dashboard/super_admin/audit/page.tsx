import type { Metadata } from 'next';
import AuditLogsClient from './AuditLogsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Audit Logs',
    description: 'System-wide audit trail and security logs',
};

export default function AuditLogsPage() {
    return <AuditLogsClient />;
}
