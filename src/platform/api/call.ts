import 'server-only';
import { cacheSignal } from 'react';
import { type ApiProblem, bffProblem } from '@/kernel/problem-codes';
import { requestId } from '@/platform/http/request-context';
import { OutboundBlockedError } from '@/platform/net/outbound';
import { log } from '@/platform/observability/log';
import { authorizationHeader, type Caller } from '@/platform/session/caller';
import { ApiMisuseError } from './client';
import { toApiProblem } from './problem';

export type ApiResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: ApiProblem };

interface CallInit {
  readonly headers: Record<string, string>;
  readonly signal: AbortSignal;
}

const READ_DEADLINE_MS = 10_000;
/** Outlasts the API's own 30 s REQUEST_TIMEOUT, so the API answers 504 first. */
const WRITE_DEADLINE_MS = 35_000;

function deadline(kind: 'read' | 'write'): AbortSignal {
  const timeout = AbortSignal.timeout(kind === 'read' ? READ_DEADLINE_MS : WRITE_DEADLINE_MS);
  // An abandoned render stops its calls (cacheSignal is null outside a render).
  const render = cacheSignal();
  return render ? AbortSignal.any([timeout, render]) : timeout;
}

/** Headers and deadline for an operation that acts as the caller (bearer operations). */
export async function withCaller(
  caller: Caller,
  kind: 'read' | 'write' = 'read',
): Promise<CallInit> {
  return {
    headers: { authorization: authorizationHeader(caller), 'x-request-id': await requestId() },
    signal: deadline(kind),
  };
}

/** Headers and deadline for a public operation: never a token. */
export async function anonymous(): Promise<CallInit> {
  return { headers: { 'x-request-id': await requestId() }, signal: deadline('read') };
}

/**
 * Settles an openapi-fetch call into an ApiResult: success mapped by `map`, an error
 * response normalized into an ApiProblem, a timeout or network failure into a BFF
 * problem. Programming errors (a misused client, a blocked origin) are rethrown.
 */
export async function settle<D, T = D>(
  call: Promise<{ data?: D; error?: unknown; response: Response }>,
  map?: (data: D) => T,
): Promise<ApiResult<T>> {
  let result: { data?: D; error?: unknown; response: Response };
  try {
    result = await call;
  } catch (error) {
    if (error instanceof ApiMisuseError || error instanceof OutboundBlockedError) throw error;
    const timedOut =
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    log.warn('api call failed', { reason: timedOut ? 'timeout' : 'network' });
    return {
      ok: false,
      problem: timedOut
        ? bffProblem(504, 'UPSTREAM_TIMEOUT', 'The service did not answer in time')
        : bffProblem(503, 'UPSTREAM_UNAVAILABLE', 'The service is unavailable'),
    };
  }
  const { response } = result;
  if (!response.ok) {
    const problem = toApiProblem(response, result.error);
    if (problem.status >= 500)
      log.warn('api error', {
        status: problem.status,
        code: problem.code,
        ...(problem.requestId ? { requestId: problem.requestId } : {}),
      });
    return { ok: false, problem };
  }
  const data = result.data as D;
  return { ok: true, value: map ? map(data) : (data as unknown as T) };
}
