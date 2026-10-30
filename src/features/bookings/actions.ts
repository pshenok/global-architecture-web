'use server';

import { defineAction } from '@/platform/actions';
import * as bookings from './data/bookings.gateway';
import { BOOKING_MESSAGES, BookingForm, CANCEL_MESSAGES, CancelForm } from './model/forms';

export const createBooking = defineAction({
  access: 'user',
  input: BookingForm,
  messages: BOOKING_MESSAGES,
  run: async ({ caller }, input) => {
    const result = await bookings.createBooking(caller, input);
    return result.ok ? { kind: 'redirect', to: `/bookings/${result.value.id}` } : result;
  },
});

/** Cancelling twice is fine: BOOKING_ALREADY_CANCELLED counts as done. */
export const cancelBooking = defineAction({
  access: 'user',
  input: CancelForm,
  messages: CANCEL_MESSAGES,
  successCodes: ['BOOKING_ALREADY_CANCELLED'],
  run: async ({ caller }, { id }) => {
    const result = await bookings.cancelBooking(caller, id);
    return result.ok ? { kind: 'refresh', message: 'The booking is cancelled.' } : result;
  },
});
