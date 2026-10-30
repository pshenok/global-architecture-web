import { describe, expect, it, vi } from 'vitest';
import { createRefresher, type GrantResult, RefreshGrantError } from './refresh';
import type { Session } from './schema';

const NOW_MS = 1_800_000_000_000;
const session: Session = {
  v: 1,
  iss: 'https://idp.test',
  sub: 'alice',
  at: 'old-at',
  atExp: NOW_MS / 1000 + 10,
  atLife: 300,
  rt: 'rt-1',
  createdAt: NOW_MS / 1000 - 100,
};

const granted = (overrides: Partial<GrantResult> = {}): GrantResult => ({
  access_token: 'new-at',
  refresh_token: 'rt-2',
  expires_in: 300,
  claims: () => undefined,
  ...overrides,
});

function setup(grant: (rt: string) => Promise<GrantResult>) {
  let now = NOW_MS;
  const spy = vi.fn(grant);
  const refresh = createRefresher({ grant: spy, now: () => now, entries: new Map() });
  return { refresh, grant: spy, advance: (ms: number) => (now += ms) };
}

describe('refresher', () => {
  it('maps a rotated grant into the session, keeping its login time', async () => {
    const { refresh } = setup(async () => granted());
    const outcome = await refresh(session);
    expect(outcome).toEqual({
      kind: 'refreshed',
      session: { ...session, at: 'new-at', rt: 'rt-2', atExp: NOW_MS / 1000 + 300, atLife: 300 },
    });
  });

  it('keeps the old refresh token when the IdP does not rotate', async () => {
    const { refresh_token: _rotated, ...withoutRotation } = granted();
    const { refresh } = setup(async () => withoutRotation);
    expect(await refresh(session)).toMatchObject({ session: { rt: 'rt-1' } });
  });

  it('shares one grant between concurrent requests, and its result for a minute', async () => {
    const { refresh, grant, advance } = setup(async () => granted());
    const outcomes = await Promise.all([refresh(session), refresh(session), refresh(session)]);
    expect(grant).toHaveBeenCalledTimes(1);
    expect(new Set(outcomes.map((o) => (o.kind === 'refreshed' ? o.session.rt : '')))).toEqual(
      new Set(['rt-2']),
    );
    advance(59_000);
    expect(await refresh(session)).toMatchObject({ session: { rt: 'rt-2' } });
    expect(grant).toHaveBeenCalledTimes(1);
    advance(2_000);
    await refresh(session);
    expect(grant).toHaveBeenCalledTimes(2);
  });

  it('ends the session on invalid_grant or a different subject, and without a refresh token', async () => {
    const ended = setup(async () => {
      throw new RefreshGrantError({ kind: 'ended', reason: 'invalid_grant' });
    });
    expect(await ended.refresh(session)).toEqual({ kind: 'ended', reason: 'invalid_grant' });

    const other = setup(async () =>
      granted({ id_token: 'x', claims: () => ({ iss: 'https://idp.test', sub: 'mallory' }) }),
    );
    expect(await other.refresh(session)).toEqual({ kind: 'ended', reason: 'subject_mismatch' });

    const { rt: _rt, ...withoutRefresh } = session;
    expect(await ended.refresh(withoutRefresh)).toEqual({
      kind: 'ended',
      reason: 'no_refresh_token',
    });
  });

  it('keeps the session when the IdP is unreachable, and retries on the next request', async () => {
    let fail = true;
    const { refresh, grant } = setup(async () => {
      if (fail) throw new TypeError('fetch failed');
      return granted();
    });
    expect(await refresh(session)).toEqual({ kind: 'unavailable', reason: 'network' });
    fail = false;
    expect(await refresh(session)).toMatchObject({ kind: 'refreshed' });
    expect(grant).toHaveBeenCalledTimes(2);
  });

  it('stays bounded', async () => {
    let now = NOW_MS;
    const entries = new Map();
    const refresh = createRefresher({
      grant: async () => granted(),
      now: () => now,
      entries,
      maxEntries: 3,
    });
    for (let i = 0; i < 10; i += 1) await refresh({ ...session, rt: `rt-${i}` });
    expect(entries.size).toBeLessThanOrEqual(3);
    now += 61_000;
    await refresh({ ...session, rt: 'fresh' });
    expect(entries.size).toBe(1);
  });
});
