import 'server-only';
import type { Page } from '@/kernel/page';
import { PAGE_SIZE } from '@/kernel/page';
import { type ApiResult, api, type components, settle, withCaller } from '@/platform/api';
import type { Caller } from '@/platform/session';
import type { Booking, BookingRole } from '../model/booking';

type ApiBooking = components['schemas']['Booking'];

const toBooking = (booking: ApiBooking): Booking => ({
  id: booking.id,
  houseId: booking.houseId,
  guestId: booking.guestId,
  hostId: booking.hostId,
  checkIn: booking.checkIn,
  checkOut: booking.checkOut,
  guests: booking.guests,
  totalPrice: booking.totalPrice,
  status: booking.status,
  createdAt: booking.createdAt,
  cancelledAt: booking.cancelledAt,
});

export async function listBookings(
  caller: Caller,
  query: { as: BookingRole; pageToken?: string | undefined; houseId?: string },
): Promise<ApiResult<Page<Booking>>> {
  return settle(
    api().GET('/v1/bookings', {
      params: {
        query: {
          pageSize: PAGE_SIZE,
          as: query.as,
          ...(query.pageToken ? { pageToken: query.pageToken } : {}),
          ...(query.houseId ? { houseId: query.houseId } : {}),
        },
      },
      ...(await withCaller(caller)),
    }),
    (page) => ({ items: page.items.map(toBooking), nextPageToken: page.nextPageToken }),
  );
}

export async function getBooking(caller: Caller, id: string): Promise<ApiResult<Booking>> {
  return settle(
    api().GET('/v1/bookings/{id}', { params: { path: { id } }, ...(await withCaller(caller)) }),
    toBooking,
  );
}

export async function createBooking(
  caller: Caller,
  body: { houseId: string; checkIn: string; checkOut: string; guests: number },
): Promise<ApiResult<Booking>> {
  return settle(
    api().POST('/v1/bookings', { body, ...(await withCaller(caller, 'write')) }),
    toBooking,
  );
}

export async function cancelBooking(caller: Caller, id: string): Promise<ApiResult<Booking>> {
  return settle(
    api().POST('/v1/bookings/{id}/cancel', {
      params: { path: { id } },
      ...(await withCaller(caller, 'write')),
    }),
    toBooking,
  );
}
