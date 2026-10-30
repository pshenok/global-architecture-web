import 'server-only';
import { getEnv } from '@/platform/config/env';
import { seal } from './codec';
import {
  type CookieWriter,
  cookieOptions,
  SESSION_COOKIE,
  TXN_COOKIE,
  TXN_MAX_AGE_S,
} from './cookies';
import { sessionKeys } from './keys';
import type { LoginTransaction, Session } from './schema';

/** Seals and sets the session; its cookie and its JWE both end at the absolute lifetime. */
export async function writeSession(
  jar: CookieWriter,
  session: Session,
  nowS: number,
): Promise<void> {
  const expiresAt = session.createdAt + getEnv().SESSION_MAX_AGE_S;
  const value = await seal('session', { ...session }, expiresAt, sessionKeys());
  jar.set(SESSION_COOKIE, value, cookieOptions(Math.max(0, expiresAt - nowS)));
}

export function clearSession(jar: CookieWriter): void {
  jar.delete(SESSION_COOKIE);
}

export async function writeTransaction(
  jar: CookieWriter,
  transaction: LoginTransaction,
  nowS: number,
): Promise<void> {
  const value = await seal('txn', { ...transaction }, nowS + TXN_MAX_AGE_S, sessionKeys());
  jar.set(TXN_COOKIE, value, cookieOptions(TXN_MAX_AGE_S));
}
