import 'server-only';
import * as client from 'openid-client';
import { getEnv } from '@/platform/config/env';
import { idpFetch } from '@/platform/net/outbound';
import { log } from '@/platform/observability/log';
import { RefreshGrantError, type RefreshOutcome } from '@/platform/session/refresh';

/**
 * The OIDC relying party (openid-client, the only importer, R9): a confidential client
 * using the authorization code flow with PKCE. Discovery is validated and memoized per
 * process; a failed discovery is not cached, so the next request tries again.
 */

export class OidcConfigurationError extends Error {
  override readonly name = 'OidcConfigurationError';
}

const CONFIG = Symbol.for('gaw.oidc.config');
type Holder = Record<symbol, Promise<client.Configuration> | undefined>;

const isLoopbackHttp = (issuer: string) => {
  const url = new URL(issuer);
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
};

/**
 * Fails closed unless the browser-facing endpoints are on the issuer's origin (keeps CSP
 * form-action exact) and the back-channel ones on the issuer's or OIDC_EXTRA_ORIGINS.
 */
export function validateDiscovery(
  metadata: client.ServerMetadata,
  issuer: string,
  extraOrigins: readonly string[],
): void {
  const issuerOrigin = new URL(issuer).origin;
  const sameOrigin = (url: string | undefined) =>
    url === undefined || new URL(url).origin === issuerOrigin;
  const allowed = (url: string | undefined) =>
    url === undefined || [issuerOrigin, ...extraOrigins].includes(new URL(url).origin);
  if (!metadata.authorization_endpoint || !sameOrigin(metadata.authorization_endpoint)) {
    throw new OidcConfigurationError('authorization_endpoint must be on the issuer origin');
  }
  if (!sameOrigin(metadata.end_session_endpoint)) {
    throw new OidcConfigurationError('end_session_endpoint must be on the issuer origin');
  }
  for (const key of [
    'token_endpoint',
    'jwks_uri',
    'userinfo_endpoint',
    'revocation_endpoint',
  ] as const) {
    if (!allowed(metadata[key]))
      throw new OidcConfigurationError(`${key} is outside the allowed origins`);
  }
  if (!metadata.code_challenge_methods_supported?.includes('S256')) {
    throw new OidcConfigurationError('the provider does not support PKCE S256');
  }
}

async function discover(): Promise<client.Configuration> {
  const env = getEnv();
  const config = await client.discovery(
    new URL(env.OIDC_ISSUER),
    env.OIDC_CLIENT_ID,
    undefined,
    client.ClientSecretBasic(env.OIDC_CLIENT_SECRET),
    {
      [client.customFetch]: (url, options) => idpFetch(url, options as RequestInit),
      // Loopback http only (the local dev IdP); deprecated upstream only to stand out.
      // oxlint-disable-next-line typescript/no-deprecated
      execute: isLoopbackHttp(env.OIDC_ISSUER) ? [client.allowInsecureRequests] : [],
    },
  );
  config.timeout = 5;
  validateDiscovery(config.serverMetadata(), env.OIDC_ISSUER, env.OIDC_EXTRA_ORIGINS);
  return config;
}

export function getOidcConfig(): Promise<client.Configuration> {
  const holder = globalThis as unknown as Holder;
  const existing = holder[CONFIG];
  if (existing) return existing;
  const pending = discover().catch((error: unknown) => {
    holder[CONFIG] = undefined;
    log.error('oidc discovery failed', { reason: error instanceof Error ? error.name : 'unknown' });
    throw error;
  });
  holder[CONFIG] = pending;
  return pending;
}

const isTimeout = (error: unknown) =>
  error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');

/** The refresh grant, with failures classified for the refresher (session/refresh.ts). */
export async function refreshGrant(refreshToken: string) {
  let config: client.Configuration;
  try {
    config = await getOidcConfig();
  } catch (error) {
    throw new RefreshGrantError(
      {
        kind: 'unavailable',
        reason: error instanceof OidcConfigurationError ? 'misconfigured' : 'network',
      },
      { cause: error },
    );
  }
  try {
    return await client.refreshTokenGrant(config, refreshToken);
  } catch (error) {
    throw new RefreshGrantError(classifyGrantError(error), { cause: error });
  }
}

export function classifyGrantError(
  error: unknown,
): Extract<RefreshOutcome, { kind: 'ended' | 'unavailable' }> {
  if (error instanceof client.ResponseBodyError) {
    if (error.error === 'invalid_grant') return { kind: 'ended', reason: 'invalid_grant' };
    if (error.status >= 500) return { kind: 'unavailable', reason: 'idp_5xx' };
    log.error('refresh refused by the provider', { code: error.error, status: error.status });
    return { kind: 'unavailable', reason: 'misconfigured' };
  }
  if (isTimeout(error)) return { kind: 'unavailable', reason: 'timeout' };
  // A status oauth4webapi does not expect (5xx) arrives as its cause.
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Response && cause.status >= 500)
    return { kind: 'unavailable', reason: 'idp_5xx' };
  return { kind: 'unavailable', reason: 'network' };
}

export { client };
