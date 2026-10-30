import 'server-only';
import type { Instrumentation } from 'next';
import { log } from './log';

/**
 * Next's server error hook. Logs the digest (shown to the user by error.tsx), the route
 * and the request id only: the raw headers include Cookie.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String(error.digest)
      : undefined;
  const requestId = request.headers['x-request-id'];
  log.error('request failed', {
    ...(digest ? { digest } : {}),
    path: request.path.split('?')[0] ?? '',
    method: request.method,
    routeType: context.routeType,
    ...(typeof requestId === 'string' ? { requestId } : {}),
    reason: error instanceof Error ? error.name : 'unknown',
  });
};
