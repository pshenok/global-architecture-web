import { seal } from '@/platform/session/codec';
import { SESSION_COOKIE } from '@/platform/session/cookies';
import { sessionKeys } from '@/platform/session/keys';
import type { Session } from '@/platform/session/schema';

export const NOW_S = Math.floor(Date.now() / 1000);

export function testSession(overrides: Partial<Session> = {}): Session {
  return {
    v: 1,
    iss: 'https://idp.test',
    sub: 'alice',
    at: 'access-token-1',
    atExp: NOW_S + 300,
    atLife: 300,
    rt: 'refresh-token-1',
    idt: 'id-token-1',
    createdAt: NOW_S - 60,
    ...overrides,
  };
}

/** A Cookie header carrying the sealed session, as the browser would send it. */
export async function sessionCookie(session: Session = testSession()): Promise<string> {
  const value = await seal('session', { ...session }, session.createdAt + 28_800, sessionKeys());
  return `${SESSION_COOKIE}=${value}`;
}
