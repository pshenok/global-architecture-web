import 'server-only';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { getOptionalUser, getSignInEmail, requireCaller } from '@/platform/session';
import { PageHeader } from '@/ui/page-header';
import { registerUser } from '../actions';
import { safeLocalPath } from '../model/paths';
import { RegisterForm } from '../ui/register-form';

export async function RegisterView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCaller();
  const { returnTo } = await searchParams;
  const target = safeLocalPath(typeof returnTo === 'string' ? returnTo : undefined);
  if (await getOptionalUser()) redirect(target as Route);
  return (
    <>
      <PageHeader title="Create your account" description="One more step: tell us your name." />
      <RegisterForm action={registerUser} email={await getSignInEmail()} returnTo={target} />
    </>
  );
}
