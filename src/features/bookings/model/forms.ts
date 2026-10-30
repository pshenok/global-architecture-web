import { z } from 'zod';
import { isCalendarDate, nightsBetween } from '@/kernel/dates';
import type { ApiProblem, KnownProblemCode } from '@/kernel/problem-codes';

/** The monolith's limit (bookings module MAX_NIGHTS); the API stays the authority. */
export const MAX_NIGHTS = 30;

const calendarDate = (label: string) =>
  z.string().refine(isCalendarDate, `Choose the ${label} date`);

export const BookingForm = z
  .object({
    houseId: z.uuid(),
    checkIn: calendarDate('check-in'),
    checkOut: calendarDate('check-out'),
    guests: z
      .string()
      .min(1, 'Enter how many guests')
      .transform(Number)
      .pipe(z.number().int('A whole number').min(1, 'At least 1').max(50, 'At most 50')),
  })
  .superRefine((form, ctx) => {
    const nights = nightsBetween(form.checkIn, form.checkOut);
    if (
      isCalendarDate(form.checkIn) &&
      isCalendarDate(form.checkOut) &&
      (nights < 1 || nights > MAX_NIGHTS)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['checkOut'],
        message: `Check-out is 1 to ${MAX_NIGHTS} nights after check-in`,
      });
    }
  });

export const CancelForm = z.object({ id: z.uuid() });

export type BookingFormField = Extract<keyof z.input<typeof BookingForm>, string>;

export const BOOKING_MESSAGES = {
  BOOKING_DATES_UNAVAILABLE: {
    field: 'checkIn',
    message: 'The house is already booked for some of these dates.',
  },
  BOOKING_TOO_MANY_GUESTS: {
    field: 'guests',
    message: (problem: ApiProblem) =>
      `This house sleeps at most ${problem.metadata.maxGuests ?? 'fewer'} guests.`,
  },
  BOOKING_HOUSE_NOT_FOUND: 'This house is no longer listed.',
  BOOKING_GUEST_NOT_FOUND: 'Your account no longer exists. Sign in again.',
  BOOKING_NOT_FOUND: 'This booking no longer exists.',
} satisfies Partial<
  Record<
    KnownProblemCode,
    string | { field: BookingFormField; message: string | ((problem: ApiProblem) => string) }
  >
>;

export const CANCEL_MESSAGES = {
  BOOKING_NOT_FOUND: 'This booking no longer exists.',
} satisfies Partial<Record<KnownProblemCode, string>>;
