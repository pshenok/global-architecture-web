import type { Route } from 'next';
import Link from 'next/link';
import type { HouseLookup } from '@/features/houses';
import { MoneyText } from '@/ui/money-text';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/primitives/table';
import { StatusBadge } from '@/ui/status-badge';
import { StayDates } from '@/ui/stay-dates';
import { type Booking, houseLabel } from '../model/booking';

export function BookingsTable({
  bookings,
  houses,
}: {
  bookings: readonly Booking[];
  houses: ReadonlyMap<string, HouseLookup>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>House</TableHead>
          <TableHead>Stay</TableHead>
          <TableHead>Guests</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => {
          const house = houses.get(booking.houseId);
          return (
            <TableRow key={booking.id}>
              <TableCell>
                <Link
                  className="font-medium underline-offset-4 hover:underline"
                  href={`/bookings/${booking.id}` as Route}
                >
                  {houseLabel(house)}
                </Link>
              </TableCell>
              <TableCell>
                <StayDates checkIn={booking.checkIn} checkOut={booking.checkOut} />
              </TableCell>
              <TableCell>{booking.guests}</TableCell>
              <TableCell>
                <MoneyText value={booking.totalPrice} />
              </TableCell>
              <TableCell>
                <StatusBadge status={booking.status} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
