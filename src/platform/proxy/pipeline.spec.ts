import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { getEnv } from '@/platform/config/env';
import { SESSION_COOKIE } from '@/platform/session/cookies';
import { openSession } from '@/platform/session/read';
import type { RefreshOutcome } from '@/platform/session/refresh';
import { NOW_S, sessionCookie, testSession } from '../../../tests/support/session';
import { config } from '../../proxy';
import { type ProxyDeps, runProxy } from './pipeline';

const APP = 'http://localhost:9300';

function deps(refresh: ProxyDeps['refresh'] = vi.fn()): ProxyDeps {
  return {
    env: getEnv(),
    now: () => NOW_S,
    refresh,
    nonce: () => 'bm9uY2U=',
    requestId: () => 'req-proxy',
  };
}

const request = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(`${APP}${path}`, { method: init.method ?? 'GET', headers: init.headers ?? {} });

/** The Set-Cookie value written for the session, or undefined. */
const sessionWrite = (response: Response) =>
  response.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`));

describe('proxy pipeline', () => {
  it('refuses an unsafe request whose Origin is not the app, before any session work', async () => {
    const refresh = vi.fn();
    for (const headers of [
      {},
      { origin: 'null' },
      { origin: 'https://evil.test' },
      { origin: `${APP}.evil.test` },
    ]) {
      const response = await runProxy(
        request('/houses', { method: 'POST', headers }),
        deps(refresh),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: 'CSRF_ORIGIN_MISMATCH' });
    }
    expect(refresh).not.toHaveBeenCalled();
    const sameOrigin = await runProxy(
      request('/houses', { method: 'POST', headers: { origin: APP } }),
      deps(),
    );
    expect(sameOrigin.status).toBe(200);
  });

  it('sends a signed-out page request to sign-in with its path, but lets public pages through', async () => {
    const response = await runProxy(request('/bookings?as=host'), deps());
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `${APP}/auth/login?returnTo=%2Fbookings%3Fas%3Dhost`,
    );
    expect((await runProxy(request('/houses'), deps())).status).toBe(200);
    expect((await runProxy(request('/auth/login'), deps())).status).toBe(200);
  });

  it('never redirects an unsafe method: the action answers it', async () => {
    const response = await runProxy(
      request('/bookings', { method: 'POST', headers: { origin: APP } }),
      deps(),
    );
    expect(response.status).toBe(200);
  });

  it('puts the same CSP on the request and the response, and overwrites inbound ids', async () => {
    const response = await runProxy(
      request('/houses?city=Kyiv', {
        headers: { 'x-request-id': 'forged', 'x-gaw-path': '//evil', 'x-gaw-other': '1' },
      }),
      deps(),
    );
    const csp = response.headers.get('content-security-policy');
    expect(csp).toContain("'nonce-bm9uY2U='");
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
    expect(response.headers.get('x-request-id')).toBe('req-proxy');
    expect(response.headers.get('x-middleware-request-x-request-id')).toBe('req-proxy');
    expect(response.headers.get('x-middleware-request-x-gaw-path')).toBe('/houses?city=Kyiv');
    expect(response.headers.get('x-middleware-request-x-gaw-other')).toBeNull();
  });

  it('refreshes a due session and writes the new cookie for this same render', async () => {
    const due = testSession({ atExp: NOW_S + 5 });
    const refreshed = testSession({
      at: 'access-token-2',
      rt: 'refresh-token-2',
      atExp: NOW_S + 300,
    });
    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({ kind: 'refreshed', session: refreshed }),
    );
    const response = await runProxy(
      request('/bookings', { headers: { cookie: await sessionCookie(due) } }),
      deps(refresh),
    );
    expect(response.status).toBe(200);
    expect(refresh).toHaveBeenCalledOnce();
    const written = sessionWrite(response);
    expect(written).toMatch(/HttpOnly/i);
    expect(written).toMatch(/Secure/i);
    expect(written).toMatch(/SameSite=lax/i);
    const value = written?.split(';')[0]?.split('=').slice(1).join('=');
    expect((await openSession(value, NOW_S))?.at).toBe('access-token-2');
  });

  it('clears an ended session and sends the page to sign-in', async () => {
    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({ kind: 'ended', reason: 'invalid_grant' }),
    );
    const cookie = await sessionCookie(testSession({ atExp: NOW_S + 5 }));
    const response = await runProxy(request('/bookings', { headers: { cookie } }), deps(refresh));
    expect(response.status).toBe(307);
    expect(sessionWrite(response)).toMatch(/Max-Age=0.*Secure|Secure.*Max-Age=0/i);
  });

  it('keeps the session when the IdP is unavailable', async () => {
    const refresh = vi.fn(
      async (): Promise<RefreshOutcome> => ({ kind: 'unavailable', reason: 'network' }),
    );
    const cookie = await sessionCookie(testSession({ atExp: NOW_S + 5 }));
    const response = await runProxy(request('/bookings', { headers: { cookie } }), deps(refresh));
    expect(response.status).toBe(200);
    expect(sessionWrite(response)).toBeUndefined();
  });

  it('clears a cookie it cannot open, and leaves a fresh session alone', async () => {
    const garbage = await runProxy(
      request('/houses', { headers: { cookie: `${SESSION_COOKIE}=garbage` } }),
      deps(),
    );
    expect(garbage.status).toBe(200);
    expect(sessionWrite(garbage)).toMatch(/Max-Age=0.*Secure|Secure.*Max-Age=0/i);
    const refresh = vi.fn();
    const fresh = await runProxy(
      request('/bookings', { headers: { cookie: await sessionCookie() } }),
      deps(refresh),
    );
    expect(fresh.status).toBe(200);
    expect(refresh).not.toHaveBeenCalled();
    expect(sessionWrite(fresh)).toBeUndefined();
  });

  it('does no session work on /auth and /healthz', async () => {
    const refresh = vi.fn();
    const cookie = await sessionCookie(testSession({ atExp: NOW_S + 5 }));
    await runProxy(request('/auth/callback?code=x', { headers: { cookie } }), deps(refresh));
    await runProxy(request('/healthz', { headers: { cookie } }), deps(refresh));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('runs on pages, actions and handlers, but not on static assets (pinned matcher)', () => {
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });
    for (const url of [
      '/',
      '/houses',
      '/houses/new',
      '/auth/login',
      '/healthz',
      '/bookings/x?y=1',
    ]) {
      expect(matches(url), url).toBe(true);
    }
    for (const url of [
      '/_next/static/chunks/a.js',
      '/_next/image?url=x',
      '/favicon.ico',
      '/icon.svg',
      '/robots.txt',
    ]) {
      expect(matches(url), url).toBe(false);
    }
  });
});
