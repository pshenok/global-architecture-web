'use client';

import { useActionState, useRef, useState } from 'react';
import { addDays, isCalendarDate, nightsBetween } from '@/kernel/dates';
import { type FormState, IDLE } from '@/kernel/form-state';
import { DEFAULT_LOCALE } from '@/kernel/locale';
import { formatMoney, type Money } from '@/kernel/money';
import { TextField } from '@/ui/form/fields';
import { FormAlert } from '@/ui/form/form-alert';
import { SubmitButton } from '@/ui/form/submit-button';
import { useFocusFirstInvalid } from '@/ui/hooks/use-focus-first-invalid';
import type { BookingFormField } from '../model/forms';

/**
 * Native date inputs: values are already YYYY-MM-DD (no time zone to convert), they work
 * before hydration, and `min` is today in UTC, the API's rule. The estimate is a hint; the
 * API computes the price.
 */
export function BookingForm({
  action,
  houseId,
  maxGuests,
  nightlyPrice,
  todayUtc,
}: {
  action: (
    state: FormState<BookingFormField>,
    form: FormData,
  ) => Promise<FormState<BookingFormField>>;
  houseId: string;
  maxGuests: number;
  nightlyPrice: Money;
  todayUtc: string;
}) {
  const [state, formAction] = useActionState<FormState<BookingFormField>, FormData>(action, IDLE);
  const form = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(form, state);
  const echoed = state.status === 'error' ? state.values : {};
  const errors = state.status === 'error' ? state.fieldErrors : {};
  const [stay, setStay] = useState({
    checkIn: echoed.checkIn ?? '',
    checkOut: echoed.checkOut ?? '',
  });
  const nights =
    isCalendarDate(stay.checkIn) && isCalendarDate(stay.checkOut)
      ? nightsBetween(stay.checkIn, stay.checkOut)
      : 0;
  return (
    <form
      ref={form}
      action={formAction}
      className="grid gap-4"
      onChange={(event) => {
        const field = event.target;
        if (
          field instanceof HTMLInputElement &&
          (field.name === 'checkIn' || field.name === 'checkOut')
        ) {
          setStay((current) => ({ ...current, [field.name]: field.value }));
        }
      }}
    >
      <input type="hidden" name="houseId" value={houseId} />
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="checkIn"
          label="Check-in"
          type="date"
          required
          min={todayUtc}
          defaultValue={echoed.checkIn ?? ''}
          error={errors.checkIn}
        />
        <TextField
          name="checkOut"
          label="Check-out"
          type="date"
          required
          min={isCalendarDate(stay.checkIn) ? addDays(stay.checkIn, 1) : addDays(todayUtc, 1)}
          defaultValue={echoed.checkOut ?? ''}
          error={errors.checkOut}
        />
      </div>
      <TextField
        name="guests"
        label="Guests"
        type="number"
        required
        min={1}
        max={maxGuests}
        defaultValue={echoed.guests ?? '1'}
        hint={`Up to ${maxGuests}`}
        error={errors.guests}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {nights > 0
          ? `${nights} ${nights === 1 ? 'night' : 'nights'}, about ${formatMoney({ currencyCode: nightlyPrice.currencyCode, amountMinor: nightlyPrice.amountMinor * nights }, DEFAULT_LOCALE)}`
          : 'Choose your dates to see the price.'}
      </p>
      <div>
        <SubmitButton>Book</SubmitButton>
      </div>
    </form>
  );
}
