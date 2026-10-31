import 'server-only';
import { NextResponse } from 'next/server';
import { getEnv } from '@/platform/config/env';
import { nowSeconds } from '@/platform/session/policy';
import { writeTransaction } from '@/platform/session/write';
import { client, getOidcConfig } from './oidc';
import { safeReturnTo } from './return-to';

const noStore = { 'cache-control': 'no-store' };

/** GET /auth/login?returnTo=: starts the code flow (PKCE S256, state, nonce in a sealed cookie). */
export async function handleLogin(request: Request): Promise<Response> {
  // Only a navigation starts a sign-in. A fetch that followed the proxy's redirect (a Next
  // prefetch of a protected page after the session ended) would otherwise mint a new
  // transaction and overwrite the cookie of a sign-in the person is in the middle of.
  // Sec-Fetch-Mode cannot be set by scripts; a client without it is treated as navigating.
  const mode = request.headers.get('sec-fetch-mode');
  if (mode !== null && mode !== 'navigate')
    return new Response(null, { status: 204, headers: noStore });
  const env = getEnv();
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get('returnTo'));
  let config: client.Configuration;
  try {
    config = await getOidcConfig();
  } catch {
    return NextResponse.redirect(new URL('/auth/error?code=IDP_UNAVAILABLE', env.APP_ORIGIN), {
      status: 303,
      headers: noStore,
    });
  }
  const verifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const target = client.buildAuthorizationUrl(config, {
    ...env.OIDC_AUTH_PARAMS,
    redirect_uri: `${env.APP_ORIGIN}/auth/callback`,
    scope: env.OIDC_SCOPES.join(' '),
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
    state,
    nonce,
  });
  const response = NextResponse.redirect(target, { status: 303, headers: noStore });
  const now = nowSeconds();
  await writeTransaction(
    response.cookies,
    { state, nonce, verifier, returnTo, createdAt: now },
    now,
  );
  return response;
}
