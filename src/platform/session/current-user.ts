import 'server-only';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { type ApiResult, settle, withCaller } from '@/platform/api/call';
import { api } from '@/platform/api/client';
import { orInterrupt, registerPath } from '@/platform/errors/interrupts';
import type { Caller } from './caller';
import { getOptionalCaller, requireCaller } from './read';

/** The signed-in platform user (GET /v1/users/me), read once per request. */
export interface Me {
  readonly id: string;
  readonly email: string | null;
  readonly fullName: string;
  readonly roles: readonly string[];
}

/** The one API call the platform owns. */
export async function fetchMe(caller: Caller): Promise<ApiResult<Me>> {
  return settle(
    api().GET('/v1/users/{id}', { params: { path: { id: 'me' } }, ...(await withCaller(caller)) }),
    (user) => ({ id: user.id, email: user.email, fullName: user.fullName, roles: user.roles }),
  );
}

const meOfRequest = cache(async (): Promise<{ caller: Caller; result: ApiResult<Me> } | null> => {
  const caller = await getOptionalCaller();
  return caller ? { caller, result: await fetchMe(caller) } : null;
});

/**
 * The user, or null when signed out, not registered yet, or the API cannot say. Safe on
 * public pages and in the shell: it never redirects or throws.
 */
export async function getOptionalUser(): Promise<{ caller: Caller; me: Me } | null> {
  const current = await meOfRequest();
  return current?.result.ok ? { caller: current.caller, me: current.result.value } : null;
}

/** The user of a page that needs one: signed out signs in, unregistered registers. */
export async function requireUser(): Promise<{ caller: Caller; me: Me }> {
  const caller = await requireCaller();
  const current = await meOfRequest();
  const result = current?.result ?? (await fetchMe(caller));
  if (!result.ok && result.problem.code === 'USER_NOT_REGISTERED')
    redirect((await registerPath()) as Route);
  return { caller, me: await orInterrupt(result) };
}

/** An admin page: anyone else gets a 404 (the API refuses them too). */
export async function requireAdmin(): Promise<{ caller: Caller; me: Me }> {
  const user = await requireUser();
  if (!user.me.roles.includes('admin')) notFound();
  return user;
}
