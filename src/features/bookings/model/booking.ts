import type { HouseLookup } from '@/features/houses';
import type { Money } from '@/kernel/money';

export type BookingStatus = 'CONFIRMED' | 'CANCELLED';

export interface Booking {
  readonly id: string;
  readonly houseId: string;
  readonly guestId: string;
  readonly hostId: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guests: number;
  readonly totalPrice: Money;
  readonly status: BookingStatus;
  readonly createdAt: string;
  readonly cancelledAt: string | null;
}

/** Bookings as a guest (default) or of my houses as a host. */
export type BookingRole = 'guest' | 'host';

/** UX only: an upcoming or ongoing confirmed stay can be cancelled (the API decides). */
export const canCancel = (booking: Pick<Booking, 'status' | 'checkOut'>, todayUtc: string) =>
  booking.status === 'CONFIRMED' && booking.checkOut > todayUtc;

/** What to call a booking's house: its title, or why there is none. */
export function houseLabel(lookup: HouseLookup | undefined): string {
  if (lookup?.status === 'found') return lookup.house.title;
  return lookup?.status === 'gone' ? 'House no longer listed' : 'House details unavailable';
}
