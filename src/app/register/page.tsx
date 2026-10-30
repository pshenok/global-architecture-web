import type { Metadata } from 'next';
import { RegisterView } from '@/features/users/server';

export const metadata: Metadata = { title: 'Create your account' };

export default function Page(props: PageProps<'/register'>) {
  return <RegisterView searchParams={props.searchParams} />;
}
