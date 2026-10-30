import type { Metadata } from 'next';
import { AdminUsersView } from '@/features/users/server';

export const metadata: Metadata = { title: 'Users' };

export default function Page(props: PageProps<'/admin/users'>) {
  return <AdminUsersView searchParams={props.searchParams} />;
}
