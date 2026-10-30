import 'server-only';
import { getEnv } from '@/platform/config/env';
import { type SealKeys, sealKeys } from './codec';

let cached: SealKeys | undefined;

/** SESSION_KEYS: the first key seals, every key opens (rotation: prepend, deploy, drop later). */
export function sessionKeys(): SealKeys {
  cached ??= sealKeys(getEnv().SESSION_KEYS);
  return cached;
}
