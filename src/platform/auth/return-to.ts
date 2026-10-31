import 'server-only';
import { localPath } from '@/kernel/local-path';

export const DEFAULT_RETURN_TO = '/houses';

/**
 * Where to go after sign-in: a path on this site (localPath), never back into /auth/;
 * otherwise the catalogue.
 */
export function safeReturnTo(value: string | null | undefined): string {
  const path = localPath(value);
  return path === undefined || path.startsWith('/auth/') ? DEFAULT_RETURN_TO : path;
}
