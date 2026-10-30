'use client';

import { type ReactNode, useActionState, useRef } from 'react';
import { type FormState, IDLE } from '@/kernel/form-state';
import { FormAlert } from '@/ui/form/form-alert';
import { SubmitButton } from '@/ui/form/submit-button';
import { useFocusFirstInvalid } from '@/ui/hooks/use-focus-first-invalid';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/ui/primitives/alert-dialog';
import { Button } from '@/ui/primitives/button';

/**
 * A destructive action behind an AlertDialog: the confirm button submits a form to the
 * Server Action (passed in by the server parent), so it also works before hydration.
 */
export function ConfirmDialog({
  action,
  fields,
  trigger,
  title,
  description,
  confirmLabel,
}: {
  action: (state: FormState<never>, form: FormData) => Promise<FormState<never>>;
  fields: Readonly<Record<string, string>>;
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
}) {
  const [state, formAction] = useActionState<FormState<never>, FormData>(action, IDLE);
  const form = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(form, state);
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <form ref={form} action={formAction} className="contents">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <FormAlert state={state} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <SubmitButton variant="destructive">{confirmLabel}</SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
