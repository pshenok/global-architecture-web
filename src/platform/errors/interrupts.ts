import 'server-only';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ApiProblem } from '@/kernel/problem-codes';
import type { ApiResult } from '@/platform/api/call';
import { currentPath } from '@/platform/http/request-context';
import { log } from '@/platform/observability/log';
import { loginPath } from '@/platform/session/read';

/**
 * The only place that turns API problems into Next interrupts for reads. The monolith is
 * the authorization authority; this maps its answers to UX:
 * - 404, and any 403 except USER_NOT_REGISTERED: not found (the API answers 404 for what
 *   the caller may not know about; a 403 is shown the same way, never as "forbidden")
 * - 401: sign in again (the callback's own 401 branch prevents a login loop)
 * - USER_NOT_REGISTERED: registration
 * - INVALID_PAGE_TOKEN: the first page
 * - anything else: an error page with the request id
 */
export type ReadOutcome = 'not-found' | 'login' | 'register' | 'first-page' | 'error';

export function classifyReadProblem(problem: ApiProblem): ReadOutcome {
  if (problem.code === 'USER_NOT_REGISTERED') return 'register';
  if (problem.code === 'INVALID_PAGE_TOKEN') return 'first-page';
  if (problem.status === 401) return 'login';
  if (problem.status === 404 || problem.status === 403) return 'not-found';
  return 'error';
}

/** An upstream failure a view cannot recover from; error.tsx shows its digest and a retry. */
export class UpstreamError extends Error {
  override readonly name = 'UpstreamError';
  constructor(readonly problem: ApiProblem) {
    super(`upstream ${problem.status} ${problem.code}`);
  }
}

export async function registerPath(): Promise<string> {
  return `/register?returnTo=${encodeURIComponent(await currentPath())}`;
}

/** The value of a successful read, or the interrupt its problem calls for. */
export async function orInterrupt<T>(
  result: ApiResult<T> | Promise<ApiResult<T>>,
  context: { firstPage?: string } = {},
): Promise<T> {
  const settled = await result;
  if (settled.ok) return settled.value;
  const { problem } = settled;
  switch (classifyReadProblem(problem)) {
    case 'not-found':
      return notFound();
    case 'login':
      return redirect((await loginPath()) as Route);
    case 'register':
      return redirect((await registerPath()) as Route);
    case 'first-page':
      if (context.firstPage) redirect(context.firstPage as Route);
      break;
    case 'error':
      break;
  }
  log.error('read failed', {
    status: problem.status,
    code: problem.code,
    ...(problem.requestId ? { requestId: problem.requestId } : {}),
  });
  throw new UpstreamError(problem);
}
