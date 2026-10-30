import type { Metadata } from 'next';
import { BookingDetailView } from '@/features/bookings/server';

export const metadata: Metadata = { title: 'Booking' };

export default function Page(props: PageProps<'/bookings/[id]'>) {
  return <BookingDetailView params={props.params} />;
}
