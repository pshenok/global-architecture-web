import 'server-only';
import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { findHouseSummary } from '@/features/houses/server';
import { formatInstant, todayUtc } from '@/kernel/dates';
import { DEFAULT_LOCALE } from '@/kernel/locale';
import { orInterrupt } from '@/platform/errors';
import { requireUser } from '@/platform/session';
import { MoneyText } from '@/ui/money-text';
import { PageHeader } from '@/ui/page-header';
import { StayDates } from '@/ui/stay-dates';
import { cancelBooking } from '../actions';
import { getBooking } from '../data/bookings.gateway';
import { canCancel, houseLabel } from '../model/booking';
import { CancelBooking } from '../ui/cancel-booking';

export async function BookingDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { caller, me } = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  // Someone else's booking is a 404 from the API, before anything streams.
  const booking = await orInterrupt(getBooking(caller, id));
  const lookup = await findHouseSummary(booking.houseId);
  const house = lookup.status === 'found' ? lookup.house : undefined;
  const role = booking.guestId === me.id ? 'Your stay' : 'A stay at your house';
  return (
    <>
      <PageHeader title={houseLabel(lookup)} description={role} />
      <div className="mb-8">
        <CancelBooking
          action={cancelBooking}
          bookingId={booking.id}
          status={booking.status}
          cancellable={canCancel(booking, todayUtc())}
        />
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Stay</dt>
          <dd className="font-medium">
            <StayDates checkIn={booking.checkIn} checkOut={booking.checkOut} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Guests</dt>
          <dd className="font-medium">{booking.guests}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-medium">
            <MoneyText value={booking.totalPrice} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Booked</dt>
          <dd className="font-medium">{formatInstant(booking.createdAt, DEFAULT_LOCALE)}</dd>
        </div>
      </dl>
      {house ? (
        <p className="mt-8 text-sm">
          <Link className="underline underline-offset-4" href={`/houses/${house.id}` as Route}>
            View the house
          </Link>
        </p>
      ) : null}
    </>
  );
}
