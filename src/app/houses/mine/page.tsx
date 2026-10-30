import type { Metadata } from 'next';
import { MyHousesView } from '@/features/houses/server';

export const metadata: Metadata = { title: 'My houses' };

export default function Page(props: PageProps<'/houses/mine'>) {
  return <MyHousesView searchParams={props.searchParams} />;
}
