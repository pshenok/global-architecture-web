import type { Metadata } from 'next';
import { AdminUserDetailView } from '@/features/users/server';

export const metadata: Metadata = { title: 'User' };

export default function Page(props: PageProps<'/admin/users/[id]'>) {
  return <AdminUserDetailView params={props.params} />;
}
