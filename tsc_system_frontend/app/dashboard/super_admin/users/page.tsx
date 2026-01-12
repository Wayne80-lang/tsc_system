import type { Metadata } from 'next';
import UserManagementClient from './UserManagementClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'User Management',
    description: 'Manage users, roles, and access rights',
};

export default function UserManagementPage() {
    return <UserManagementClient />;
}
