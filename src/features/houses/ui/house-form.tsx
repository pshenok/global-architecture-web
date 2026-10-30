'use client';

import { useActionState, useRef } from 'react';
import { type FormState, IDLE } from '@/kernel/form-state';
import { CURRENCIES } from '@/kernel/money';
import { SelectField, TextareaField, TextField } from '@/ui/form/fields';
import { FormAlert } from '@/ui/form/form-alert';
import { SubmitButton } from '@/ui/form/submit-button';
import { useFocusFirstInvalid } from '@/ui/hooks/use-focus-first-invalid';
import type { HouseFormField } from '../model/house-form';

type Field = HouseFormField | 'id';

/** Create and edit: the Server Action arrives as a prop from the server parent. */
export function HouseForm({
  action,
  initial,
  houseId,
  submitLabel,
}: {
  action: (state: FormState<Field>, form: FormData) => Promise<FormState<Field>>;
  initial: Readonly<Partial<Record<HouseFormField, string>>>;
  houseId?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState<Field>, FormData>(action, IDLE);
  const form = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(form, state);
  const errors = state.status === 'error' ? state.fieldErrors : {};
  const value = (field: HouseFormField) =>
    (state.status === 'error' ? state.values[field] : undefined) ?? initial[field] ?? '';
  return (
    <form ref={form} action={formAction} className="grid max-w-xl gap-5" noValidate={false}>
      {houseId ? <input type="hidden" name="id" value={houseId} /> : null}
      <FormAlert state={state} />
      <TextField
        name="title"
        label="Title"
        required
        maxLength={200}
        defaultValue={value('title')}
        error={errors.title}
      />
      <TextareaField
        name="description"
        label="Description"
        maxLength={5000}
        rows={4}
        defaultValue={value('description')}
        error={errors.description}
      />
      <TextField
        name="line1"
        label="Street address"
        required
        maxLength={200}
        autoComplete="street-address"
        defaultValue={value('line1')}
        error={errors.line1}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          name="city"
          label="City"
          required
          maxLength={100}
          autoComplete="address-level2"
          defaultValue={value('city')}
          error={errors.city}
        />
        <TextField
          name="countryCode"
          label="Country code"
          required
          pattern="[A-Za-z]{2}"
          maxLength={2}
          autoComplete="country"
          hint="Two letters, e.g. UA"
          defaultValue={value('countryCode')}
          error={errors.countryCode}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField
          name="price"
          label="Price per night"
          required
          inputMode="decimal"
          defaultValue={value('price')}
          error={errors.price}
        />
        <SelectField
          name="currencyCode"
          label="Currency"
          options={CURRENCIES.map((code) => ({ value: code, label: code }))}
          defaultValue={value('currencyCode') || 'USD'}
          error={errors.currencyCode}
        />
        <TextField
          name="maxGuests"
          label="Guests"
          type="number"
          required
          min={1}
          max={50}
          defaultValue={value('maxGuests')}
          error={errors.maxGuests}
        />
      </div>
      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
