import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import type { FormState } from '@/kernel/form-state';
import { Alert, AlertDescription } from '@/ui/primitives/alert';

/**
 * The one live region of a form: role="alert" for an error summary, role="status" for a
 * success message. Field errors are shown under their fields without a role of their own.
 */
export function FormAlert({ state }: { state: FormState }) {
  if (state.status === 'idle' || (state.status === 'success' && !state.message)) return null;
  if (state.status === 'success') {
    return (
      <Alert role="status" data-slot="form-alert" tabIndex={-1}>
        <CircleCheckIcon aria-hidden="true" />
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive" role="alert" data-slot="form-alert" tabIndex={-1}>
      <CircleAlertIcon aria-hidden="true" />
      <AlertDescription>
        {state.message}
        {state.signIn ? (
          <>
            {' '}
            {/* A plain link: nothing may prefetch the login route. */}
            <a className="font-medium underline underline-offset-4" href="/auth/login">
              Sign in
            </a>
          </>
        ) : null}
        {state.requestId ? (
          <span className="block text-xs text-muted-foreground">Reference: {state.requestId}</span>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
