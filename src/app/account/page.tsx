import type { Metadata } from 'next';
import { AccountView } from '@/features/users/server';

export const metadata: Metadata = { title: 'Account' };

export default function Page() {
  return <AccountView />;
}
