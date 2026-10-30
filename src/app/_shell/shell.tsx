import { LogInIcon, UserPlusIcon } from 'lucide-react';
import { type ReactNode, Suspense } from 'react';
import { UserMenu } from '@/features/users';
import { getOptionalCaller, getOptionalUser } from '@/platform/session';
import { AppShell } from '@/ui/app-shell';
import { Navigation } from '@/ui/navigation';
import { buttonVariants } from '@/ui/primitives/button';
import { NAV } from './nav';

const everyone = NAV.filter((entry) => entry.audience === 'everyone');

async function ShellNavigation() {
  const user = await getOptionalUser();
  const admin = user?.me.roles.includes('admin') ?? false;
  const entries = NAV.filter(
    (entry) =>
      entry.audience === 'everyone' ||
      (user && entry.audience === 'user') ||
      (admin && entry.audience === 'admin'),
  );
  return <Navigation entries={entries} />;
}

async function UserSlot() {
  const user = await getOptionalUser();
  if (user)
    return (
      <UserMenu
        name={user.me.fullName}
        email={user.me.email}
        admin={user.me.roles.includes('admin')}
      />
    );
  if (await getOptionalCaller()) {
    return (
      <a className={buttonVariants({ variant: 'outline' })} href="/register">
        <UserPlusIcon aria-hidden="true" data-icon="inline-start" />
        Finish sign-up
      </a>
    );
  }
  // A plain link: nothing may prefetch the login route.
  return (
    <a className={buttonVariants({ variant: 'outline' })} href="/auth/login">
      <LogInIcon aria-hidden="true" data-icon="inline-start" />
      Sign in
    </a>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      navigation={
        <Suspense fallback={<Navigation entries={everyone} />}>
          <ShellNavigation />
        </Suspense>
      }
      user={
        <Suspense fallback={null}>
          <UserSlot />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
