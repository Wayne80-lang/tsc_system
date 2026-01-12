
import GlobalRegistry from './GlobalRegistryClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Global Registry',
    description: 'Unified view of all access requests',
};

export default function Page() {
    return <GlobalRegistry />;
}
