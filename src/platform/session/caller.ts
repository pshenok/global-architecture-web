import 'server-only';
import type { Session } from './schema';

/**
 * Who an API call acts as. Opaque on purpose: the access token is in a module-private
 * WeakMap, never a property, so nothing can serialize, log or pass it to the browser.
 * Views, actions and gateways take a Caller as their first argument, like the monolith's
 * controllers pass currentUser() to every use case.
 */
declare const brand: unique symbol;

export interface Caller {
  readonly [brand]: true;
  /** The login's subject at the IdP (not the platform user id). */
  readonly subject: string;
}

const tokens = new WeakMap<object, string>();

/** platform/session and platform/auth only. */
export function mintCaller(session: Pick<Session, 'at' | 'sub'>): Caller {
  const caller = Object.freeze({ subject: session.sub });
  tokens.set(caller, session.at);
  return caller as unknown as Caller;
}

/** The Authorization header for the API. platform/api/call.ts only (R10). */
export function authorizationHeader(caller: Caller): string {
  const token = tokens.get(caller);
  if (token === undefined) throw new Error('not a Caller minted by platform/session');
  return `Bearer ${token}`;
}
