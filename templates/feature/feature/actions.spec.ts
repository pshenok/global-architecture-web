import { HttpResponse, http } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE } from '@/kernel/form-state';
import { problemResponse } from '@/platform/api/testing';
import { API, mswServer } from '../../../tests/support/msw';
import { sessionCookie } from '../../../tests/support/session';
import { createSampleItem } from './actions';

/**
 * The five problem tests every feature keeps: how its actions answer the API's problems.
 */
const jar = vi.hoisted(() => ({ cookie: '' }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.cookie.startsWith(`${name}=`)
        ? { name, value: jar.cookie.slice(name.length + 1) }
        : undefined,
    set: () => undefined,
  }),
}));
vi.mock('next/cache', () => ({ refresh: () => undefined, revalidatePath: () => undefined }));
vi.mock('@/platform/http/request-context', () => ({
  requestId: async () => 'req',
  currentPath: async () => '/sample-items/new',
}));

const ME = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  email: 'a@example.com',
  fullName: 'A',
  roles: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
};
const answer = (response: () => Response) =>
  mswServer.use(http.post(`${API}/v1/sample-items`, response));

async function redirectOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return String((error as { digest?: string }).digest ?? '').split(';')[2] ?? '';
  }
  return 'no redirect';
}

describe('sample item actions answer the API', () => {
  beforeEach(async () => {
    jar.cookie = await sessionCookie();
    mswServer.use(http.get(`${API}/v1/users/me`, () => HttpResponse.json(ME)));
  });

  it('VALIDATION_FAILED: under the field it is about', async () => {
    answer(() =>
      problemResponse(400, 'VALIDATION_FAILED', {
        errors: [{ field: 'name', description: 'must be 1..200 characters' }],
      }),
    );
    expect(await createSampleItem(IDLE, form({ name: 'Lamp' }))).toMatchObject({
      fieldErrors: { name: 'must be 1..200 characters' },
    });
  });

  it('a module code: its message, at its field', async () => {
    answer(() => problemResponse(409, 'SAMPLE_ITEM_NAME_TAKEN'));
    expect(await createSampleItem(IDLE, form({ name: 'Lamp' }))).toMatchObject({
      fieldErrors: { name: 'You already have one with this name.' },
    });
  });

  it('401: the session ended, with a way to sign in', async () => {
    answer(() => problemResponse(401, 'AUTH_TOKEN_EXPIRED'));
    expect(await createSampleItem(IDLE, form({ name: 'Lamp' }))).toMatchObject({
      code: 'SESSION_EXPIRED',
      signIn: true,
    });
  });

  it('USER_NOT_REGISTERED: to registration', async () => {
    mswServer.use(
      http.get(`${API}/v1/users/me`, () => problemResponse(403, 'USER_NOT_REGISTERED')),
    );
    expect(await redirectOf(createSampleItem(IDLE, form({ name: 'Lamp' })))).toBe('/register');
  });

  it('an unknown code: a generic message for its status, never internals', async () => {
    answer(() => problemResponse(500, 'SOMETHING_NEW', { detail: 'stack trace' }));
    const state = await createSampleItem(IDLE, form({ name: 'Lamp' }));
    expect(state).toMatchObject({ status: 'error', message: expect.stringContaining('Try again') });
    expect(JSON.stringify(state)).not.toContain('stack trace');
  });
});
