import { describe, expect, it } from 'vitest';
import { MAX_SEALED_BYTES, SealTooLargeError, seal, sealKeys, unseal } from './codec';

const key = (fill: number) => new Uint8Array(32).fill(fill);
const keys = sealKeys([{ kid: 'k1', key: key(1) }]);
const NOW = 1_800_000_000;

describe('session codec', () => {
  it('round-trips a payload and drops the JWT time claims', async () => {
    const sealed = await seal('session', { a: 1, b: 'x' }, NOW + 60, keys);
    expect(await unseal('session', sealed, keys, NOW)).toEqual({
      ok: true,
      payload: { a: 1, b: 'x' },
    });
  });

  it('refuses a tampered value, a wrong key and an unknown kid', async () => {
    const sealed = await seal('session', { a: 1 }, NOW + 60, keys);
    const parts = sealed.split('.');
    parts[3] = `${parts[3]?.[0] === 'A' ? 'B' : 'A'}${parts[3]?.slice(1)}`;
    expect(await unseal('session', parts.join('.'), keys, NOW)).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
    const otherKey = sealKeys([{ kid: 'k1', key: key(2) }]);
    expect(await unseal('session', sealed, otherKey, NOW)).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
    const otherKid = sealKeys([{ kid: 'k2', key: key(1) }]);
    expect(await unseal('session', sealed, otherKid, NOW)).toMatchObject({
      ok: false,
      reason: 'unknown-kid',
    });
    expect(await unseal('session', 'garbage', keys, NOW)).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
  });

  it('opens values sealed with an older key after rotation', async () => {
    const sealed = await seal('session', { a: 1 }, NOW + 60, keys);
    const rotated = sealKeys([
      { kid: 'k2', key: key(3) },
      { kid: 'k1', key: key(1) },
    ]);
    expect(await unseal('session', sealed, rotated, NOW)).toMatchObject({ ok: true });
    const resealed = await seal('session', { a: 1 }, NOW + 60, rotated);
    expect(await unseal('session', resealed, keys, NOW)).toMatchObject({ reason: 'unknown-kid' });
  });

  it('binds a value to its purpose', async () => {
    const txn = await seal('txn', { state: 's' }, NOW + 60, keys);
    expect(await unseal('session', txn, keys, NOW)).toMatchObject({
      ok: false,
      reason: 'wrong-purpose',
    });
  });

  it('expires exactly at exp, with no clock tolerance', async () => {
    const sealed = await seal('session', { a: 1 }, NOW + 60, keys);
    expect(await unseal('session', sealed, keys, NOW + 59)).toMatchObject({ ok: true });
    expect(await unseal('session', sealed, keys, NOW + 60)).toMatchObject({
      ok: false,
      reason: 'expired',
    });
  });

  // The budget: about 2,300 characters of tokens in total (the dev IdP's are about 1,100).
  it('fits a large session under the cookie budget, and refuses larger ones', async () => {
    const worst = {
      v: 1,
      iss: 'https://login.example.com/',
      sub: 's'.repeat(64),
      sid: 'x'.repeat(64),
      at: 'a'.repeat(1200),
      atExp: NOW,
      atLife: 300,
      rt: 'r'.repeat(200),
      idt: 'i'.repeat(900),
      email: 'someone@example.com',
      createdAt: NOW,
    };
    expect((await seal('session', worst, NOW + 60, keys)).length).toBeLessThanOrEqual(
      MAX_SEALED_BYTES,
    );
    await expect(
      seal('session', { ...worst, at: 'a'.repeat(3000) }, NOW + 60, keys),
    ).rejects.toBeInstanceOf(SealTooLargeError);
  });
});
