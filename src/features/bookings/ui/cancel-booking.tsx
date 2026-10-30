'use client';

import { BanIcon } from 'lucide-react';
import { useActionState, useOptimistic, useRef } from 'react';
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
import { StatusBadge } from '@/ui/status-badge';
import type { BookingStatus } from '../model/booking';

/**
 * The booking's status with the cancel control: the badge turns to Cancelled at once
 * (optimistic) and settles when the action returns; a failure restores it with a message.
 */
export function CancelBooking({
  action,
  bookingId,
  status,
  cancellable,
}: {
  action: (state: FormState<'id'>, form: FormData) => Promise<FormState<'id'>>;
  bookingId: string;
  status: BookingStatus;
  cancellable: boolean;
}) {
  const [shown, setShown] = useOptimistic(status);
  const [state, formAction] = useActionState<FormState<'id'>, FormData>(async (previous, form) => {
    setShown('CANCELLED');
    return action(previous, form);
  }, IDLE);
  const form = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(form, state);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge status={shown} />
      {cancellable && shown === 'CONFIRMED' ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
            <BanIcon aria-hidden="true" data-icon="inline-start" />
            Cancel booking
          </AlertDialogTrigger>
          <AlertDialogContent>
            <form ref={form} action={formAction} className="contents">
              <input type="hidden" name="id" value={bookingId} />
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                <AlertDialogDescription>
                  The dates become free for others. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep booking</AlertDialogCancel>
                <SubmitButton variant="destructive">Cancel booking</SubmitButton>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      {state.status === 'error' ? <FormAlert state={state} /> : null}
    </div>
  );
}
