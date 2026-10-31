import 'server-only';
import { NextResponse } from 'next/server';
import { getEnv } from '@/platform/config/env';
import { log } from '@/platform/observability/log';
import { mintCaller } from '@/platform/session/caller';
import { unseal } from '@/platform/session/codec';
import { expireCookie, readCookie, TXN_COOKIE } from '@/platform/session/cookies';
import { fetchMe } from '@/platform/session/current-user';
import { sessionKeys } from '@/platform/session/keys';
import { nowSeconds } from '@/platform/session/policy';
import { LoginTransaction, type Session } from '@/platform/session/schema';
import { writeSession } from '@/platform/session/write';
import { client, getOidcConfig } from './oidc';
import { DEFAULT_RETURN_TO } from './return-to';

const noStore = { 'cache-control': 'no-store' };

/** Provider error codes shown on /auth/error; error_description is never reflected. */
const IDP_ERRORS: Readonly<Record<string, string>> = {
  access_denied: 'IDP_ACCESS_DENIED',
  login_required: 'IDP_LOGIN_REQUIRED',
  temporarily_unavailable: 'IDP_UNAVAILABLE',
  server_error: 'IDP_UNAVAILABLE',
};

/**
 * GET /auth/callback: completes the code flow (state, nonce, PKCE and RFC 9207 `iss`
 * checked by oauth4webapi), creates a fresh session (fixation-safe) and asks the API who
 * the login is: registered users go back to where they started, new logins to /register.
 */
export async function handleCallback(request: Request): Promise<Response> {
  const env = getEnv();
  const now = nowSeconds();
  const to = (path: string) => {
    // The last guard against an open redirect: whatever a path resolves to, only this site.
    const target = new URL(path, env.APP_ORIGIN);
    const safe =
      target.origin === env.APP_ORIGIN ? target : new URL(DEFAULT_RETURN_TO, env.APP_ORIGIN);
    const response = NextResponse.redirect(safe, { status: 303, headers: noStore });
    expireCookie(response.cookies, TXN_COOKIE);
    return response;
  };
  const fail = (code: string) => to(`/auth/error?code=${code}`);

  const sealed = readCookie(request, TXN_COOKIE);
  const unsealed = sealed ? await unseal('txn', sealed, sessionKeys(), now) : undefined;
  const transaction = unsealed?.ok ? LoginTransaction.safeParse(unsealed.payload) : undefined;
  if (!transaction?.success) return fail('LOGIN_EXPIRED');
  const txn = transaction.data;

  const search = new URL(request.url).search;
  const providerError = new URLSearchParams(search).get('error');
  if (providerError) return fail(IDP_ERRORS[providerError] ?? 'IDP_ERROR');

  let tokens: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
  try {
    const config = await getOidcConfig();
    // The redirect URI derives from APP_ORIGIN, never from the Host header.
    tokens = await client.authorizationCodeGrant(
      config,
      new URL(`/auth/callback${search}`, env.APP_ORIGIN),
      {
        pkceCodeVerifier: txn.verifier,
        expectedState: txn.state,
        expectedNonce: txn.nonce,
        idTokenExpected: true,
      },
    );
  } catch (error) {
    // The oauth4webapi code names the failed check (the class name is minified in builds).
    const code = (error as { code?: unknown }).code;
    log.warn('login callback refused', {
      reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
      ...(typeof code === 'string' ? { code } : {}),
    });
    if (error instanceof client.AuthorizationResponseError)
      return fail(IDP_ERRORS[error.error] ?? 'IDP_ERROR');
    if (error instanceof client.ResponseBodyError && error.status < 500)
      return fail('LOGIN_FAILED');
    if (
      error instanceof TypeError ||
      (error instanceof client.ResponseBodyError && error.status >= 500)
    ) {
      return fail('IDP_UNAVAILABLE');
    }
    return fail('LOGIN_FAILED');
  }

  const claims = tokens.claims();
  if (!claims) return fail('LOGIN_FAILED');
  const life = tokens.expires_in && tokens.expires_in > 0 ? tokens.expires_in : 300;
  const session: Session = {
    v: 1,
    iss: claims.iss,
    sub: claims.sub,
    ...(typeof claims.sid === 'string' ? { sid: claims.sid } : {}),
    at: tokens.access_token,
    atExp: now + life,
    atLife: life,
    ...(tokens.refresh_token ? { rt: tokens.refresh_token } : {}),
    ...(tokens.id_token ? { idt: tokens.id_token } : {}),
    ...(typeof claims.email === 'string' ? { email: claims.email } : {}),
    createdAt: now,
  };

  const me = await fetchMe(mintCaller(session));
  let target: string;
  if (me.ok) target = txn.returnTo;
  else if (me.problem.code === 'USER_NOT_REGISTERED')
    target = `/register?returnTo=${encodeURIComponent(txn.returnTo)}`;
  // The API refuses this provider's tokens (e.g. a wrong audience): no session, no loop.
  else if (me.problem.status === 401) return fail('API_REJECTED_TOKEN');
  else target = '/auth/error?code=API_UNAVAILABLE';

  const response = to(target);
  try {
    await writeSession(response.cookies, session, now);
  } catch (error) {
    log.error('session not written', { reason: error instanceof Error ? error.name : 'unknown' });
    return fail('SESSION_TOO_LARGE');
  }
  return response;
}
