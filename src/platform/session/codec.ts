import 'server-only';
import { EncryptJWT, errors, jwtDecrypt } from 'jose';

/**
 * Seals cookie payloads as compact JWE (`dir` + A256GCM): encrypted and authenticated,
 * with a `kid` for key rotation and a `typ` bound to the purpose, so a login
 * transaction can never be replayed as a session. The only jose importer (R9).
 */

export type Purpose = 'session' | 'txn';

export interface SealKeys {
  readonly current: { readonly kid: string; readonly key: Uint8Array };
  readonly byKid: ReadonlyMap<string, Uint8Array>;
}

/** Leaves room for the cookie name and attributes under browsers' 4096-byte limit. */
export const MAX_SEALED_BYTES = 3800;

export class SealTooLargeError extends Error {
  override readonly name = 'SealTooLargeError';
}

export function sealKeys(keys: readonly { kid: string; key: Uint8Array }[]): SealKeys {
  const [current] = keys;
  if (!current) throw new Error('at least one session key is required');
  return { current, byKid: new Map(keys.map((k) => [k.kid, k.key])) };
}

const typOf = (purpose: Purpose) => `gaw-${purpose}+jwt`;

export async function seal(
  purpose: Purpose,
  payload: Record<string, unknown>,
  expiresAtS: number,
  keys: SealKeys,
): Promise<string> {
  const sealed = await new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', kid: keys.current.kid, typ: typOf(purpose) })
    .setIssuedAt()
    .setExpirationTime(expiresAtS)
    .encrypt(keys.current.key);
  if (sealed.length > MAX_SEALED_BYTES) {
    throw new SealTooLargeError(`sealed ${purpose} is ${sealed.length} bytes`);
  }
  return sealed;
}

export type Unsealed =
  | { readonly ok: true; readonly payload: Record<string, unknown> }
  | {
      readonly ok: false;
      readonly reason: 'expired' | 'invalid' | 'unknown-kid' | 'wrong-purpose';
    };

export async function unseal(
  purpose: Purpose,
  value: string,
  keys: SealKeys,
  nowS: number,
): Promise<Unsealed> {
  let unknownKid = false;
  try {
    const { payload } = await jwtDecrypt(
      value,
      (header) => {
        const key = keys.byKid.get(header.kid ?? '');
        if (!key) {
          unknownKid = true;
          throw new Error('unknown kid');
        }
        return key;
      },
      {
        keyManagementAlgorithms: ['dir'],
        contentEncryptionAlgorithms: ['A256GCM'],
        typ: typOf(purpose),
        currentDate: new Date(nowS * 1_000),
        clockTolerance: 0,
      },
    );
    const { iat: _iat, exp: _exp, ...rest } = payload;
    return { ok: true, payload: rest };
  } catch (error) {
    if (unknownKid) return { ok: false, reason: 'unknown-kid' };
    if (error instanceof errors.JWTExpired) return { ok: false, reason: 'expired' };
    if (error instanceof errors.JWTClaimValidationFailed && error.claim === 'typ') {
      return { ok: false, reason: 'wrong-purpose' };
    }
    return { ok: false, reason: 'invalid' };
  }
}
