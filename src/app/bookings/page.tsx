import type { Metadata } from 'next';
import { MyBookingsView } from '@/features/bookings/server';

export const metadata: Metadata = { title: 'Bookings' };

export default function Page(props: PageProps<'/bookings'>) {
  return <MyBookingsView searchParams={props.searchParams} />;
}
