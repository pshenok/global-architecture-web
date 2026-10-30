import 'server-only';
import type { Route } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getEnv } from '@/platform/config/env';
import { currentPath } from '@/platform/http/request-context';
import { log } from '@/platform/observability/log';
import { type Caller, mintCaller } from './caller';
import { unseal } from './codec';
import { SESSION_COOKIE } from './cookies';
import { sessionKeys } from './keys';
import { isAlive, isExpired, nowSeconds } from './policy';
import { type Session, SessionV1 } from './schema';

/** The sign-in service could not renew an expired access token; error.tsx offers a retry. */
export class IdentityUnavailableError extends Error {
  override readonly name = 'IdentityUnavailableError';
  constructor() {
    super('the sign-in service is unavailable; the session could not be renewed');
  }
}

/** Opens a sealed session cookie value (proxy and render share this). */
export async function openSession(
  value: string | undefined,
  nowS: number,
): Promise<Session | null> {
  if (!value) return null;
  const unsealed = await unseal('session', value, sessionKeys(), nowS);
  if (!unsealed.ok) {
    if (unsealed.reason !== 'expired')
      log.info('session cookie refused', { reason: unsealed.reason });
    return null;
  }
  const parsed = SessionV1.safeParse(unsealed.payload);
  if (!parsed.success) {
    log.info('session cookie refused', { reason: 'schema' });
    return null;
  }
  return isAlive(parsed.data, nowS, getEnv().SESSION_MAX_AGE_S) ? parsed.data : null;
}

/** This request's session (after any refresh the proxy did), once per render. */
export const getSession = cache(
  async (): Promise<Session | null> =>
    openSession((await cookies()).get(SESSION_COOKIE)?.value, nowSeconds()),
);

/** The caller, or null when signed out or the access token has expired. */
export async function getOptionalCaller(): Promise<Caller | null> {
  const session = await getSession();
  return session && !isExpired(session, nowSeconds()) ? mintCaller(session) : null;
}

export async function loginPath(): Promise<string> {
  return `/auth/login?returnTo=${encodeURIComponent(await currentPath())}`;
}

/**
 * The caller of a page that needs a session: signed out goes to sign-in; an expired token
 * the proxy could not renew (IdP down) throws IdentityUnavailableError.
 */
export async function requireCaller(): Promise<Caller> {
  const session = await getSession();
  if (!session) redirect((await loginPath()) as Route);
  if (isExpired(session, nowSeconds())) throw new IdentityUnavailableError();
  return mintCaller(session);
}
