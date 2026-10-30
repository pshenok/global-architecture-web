import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { refreshGrant } from '@/platform/auth/oidc';
import { type Env, getEnv } from '@/platform/config/env';
import { log } from '@/platform/observability/log';
import { SESSION_COOKIE } from '@/platform/session/cookies';
import { nowSeconds, refreshDue } from '@/platform/session/policy';
import { openSession } from '@/platform/session/read';
import { createRefresher, type RefreshOutcome } from '@/platform/session/refresh';
import type { Session } from '@/platform/session/schema';
import { clearSession, writeSession } from '@/platform/session/write';
import { buildCsp, newNonce } from './csp';
import { csrfProblem, SAFE_METHODS, sameOrigin } from './csrf';
import { classify } from './public-routes';

/**
 * Every request (src/proxy.ts), in this order:
 * 1. CSRF: an unsafe method needs Origin === APP_ORIGIN, before any session work.
 * 2. Request context: a fresh nonce CSP and request id (inbound x-request-id and x-gaw-*
 *    are overwritten), and the path for returnTo.
 * 3. Session: open the cookie; refresh the access token when due (the only place that
 *    refreshes: its cookie is visible to this same render).
 * 4. Route gate: a page GET without a session goes to sign-in, unless the route is public.
 * 5. Pass through with the cookie writes and the identical CSP on the response.
 * The proxy never calls the API.
 */
export interface ProxyDeps {
  readonly env: Env;
  readonly now: () => number;
  readonly refresh: (session: Session) => Promise<RefreshOutcome>;
  readonly nonce: () => string;
  readonly requestId: () => string;
}

let refresher: ((session: Session) => Promise<RefreshOutcome>) | undefined;

export function defaultDeps(): ProxyDeps {
  refresher ??= createRefresher({ grant: refreshGrant, now: () => Date.now() });
  return {
    env: getEnv(),
    now: nowSeconds,
    refresh: refresher,
    nonce: newNonce,
    requestId: () => crypto.randomUUID(),
  };
}

const SESSIONLESS = /^\/(?:auth\/|healthz$)/;

export async function runProxy(
  request: NextRequest,
  deps: ProxyDeps = defaultDeps(),
): Promise<NextResponse> {
  const { env } = deps;
  const { pathname, search } = request.nextUrl;

  if (
    !SAFE_METHODS.has(request.method) &&
    !sameOrigin(request.headers.get('origin'), env.APP_ORIGIN)
  ) {
    log.warn('cross-origin request refused', { method: request.method, path: pathname });
    return csrfProblem() as NextResponse;
  }

  const nonce = deps.nonce();
  const requestId = deps.requestId();
  const csp = buildCsp({
    nonce,
    issuerOrigin: new URL(env.OIDC_ISSUER).origin,
    https: env.APP_ORIGIN.startsWith('https://'),
    dev: env.NODE_ENV === 'development',
  });
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) if (name.startsWith('x-gaw-')) headers.delete(name);
  headers.set('content-security-policy', csp);
  headers.set('x-request-id', requestId);
  headers.set('x-gaw-path', `${pathname}${search}`);

  let session: Session | null = null;
  let write: Session | 'clear' | undefined;
  if (!SESSIONLESS.test(pathname)) {
    const now = deps.now();
    const value = request.cookies.get(SESSION_COOKIE)?.value;
    session = await openSession(value, now);
    if (value && !session) write = 'clear';
    if (session && refreshDue(session, now)) {
      const outcome = await deps.refresh(session);
      if (outcome.kind === 'refreshed') {
        session = outcome.session;
        write = session;
      } else if (outcome.kind === 'ended') {
        log.info('session ended at refresh', { reason: outcome.reason, requestId });
        session = null;
        write = 'clear';
      } else {
        log.warn('refresh unavailable; session kept', { reason: outcome.reason, requestId });
      }
    }
  }

  let response: NextResponse;
  if (
    !session &&
    (request.method === 'GET' || request.method === 'HEAD') &&
    !SESSIONLESS.test(pathname) &&
    classify(pathname) === 'session'
  ) {
    const login = new URL('/auth/login', env.APP_ORIGIN);
    login.searchParams.set('returnTo', `${pathname}${search}`);
    response = NextResponse.redirect(login, 307);
  } else {
    response = NextResponse.next({ request: { headers } });
  }

  if (write === 'clear') clearSession(response.cookies);
  else if (write) await writeSession(response.cookies, write, deps.now());
  response.headers.set('content-security-policy', csp);
  response.headers.set('x-request-id', requestId);
  return response;
}
