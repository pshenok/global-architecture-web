import 'server-only';
import createClient, { type Client, type Middleware } from 'openapi-fetch';
import { getEnv } from '@/platform/config/env';
import { apiFetch } from '@/platform/net/outbound';
import { OPERATIONS } from './generated/operations';
import type { paths } from './generated/schema';

/** A programming error in how the API is called; never shown to a user, always logged. */
export class ApiMisuseError extends Error {
  override readonly name = 'ApiMisuseError';
}

/**
 * Derived from the API's OpenAPI document: an unknown operation fails closed, a token is
 * never sent to a public operation (an expired cookie would turn the public catalogue into
 * a 401), and a protected one is never called anonymously.
 */
export const guard: Middleware = {
  onRequest({ request, schemaPath }) {
    const key = `${request.method} ${schemaPath}`;
    const security = (OPERATIONS as Readonly<Record<string, 'none' | 'bearer'>>)[key];
    if (security === undefined) throw new ApiMisuseError(`UNKNOWN_OPERATION ${key}`);
    const hasToken = request.headers.has('authorization');
    if (security === 'none' && hasToken)
      throw new ApiMisuseError(`TOKEN_ON_PUBLIC_OPERATION ${key}`);
    if (security === 'bearer' && !hasToken) throw new ApiMisuseError(`MISSING_TOKEN ${key}`);
    return request;
  },
};

let client: Client<paths> | undefined;

/** The one client of the monolith API (openapi-fetch's only importer, R9). data/ only. */
export function api(): Client<paths> {
  if (!client) {
    client = createClient<paths>({
      baseUrl: getEnv().API_BASE_URL,
      fetch: (request) => apiFetch(request),
    });
    client.use(guard);
  }
  return client;
}
