import { HttpResponse, http } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { IDLE } from '@/kernel/form-state';
import { problemResponse } from '@/platform/api/testing';
import { API, mswServer } from '../../../tests/support/msw';
import { NOW_S, sessionCookie, testSession } from '../../../tests/support/session';
import { defineAction } from './define-action';

const jar = vi.hoisted(() => ({ cookie: '' as string, deleted: [] as string[] }));
const refreshed = vi.hoisted(() => ({ count: 0 }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.cookie.startsWith(`${name}=`)
        ? jar.cookie.slice(name.length + 1)
        : undefined;
      return value === undefined ? undefined : { name, value };
    },
    set: () => undefined,
    delete: (name: string) => jar.deleted.push(name),
  }),
}));
vi.mock('next/cache', () => ({ refresh: () => (refreshed.count += 1), revalidatePath: () => undefined }));
vi.mock('@/platform/http/request-context', () => ({
  requestId: async () => 'req-action',
  currentPath: async () => '/houses/new',
}));

const ME = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  email: 'a@example.com',
  fullName: 'A',
  roles: [] as string[],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const meIs = (me: typeof ME) =>
  mswServer.use(http.get(`${API}/v1/users/me`, () => HttpResponse.json(me)));

const Form = z.object({ title: z.string().min(1, 'Enter a title'), city: z.string().min(1) });
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  data.set('$ACTION_ID_abc', '');
  return data;
};

/** The digest Next puts on a redirect() interrupt. */
async function redirectOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const digest = String((error as { digest?: string }).digest ?? '');
    if (digest.startsWith('NEXT_REDIRECT')) return digest.split(';')[2] ?? '';
    throw error;
  }
  throw new Error('expected a redirect');
}

