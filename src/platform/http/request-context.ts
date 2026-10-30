import 'server-only';
import { headers } from 'next/headers';

/**
 * Per-request values the proxy put on the request (src/platform/proxy): the request id it
 * generated (any inbound one is overwritten) and the path + query, for returnTo.
 */
const REQUEST_ID_HEADER = 'x-request-id';
const PATH_HEADER = 'x-gaw-path';

export async function requestId(): Promise<string> {
  return (await headers()).get(REQUEST_ID_HEADER) ?? 'unknown';
}

/** The current page's path and query; "/" when unknown. */
export async function currentPath(): Promise<string> {
  const path = (await headers()).get(PATH_HEADER);
  return path?.startsWith('/') ? path : '/';
}
