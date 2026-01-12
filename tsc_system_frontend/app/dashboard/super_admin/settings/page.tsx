import type { Metadata } from 'next';
import GlobalSettingsClient from './GlobalSettingsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Global Settings',
    description: 'System-wide configuration settings',
};

export default function GlobalSettingsPage() {
    return <GlobalSettingsClient />;
}
