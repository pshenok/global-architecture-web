import { HttpResponse, http } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { problemResponse } from '@/platform/api/testing';
import { API, mswServer } from '../../../tests/support/msw';
import { NOW_S, sessionCookie, testSession } from '../../../tests/support/session';
import { getOptionalUser, requireAdmin, requireUser } from './current-user';
import { getOptionalCaller, IdentityUnavailableError, requireCaller } from './read';

const jar = vi.hoisted(() => ({ cookie: '' }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.cookie.startsWith(`${name}=`)
        ? { name, value: jar.cookie.slice(name.length + 1) }
        : undefined,
  }),
}));
vi.mock('@/platform/http/request-context', () => ({
  requestId: async () => 'req',
  currentPath: async () => '/account',
}));

const ME = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  email: 'a@example.com',
  fullName: 'A',
  roles: ['admin'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function interrupt(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    return String((error as { digest?: string }).digest ?? (error as Error).name);
  }
}

describe('current user', () => {
  beforeEach(async () => {
    jar.cookie = await sessionCookie();
  });

  it('reads the user once the login is registered', async () => {
    mswServer.use(http.get(`${API}/v1/users/me`, () => HttpResponse.json(ME)));
    expect((await requireUser()).me).toEqual({
      id: ME.id,
      email: ME.email,
      fullName: 'A',
      roles: ['admin'],
    });
    expect((await requireAdmin()).me.id).toBe(ME.id);
    expect((await getOptionalUser())?.me.id).toBe(ME.id);
  });

  it('sends a signed-out visitor to sign-in, and an unregistered login to registration', async () => {
    jar.cookie = '';
    expect(await getOptionalCaller()).toBeNull();
    expect(await getOptionalUser()).toBeNull();
    expect(await interrupt(requireCaller())).toContain('/auth/login?returnTo=%2Faccount');
    jar.cookie = await sessionCookie();
    mswServer.use(
      http.get(`${API}/v1/users/me`, () => problemResponse(403, 'USER_NOT_REGISTERED')),
    );
    expect(await interrupt(requireUser())).toContain('/register?returnTo=%2Faccount');
    expect(await getOptionalUser()).toBeNull();
  });

  it('hides admin pages from everyone else', async () => {
    mswServer.use(http.get(`${API}/v1/users/me`, () => HttpResponse.json({ ...ME, roles: [] })));
    expect(await interrupt(requireAdmin())).toMatch(/^NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  it('says the sign-in service is unavailable when the token expired and was not renewed', async () => {
    jar.cookie = await sessionCookie(testSession({ atExp: NOW_S - 5 }));
    expect(await getOptionalCaller()).toBeNull();
    await expect(requireCaller()).rejects.toBeInstanceOf(IdentityUnavailableError);
  });

  it('ignores a cookie it cannot open', async () => {
    jar.cookie = '__Host-Http-gaw-session=garbage';
    expect(await getOptionalCaller()).toBeNull();
  });
});
