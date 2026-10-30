import 'server-only';
import { getEnv } from '@/platform/config/env';

/**
 * The only code that calls the global fetch (check-boundaries R9). Every outbound request
 * goes to an allowlisted origin, follows no redirects, is never cached by Next, and has a
 * deadline. Incoming request headers are never forwarded: callers build their own.
 */

export class OutboundBlockedError extends Error {
  override readonly name = 'OutboundBlockedError';
}

export interface OutboundOptions {
  readonly name: 'api' | 'idp';
  readonly allowedOrigins: () => readonly string[];
  /** Paths the target may be called on (the API: /v1/ only). */
  readonly pathPrefix?: string;
  readonly timeoutMs: number;
}

export function createOutboundFetch(options: OutboundOptions): typeof fetch {
  return (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (!options.allowedOrigins().includes(url.origin)) {
      throw new OutboundBlockedError(`${options.name}: ${url.origin} is not an allowed origin`);
    }
    if (options.pathPrefix && !url.pathname.startsWith(options.pathPrefix)) {
      throw new OutboundBlockedError(
        `${options.name}: ${url.pathname} is outside ${options.pathPrefix}`,
      );
    }
    // Resolved at call time, so test doubles that replace globalThis.fetch see the call.
    // The caller's own deadline (request.signal) applies too; this one is the backstop.
    return globalThis.fetch(request, {
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(options.timeoutMs)]),
    });
  };
}

/** The monolith API: its origin only, /v1/ paths only. */
export const apiFetch = createOutboundFetch({
  name: 'api',
  allowedOrigins: () => [getEnv().API_BASE_URL],
  pathPrefix: '/v1/',
  timeoutMs: 35_000,
});

/** The identity provider: its origin plus OIDC_EXTRA_ORIGINS (a token endpoint elsewhere). */
export const idpFetch = createOutboundFetch({
  name: 'idp',
  allowedOrigins: () => [new URL(getEnv().OIDC_ISSUER).origin, ...getEnv().OIDC_EXTRA_ORIGINS],
  timeoutMs: 5_000,
});
