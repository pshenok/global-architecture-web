import 'server-only';
import { TrashIcon, UsersIcon } from 'lucide-react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { formatInstant } from '@/kernel/dates';
import { DEFAULT_LOCALE } from '@/kernel/locale';
import { orInterrupt } from '@/platform/errors';
import { requireAdmin } from '@/platform/session';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { EmptyState } from '@/ui/empty-state';
import { PageHeader } from '@/ui/page-header';
import { Pager } from '@/ui/pager';
import { deleteUser } from '../actions';
import { getUser, listUsers } from '../data/users.gateway';
import { UsersTable } from '../ui/users-table';

const PageQuery = z.object({ pageToken: z.string().min(1).max(512).optional().catch(undefined) });

export async function AdminUsersView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { caller } = await requireAdmin();
  const { pageToken } = PageQuery.parse(await searchParams);
  const page = await orInterrupt(listUsers(caller, pageToken), { firstPage: '/admin/users' });
  return (
    <>
      <PageHeader title="Users" description="Everyone registered, newest first" />
      {page.items.length === 0 ? (
        <EmptyState icon={<UsersIcon aria-hidden="true" />} title="No users yet" />
      ) : (
        <UsersTable users={page.items} />
      )}
      <Pager
        path="/admin/users"
        query={{}}
        nextPageToken={page.nextPageToken}
        onFirstPage={!pageToken}
      />
    </>
  );
}

export async function AdminUserDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { caller, me } = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await orInterrupt(getUser(caller, id));
  return (
    <>
      <PageHeader
        title={user.fullName}
        description={user.email ?? 'No email'}
        actions={
          user.id === me.id ? null : (
            <ConfirmDialog
              action={deleteUser}
              fields={{ id: user.id }}
              trigger={
                <>
                  <TrashIcon aria-hidden="true" data-icon="inline-start" />
                  Delete user
                </>
              }
              title={`Delete ${user.fullName}?`}
              description="Their houses are removed and upcoming bookings cancelled. This cannot be undone."
              confirmLabel="Delete user"
            />
          )
        }
      />
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Roles</dt>
          <dd className="font-medium">{user.roles.length > 0 ? user.roles.join(', ') : 'user'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Joined</dt>
          <dd className="font-medium">{formatInstant(user.createdAt, DEFAULT_LOCALE)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Id</dt>
          <dd className="font-mono text-xs">{user.id}</dd>
        </div>
      </dl>
    </>
  );
}
