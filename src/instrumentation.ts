import { getEnv } from '@/platform/config/env';

export { onRequestError } from '@/platform/observability';

/** A bad configuration stops the server at boot instead of failing the first request. */
export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') getEnv();
}
