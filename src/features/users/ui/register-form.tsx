'use client';

import { useActionState, useRef } from 'react';
import { type FormState, IDLE } from '@/kernel/form-state';
import { TextField } from '@/ui/form/fields';
import { FormAlert } from '@/ui/form/form-alert';
import { SubmitButton } from '@/ui/form/submit-button';
import { useFocusFirstInvalid } from '@/ui/hooks/use-focus-first-invalid';

type Field = 'fullName' | 'returnTo';

export function RegisterForm({
  action,
  email,
  returnTo,
}: {
  action: (state: FormState<Field>, form: FormData) => Promise<FormState<Field>>;
  email: string | undefined;
  returnTo: string;
}) {
  const [state, formAction] = useActionState<FormState<Field>, FormData>(action, IDLE);
  const form = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(form, state);
  const errors = state.status === 'error' ? state.fieldErrors : {};
  return (
    <form ref={form} action={formAction} className="grid max-w-md gap-5">
      <input type="hidden" name="returnTo" value={returnTo} />
      <FormAlert state={state} />
      {email ? (
        <TextField
          name="email-display"
          label="Email"
          value={email}
          readOnly
          disabled
          hint="From your sign-in provider; it cannot be changed here."
        />
      ) : null}
      <TextField
        name="fullName"
        label="Your name"
        required
        maxLength={200}
        autoComplete="name"
        defaultValue={state.status === 'error' ? state.values.fullName : ''}
        error={errors.fullName}
      />
      <div>
        <SubmitButton>Create account</SubmitButton>
      </div>
    </form>
  );
}
