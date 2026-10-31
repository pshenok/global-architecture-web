'use client';

import { useActionState, useRef } from 'react';
import { type FormState, IDLE } from '@/kernel/form-state';
import { TextareaField, TextField } from '@/ui/form/fields';
import { FormAlert } from '@/ui/form/form-alert';
import { SubmitButton } from '@/ui/form/submit-button';
import { useFocusFirstInvalid } from '@/ui/hooks/use-focus-first-invalid';
import type { SampleItemFormField } from '../model/forms';

type Field = SampleItemFormField | 'id';

/** Create and edit: the Server Action arrives as a prop from the server parent. */
export function SampleItemForm({
  action,
  initial,
  sampleItemId,
  submitLabel,
}: {
  action: (state: FormState<Field>, form: FormData) => Promise<FormState<Field>>;
  initial: Readonly<Partial<Record<SampleItemFormField, string>>>;
  sampleItemId?: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState<Field>, FormData>(action, IDLE);
  const form = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(form, state);
  const errors = state.status === 'error' ? state.fieldErrors : {};
  const value = (field: SampleItemFormField) =>
    (state.status === 'error' ? state.values[field] : undefined) ?? initial[field] ?? '';
  return (
    <form ref={form} action={formAction} className="grid max-w-xl gap-5">
      {sampleItemId ? <input type="hidden" name="id" value={sampleItemId} /> : null}
      <FormAlert state={state} />
      <TextField
        name="name"
        label="Name"
        required
        maxLength={200}
        defaultValue={value('name')}
        error={errors.name}
      />
      <TextareaField
        name="description"
        label="Description"
        maxLength={2000}
        rows={4}
        defaultValue={value('description')}
        error={errors.description}
      />
      <div>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
