import { CircleAlertIcon, LogInIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/ui/empty-state';
import { buttonVariants } from '@/ui/primitives/button';

export const metadata: Metadata = { title: 'Sign-in problem' };

/** Known codes only: the provider's error_description is never reflected. */
const MESSAGES: Readonly<Record<string, string>> = {
  LOGIN_EXPIRED: 'The sign-in took too long or was started in another tab. Start again.',
  LOGIN_FAILED: 'The sign-in could not be completed. Start again.',
  IDP_ACCESS_DENIED: 'The sign-in was cancelled.',
  IDP_LOGIN_REQUIRED: 'Sign in to continue.',
  IDP_UNAVAILABLE: 'The sign-in service is unavailable. Try again in a moment.',
  IDP_ERROR: 'The sign-in service refused the request. Start again.',
  API_REJECTED_TOKEN: 'The service does not accept this sign-in provider. Contact support.',
  API_UNAVAILABLE: 'You are signed in, but the service is unavailable. Try again in a moment.',
  SESSION_TOO_LARGE: 'The sign-in provider sent more than this site can keep. Contact support.',
};

export default async function Page(props: PageProps<'/auth/error'>) {
  const { code } = await props.searchParams;
  const message =
    (typeof code === 'string' && MESSAGES[code]) || 'The sign-in could not be completed.';
  return (
    <>
      <h1 className="sr-only">Sign-in problem</h1>
      <EmptyState
        icon={<CircleAlertIcon aria-hidden="true" />}
        title="Sign-in problem"
        description={message}
        action={
          <a className={buttonVariants({ variant: 'outline' })} href="/auth/login">
            <LogInIcon aria-hidden="true" data-icon="inline-start" />
            Sign in again
          </a>
        }
      />
    </>
  );
}
