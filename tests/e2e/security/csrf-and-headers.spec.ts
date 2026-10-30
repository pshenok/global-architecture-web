import { expect, test } from '../support/fixtures.ts';
import { APP } from '../support/stack.ts';

test.describe('CSRF and headers', () => {
  test('refuses cross-origin and Origin-less posts before anything runs', async ({ request }) => {
    for (const headers of [{ origin: 'https://evil.test' }, {}, { origin: 'null' }]) {
      const action = await request.post('/houses/new', {
        headers: { ...headers, 'next-action': 'x' },
        data: 'a=1',
        maxRedirects: 0,
      });
      expect(action.status()).toBe(403);
      expect(await action.json()).toMatchObject({ code: 'CSRF_ORIGIN_MISMATCH' });
      const logout = await request.post('/auth/logout', { headers, maxRedirects: 0 });
      expect(logout.status()).toBe(403);
    }
    const sameOrigin = await request.post('/auth/logout', {
      headers: { origin: APP },
      maxRedirects: 0,
    });
    expect(sameOrigin.status()).toBe(303);
  });

  test('sends hardening headers on pages and assets', async ({ request, page }) => {
    const response = await request.get('/houses');
    const headers = response.headers();
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['content-security-policy']).toMatch(
      /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
    );
    expect(headers['x-powered-by']).toBeUndefined();
    await page.goto('/houses');
    const asset = await page.evaluate(
      () => (document.querySelector('script[src]') as HTMLScriptElement).src,
    );
    const assetHeaders = (await request.get(asset)).headers();
    expect(assetHeaders['x-content-type-options']).toBe('nosniff');
  });
});
