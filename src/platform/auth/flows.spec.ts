import { HttpResponse, http } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { problemResponse } from '@/platform/api/testing';
import { SESSION_COOKIE, TXN_COOKIE } from '@/platform/session/cookies';
import { openSession } from '@/platform/session/read';
import { RefreshGrantError } from '@/platform/session/refresh';
import { idpState, resetOidc, useIdp } from '../../../tests/support/idp';
import { API, IDP, mswServer } from '../../../tests/support/msw';
import { NOW_S, sessionCookie } from '../../../tests/support/session';
import { handleCallback } from './callback';
import { handleLogin } from './login';
import { handleLogout } from './logout';
import { refreshGrant } from './oidc';

vi.mock('@/platform/http/request-context', () => ({
  requestId: async () => 'req-auth',
  currentPath: async () => '/',
}));

const APP = 'http://localhost:9300';
const ME = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  email: 'alice@example.com',
  fullName: 'Alice',
  roles: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const setCookie = (response: Response, name: string) =>
  response.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
const cookieValue = (header: string | undefined) =>
  header?.split(';')[0]?.split('=').slice(1).join('=');

/** Logs in up to the provider: returns the transaction cookie and the authorization URL. */
async function startLogin(returnTo = '/bookings') {
  const response = await handleLogin(
    new Request(`${APP}/auth/login?returnTo=${encodeURIComponent(returnTo)}`),
  );
  expect(response.status).toBe(303);
  const authorize = new URL(response.headers.get('location') as string);
  idpState.challenge = authorize.searchParams.get('code_challenge') ?? '';
  idpState.nonce = authorize.searchParams.get('nonce') ?? '';
  return { txn: `${TXN_COOKIE}=${cookieValue(setCookie(response, TXN_COOKIE))}`, authorize };
}

const callback = (query: string, cookie?: string) =>
  handleCallback(
    new Request(`${APP}/auth/callback?${query}`, { headers: cookie ? { cookie } : {} }),
  );

describe('sign-in flows', () => {
  beforeEach(() => {
    resetOidc();
    useIdp();
  });

  it('starts the code flow with PKCE S256, state, nonce and the scopes', async () => {
    const { authorize, txn } = await startLogin();
    expect(authorize.origin + authorize.pathname).toBe(`${IDP}/authorize`);
    expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
      client_id: 'gaw-web',
      redirect_uri: `${APP}/auth/callback`,
      response_type: 'code',
      scope: 'openid email offline_access',
      code_challenge_method: 'S256',
    });
    expect(authorize.searchParams.get('state')).toBeTruthy();
    expect(txn).toContain(TXN_COOKIE);
  });

  it('signs a registered user in and returns to where they started', async () => {
    mswServer.use(http.get(`${API}/v1/users/me`, () => HttpResponse.json(ME)));
    const { txn, authorize } = await startLogin('/bookings?as=host');
    const response = await callback(
      `code=c1&state=${authorize.searchParams.get('state')}&iss=${encodeURIComponent(IDP)}`,
      txn,
    );
    expect(response.headers.get('location')).toBe(`${APP}/bookings?as=host`);
    expect(setCookie(response, TXN_COOKIE)).toMatch(/Max-Age=0.*Secure|Secure.*Max-Age=0/i);
    const session = await openSession(cookieValue(setCookie(response, SESSION_COOKIE)), NOW_S);
    expect(session).toMatchObject({
      sub: 'alice',
      iss: IDP,
      at: 'access-token-1',
      rt: 'refresh-token-1',
      sid: 'sid-1',
    });
  });

  it('sends a login without a user to registration, with the session', async () => {
    mswServer.use(
      http.get(`${API}/v1/users/me`, () => problemResponse(403, 'USER_NOT_REGISTERED')),
    );
    const { txn, authorize } = await startLogin();
    const response = await callback(
      `code=c1&state=${authorize.searchParams.get('state')}&iss=${encodeURIComponent(IDP)}`,
      txn,
    );
    expect(response.headers.get('location')).toBe(`${APP}/register?returnTo=%2Fbookings`);
    expect(setCookie(response, SESSION_COOKIE)).toBeTruthy();
  });

  it('creates no session when the API refuses the provider token (no login loop)', async () => {
    mswServer.use(http.get(`${API}/v1/users/me`, () => problemResponse(401, 'AUTH_TOKEN_INVALID')));
    const { txn, authorize } = await startLogin();
    const response = await callback(
      `code=c1&state=${authorize.searchParams.get('state')}&iss=${encodeURIComponent(IDP)}`,
      txn,
    );
    expect(response.headers.get('location')).toBe(`${APP}/auth/error?code=API_REJECTED_TOKEN`);
    expect(setCookie(response, SESSION_COOKIE)).toBeUndefined();
  });

  it('refuses a callback without its transaction, with a wrong state, or after a provider error', async () => {
    const { txn, authorize } = await startLogin();
    const state = authorize.searchParams.get('state');
    expect((await callback(`code=c1&state=${state}`)).headers.get('location')).toBe(
      `${APP}/auth/error?code=LOGIN_EXPIRED`,
    );
    expect(
      (await callback(`code=c1&state=other&iss=${encodeURIComponent(IDP)}`, txn)).headers.get(
        'location',
      ),
    ).toBe(`${APP}/auth/error?code=LOGIN_FAILED`);
    const denied = await callback(
      `error=access_denied&error_description=%3Cscript%3E&state=${state}`,
      txn,
    );
    expect(denied.headers.get('location')).toBe(`${APP}/auth/error?code=IDP_ACCESS_DENIED`);
  });

  it('refuses a code the provider will not exchange', async () => {
    idpState.tokenResponse = () => HttpResponse.json({ error: 'invalid_grant' }, { status: 400 });
    const { txn, authorize } = await startLogin();
    const response = await callback(
      `code=c1&state=${authorize.searchParams.get('state')}&iss=${encodeURIComponent(IDP)}`,
      txn,
    );
    expect(response.headers.get('location')).toBe(`${APP}/auth/error?code=LOGIN_FAILED`);
  });

  it('says the provider is unavailable when discovery fails', async () => {
    mswServer.use(http.get(`${IDP}/.well-known/openid-configuration`, () => HttpResponse.error()));
    const response = await handleLogin(new Request(`${APP}/auth/login`));
    expect(response.headers.get('location')).toBe(`${APP}/auth/error?code=IDP_UNAVAILABLE`);
  });

  it('logs out with id_token_hint, clears the cookie, and refuses a cross-origin post', async () => {
    const cookie = await sessionCookie();
    const refused = await handleLogout(
      new Request(`${APP}/auth/logout`, {
        method: 'POST',
        headers: { cookie, origin: 'https://evil.test' },
      }),
    );
    expect(refused.status).toBe(403);
    const response = await handleLogout(
      new Request(`${APP}/auth/logout`, { method: 'POST', headers: { cookie, origin: APP } }),
    );
    const target = new URL(response.headers.get('location') as string);
    expect(target.origin + target.pathname).toBe(`${IDP}/end-session`);
    expect(Object.fromEntries(target.searchParams)).toMatchObject({
      id_token_hint: 'id-token-1',
      client_id: 'gaw-web',
      post_logout_redirect_uri: `${APP}/`,
    });
    expect(setCookie(response, SESSION_COOKIE)).toMatch(/Max-Age=0.*Secure|Secure.*Max-Age=0/i);
  });
});

