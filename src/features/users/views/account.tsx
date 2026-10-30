import 'server-only';
import { TrashIcon } from 'lucide-react';
import { requireUser } from '@/platform/session';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { PageHeader } from '@/ui/page-header';
import { Separator } from '@/ui/primitives/separator';
import { deleteAccount, renameAccount } from '../actions';
import { AccountForm } from '../ui/account-form';

export async function AccountView() {
  const { me } = await requireUser();
  return (
    <>
      <PageHeader title="Account" description={me.email ?? undefined} />
      <section aria-labelledby="profile-heading" className="mb-10">
        <h2 id="profile-heading" className="mb-4 font-heading text-lg font-medium">
          Profile
        </h2>
        <AccountForm action={renameAccount} fullName={me.fullName} />
      </section>
      <Separator className="mb-10" />
      <section aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="mb-2 font-heading text-lg font-medium">
          Delete account
        </h2>
        <p className="mb-4 max-w-prose text-sm text-muted-foreground">
          Your houses are removed and their upcoming bookings cancelled, and your own upcoming
          bookings are cancelled. You are signed out.
        </p>
        <ConfirmDialog
          action={deleteAccount}
          fields={{}}
          trigger={
            <>
              <TrashIcon aria-hidden="true" data-icon="inline-start" />
              Delete account
            </>
          }
          title="Delete your account?"
          description="This cannot be undone."
          confirmLabel="Delete account"
        />
      </section>
    </>
  );
}
