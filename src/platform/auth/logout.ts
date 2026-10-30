import 'server-only';
import { NextResponse } from 'next/server';
import { getEnv } from '@/platform/config/env';
import { assertSameOrigin } from '@/platform/proxy/csrf';
import { expireCookie, readCookie, SESSION_COOKIE } from '@/platform/session/cookies';
import { nowSeconds } from '@/platform/session/policy';
import { openSession } from '@/platform/session/read';
import { endSessionUrl } from './end-session';
import { client, getOidcConfig } from './oidc';

/**
 * POST /auth/logout (a form post, so a full navigation drops the router cache): clears
 * the session, revokes the refresh token when the provider supports revocation, then
 * signs out at the provider. There is no GET logout.
 */
export async function handleLogout(request: Request): Promise<Response> {
  const env = getEnv();
  const refused = assertSameOrigin(request, env.APP_ORIGIN);
  if (refused) return refused;
  const session = await openSession(readCookie(request, SESSION_COOKIE), nowSeconds());
  if (session?.rt) {
    try {
      const config = await getOidcConfig();
      if (config.serverMetadata().revocation_endpoint) {
        await client.tokenRevocation(config, session.rt, { token_type_hint: 'refresh_token' });
      }
    } catch {
      // Best effort: end-session below revokes the login at providers that support it.
    }
  }
  const target = new URL(await endSessionUrl(session), env.APP_ORIGIN);
  const response = NextResponse.redirect(target, {
    status: 303,
    headers: { 'cache-control': 'no-store' },
  });
  expireCookie(response.cookies, SESSION_COOKIE);
  return response;
}