describe('defineAction', () => {
  beforeEach(async () => {
    jar.cookie = await sessionCookie();
    jar.deleted = [];
    refreshed.count = 0;
    meIs(ME);
  });

  it('asks a signed-out visitor to sign in again, echoing what they typed', async () => {
    jar.cookie = '';
    const run = vi.fn();
    const action = defineAction({ access: 'user', input: Form, run });
    expect(await action(IDLE, form({ title: 'T', city: 'Kyiv' }))).toEqual({
      status: 'error',
      message: expect.stringContaining('Sign in again'),
      code: 'SESSION_EXPIRED',
      signIn: true,
      fieldErrors: {},
      values: { title: 'T', city: 'Kyiv' },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('says the sign-in service is unavailable when the token could not be renewed', async () => {
    jar.cookie = await sessionCookie(testSession({ atExp: NOW_S - 1 }));
    const action = defineAction({ access: 'user', input: Form, run: vi.fn() });
    expect(await action(IDLE, form({ title: 'T', city: 'K' }))).toMatchObject({
      code: 'IDP_UNAVAILABLE',
    });
  });

  it('validates the form before calling the handler, field by field', async () => {
    const run = vi.fn();
    const action = defineAction({ access: 'user', input: Form, run });
    const state = await action(IDLE, form({ title: '', city: 'Kyiv' }));
    expect(state).toMatchObject({
      status: 'error',
      code: 'VALIDATION_FAILED',
      fieldErrors: { title: 'Enter a title' },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('passes the caller, the user and the parsed input to the handler', async () => {
    const run = vi.fn(async () => ({ kind: 'done' as const, message: 'Saved' }));
    const action = defineAction({ access: 'user', input: Form, run });
    expect(await action(IDLE, form({ title: 'T', city: 'Kyiv' }))).toEqual({
      status: 'success',
      message: 'Saved',
    });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        me: expect.objectContaining({ id: ME.id }),
        requestId: 'req-action',
      }),
      { title: 'T', city: 'Kyiv' },
    );
  });

  it('runs identity actions without a user, and refuses admin actions to non-admins', async () => {
    mswServer.use(
      http.get(`${API}/v1/users/me`, () => problemResponse(403, 'USER_NOT_REGISTERED')),
    );
    const register = defineAction({
      access: 'identity',
      input: Form,
      run: async ({ me }) => ({ kind: 'done', message: String(me) }),
    });
    expect(await register(IDLE, form({ title: 'T', city: 'K' }))).toEqual({
      status: 'success',
      message: 'null',
    });
    const user = defineAction({ access: 'user', input: Form, run: vi.fn() });
    expect(await redirectOf(user(IDLE, form({ title: 'T', city: 'K' })))).toBe('/register');
    meIs(ME);
    const admin = defineAction({ access: 'admin', input: Form, run: vi.fn() });
    expect(await admin(IDLE, form({ title: 'T', city: 'K' }))).toMatchObject({
      code: 'ADMIN_ROLE_REQUIRED',
    });
  });

  it('maps API validation errors to form fields, and business codes to messages', async () => {
    const failing = (code: string, extra = {}) =>
      defineAction({
        access: 'user',
        input: Form,
        fields: { 'address.city': 'city' },
        messages: {
          HOUSE_NOT_FOUND: 'This house no longer exists.',
          BOOKING_TOO_MANY_GUESTS: {
            field: 'title',
            message: (p) => `At most ${p.metadata.maxGuests}`,
          },
        },
        run: async () => ({
          ok: false as const,
          problem: {
            status: 400,
            code,
            title: 'x',
            fieldErrors: [],
            metadata: {},
            origin: 'api' as const,
            ...extra,
          },
        }),
      })(IDLE, form({ title: 'T', city: 'K' }));
    expect(
      await failing('VALIDATION_FAILED', {
        fieldErrors: [
          { field: 'address.city', description: 'is too long' },
          { field: 'x.y', description: 'bad' },
        ],
      }),
    ).toMatchObject({
      fieldErrors: { city: 'is too long' },
      message: expect.stringContaining('x.y bad'),
    });
    expect(await failing('HOUSE_NOT_FOUND')).toMatchObject({
      message: 'This house no longer exists.',
    });
    expect(
      await failing('BOOKING_TOO_MANY_GUESTS', { metadata: { maxGuests: '2' } }),
    ).toMatchObject({
      fieldErrors: { title: 'At most 2' },
    });
    expect(
      await failing('SOMETHING_NEW', { status: 422, detail: 'A clear reason.' }),
    ).toMatchObject({ message: 'A clear reason.' });
    expect(await failing('UPSTREAM_TIMEOUT', { status: 504 })).toMatchObject({
      message: expect.stringContaining('could not confirm'),
    });
    expect(await failing('INTERNAL', { status: 500, detail: 'secret internals' })).toMatchObject({
      message: expect.not.stringContaining('secret'),
    });
    expect(await failing('AUTH_TOKEN_EXPIRED', { status: 401 })).toMatchObject({
      code: 'SESSION_EXPIRED',
      signIn: true,
    });
  });

  it('treats idempotent codes as success, and refreshes', async () => {
    const action = defineAction({
      access: 'user',
      input: Form,
      successCodes: ['BOOKING_ALREADY_CANCELLED'],
      run: async () => ({
        ok: false as const,
        problem: {
          status: 412,
          code: 'BOOKING_ALREADY_CANCELLED',
          title: 'x',
          fieldErrors: [],
          metadata: {},
          origin: 'api' as const,
        },
      }),
    });
    expect(await action(IDLE, form({ title: 'T', city: 'K' }))).toEqual({ status: 'success' });
    expect(refreshed.count).toBe(1);
  });

  it('redirects outside the handler, and hides a handler crash behind the request id', async () => {
    const redirecting = defineAction({
      access: 'user',
      input: Form,
      run: async () => ({ kind: 'redirect', to: '/houses/1' }),
    });
    expect(await redirectOf(redirecting(IDLE, form({ title: 'T', city: 'K' })))).toBe('/houses/1');
    const crashing = defineAction({
      access: 'user',
      input: Form,
      run: async () => {
        throw new Error('database password is hunter2');
      },
    });
    const state = await crashing(IDLE, form({ title: 'T', city: 'K' }));
    expect(state).toMatchObject({ status: 'error', requestId: 'req-action' });
    expect(JSON.stringify(state)).not.toContain('hunter2');
  });

  it('logs out: clears the session and leaves through the provider', async () => {
    const leaving = defineAction({
      access: 'user',
      input: Form,
      run: async () => ({ kind: 'logout' }),
    });
    const target = await redirectOf(leaving(IDLE, form({ title: 'T', city: 'K' })));
    expect(jar.deleted).toEqual(['__Host-Http-gaw-session']);
    expect(target).toBeTruthy();
  });
});
