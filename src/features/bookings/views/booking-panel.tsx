import 'server-only';
import { LogInIcon } from 'lucide-react';
import { getHouseSummary } from '@/features/houses/server';
import { todayUtc } from '@/kernel/dates';
import { getOptionalCaller } from '@/platform/session';
import { buttonVariants } from '@/ui/primitives/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/primitives/card';
import { createBooking } from '../actions';
import { BookingForm } from '../ui/booking-form';

/** The booking card on a house page (the app route composes it next to the house). */
export async function BookingPanelView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [house, caller] = await Promise.all([getHouseSummary(id), getOptionalCaller()]);
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>
          <h2>Book a stay</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {caller ? (
          <BookingForm
            action={createBooking}
            houseId={house.id}
            maxGuests={house.maxGuests}
            nightlyPrice={house.nightlyPrice}
            todayUtc={todayUtc()}
          />
        ) : (
          // A plain link: nothing may prefetch the login route.
          <a
            className={buttonVariants({ variant: 'outline' })}
            href={`/auth/login?returnTo=${encodeURIComponent(`/houses/${house.id}`)}`}
          >
            <LogInIcon aria-hidden="true" data-icon="inline-start" />
            Sign in to book
          </a>
        )}
      </CardContent>
    </Card>
  );
}
