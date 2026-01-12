
import Login from '@/components/auth/Login';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to access TSC systems',
};

export default function Page() {
  return <Login />;
}
