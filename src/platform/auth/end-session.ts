import 'server-only';
import { getEnv } from '@/platform/config/env';
import type { Session } from '@/platform/session/schema';
import { client, getOidcConfig } from './oidc';

/**
 * Where to send the browser after the session is cleared: the provider's end-session
 * endpoint (RP-initiated logout, with id_token_hint so it signs out without a prompt),
 * or the home page when it has none or cannot be reached.
 */
export async function endSessionUrl(session: Session | null): Promise<string> {
  const env = getEnv();
  try {
    const config = await getOidcConfig();
    if (!config.serverMetadata().end_session_endpoint) return '/';
    return client
      .buildEndSessionUrl(config, {
        client_id: env.OIDC_CLIENT_ID,
        post_logout_redirect_uri: `${env.APP_ORIGIN}/`,
        ...(session?.idt ? { id_token_hint: session.idt } : {}),
      })
      .toString();
  } catch {
    return '/';
  }
}
