'use client';

import { useActionState, useRef } from 'react';
import { type FormState, IDLE } from '@/kernel/form-state';
import { TextField } from '@/ui/form/fields';
import { FormAlert } from '@/ui/form/form-alert';
import { SubmitButton } from '@/ui/form/submit-button';
import { useFocusFirstInvalid } from '@/ui/hooks/use-focus-first-invalid';

export function AccountForm({
  action,
  fullName,
}: {
  action: (state: FormState<'fullName'>, form: FormData) => Promise<FormState<'fullName'>>;
  fullName: string;
}) {
  const [state, formAction] = useActionState<FormState<'fullName'>, FormData>(action, IDLE);
  const form = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(form, state);
  return (
    <form ref={form} action={formAction} className="grid max-w-md gap-5">
      <FormAlert state={state} />
      <TextField
        name="fullName"
        label="Name"
        required
        maxLength={200}
        autoComplete="name"
        defaultValue={(state.status === 'error' ? state.values.fullName : undefined) ?? fullName}
        error={state.status === 'error' ? state.fieldErrors.fullName : undefined}
      />
      <div>
        <SubmitButton>Save</SubmitButton>
      </div>
    </form>
  );
}