describe('provider configuration and outages', () => {
  beforeEach(() => {
    resetOidc();
  });

  it.each([
    [
      'an authorization endpoint on another origin',
      { authorization_endpoint: 'https://evil.test/authorize' },
    ],
    ['no PKCE S256', { code_challenge_methods_supported: ['plain'] }],
    [
      'a token endpoint outside the allowed origins',
      { token_endpoint: 'https://tokens.evil.test/token' },
    ],
  ])('refuses a provider with %s', async (_label, override) => {
    mswServer.use(
      http.get(`${IDP}/.well-known/openid-configuration`, () =>
        HttpResponse.json({
          issuer: IDP,
          authorization_endpoint: `${IDP}/authorize`,
          token_endpoint: `${IDP}/token`,
          jwks_uri: `${IDP}/jwks.json`,
          code_challenge_methods_supported: ['S256'],
          ...override,
        }),
      ),
    );
    const response = await handleLogin(new Request(`${APP}/auth/login`));
    expect(response.headers.get('location')).toBe(`${APP}/auth/error?code=IDP_UNAVAILABLE`);
  });

  it('keeps the session but says so when the API is down at sign-in', async () => {
    useIdp();
    mswServer.use(http.get(`${API}/v1/users/me`, () => HttpResponse.error()));
    const { txn, authorize } = await startLogin();
    const response = await callback(
      `code=c1&state=${authorize.searchParams.get('state')}&iss=${encodeURIComponent(IDP)}`,
      txn,
    );
    expect(response.headers.get('location')).toBe(`${APP}/auth/error?code=API_UNAVAILABLE`);
    expect(setCookie(response, SESSION_COOKIE)).toBeTruthy();
  });

  it('logs out to the home page when the provider has no end-session endpoint', async () => {
    mswServer.use(
      http.get(`${IDP}/.well-known/openid-configuration`, () =>
        HttpResponse.json({
          issuer: IDP,
          authorization_endpoint: `${IDP}/authorize`,
          token_endpoint: `${IDP}/token`,
          jwks_uri: `${IDP}/jwks.json`,
          code_challenge_methods_supported: ['S256'],
        }),
      ),
    );
    const response = await handleLogout(
      new Request(`${APP}/auth/logout`, {
        method: 'POST',
        headers: { cookie: await sessionCookie(), origin: APP },
      }),
    );
    expect(response.headers.get('location')).toBe(`${APP}/`);
  });
});

describe('refresh grant', () => {
  beforeEach(() => {
    resetOidc();
    useIdp();
  });

  it('returns rotated tokens', async () => {
    idpState.tokenResponse = () =>
      HttpResponse.json({
        access_token: 'at-2',
        token_type: 'Bearer',
        expires_in: 60,
        refresh_token: 'rt-2',
      });
    expect(await refreshGrant('rt-1')).toMatchObject({
      access_token: 'at-2',
      refresh_token: 'rt-2',
    });
  });

  it.each([
    [
      () => HttpResponse.json({ error: 'invalid_grant' }, { status: 400 }),
      { kind: 'ended', reason: 'invalid_grant' },
    ],
    [
      () => HttpResponse.json({ error: 'server_error' }, { status: 503 }),
      { kind: 'unavailable', reason: 'idp_5xx' },
    ],
    [
      () => HttpResponse.json({ error: 'unauthorized_client' }, { status: 400 }),
      { kind: 'unavailable', reason: 'misconfigured' },
    ],
    [() => HttpResponse.error(), { kind: 'unavailable', reason: 'network' }],
  ])('classifies a failed grant (%#)', async (answer, outcome) => {
    idpState.tokenResponse = answer;
    await expect(refreshGrant('rt-1')).rejects.toSatisfy(
      (error) =>
        error instanceof RefreshGrantError &&
        JSON.stringify(error.outcome) === JSON.stringify(outcome),
    );
  });
});
