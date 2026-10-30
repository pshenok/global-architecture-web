import type { NavEntry } from '@/ui/app-shell';

export type { Booking } from './model/booking';

export const nav: readonly NavEntry[] = [
  { href: '/bookings', label: 'Bookings', audience: 'user' },
];
