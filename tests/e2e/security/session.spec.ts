import type { BrowserContext } from '@playwright/test';
import { jwtDecrypt } from 'jose';
import { expect, test } from '../support/fixtures.ts';
import { register, signIn } from '../support/sign-in.ts';
import { runId, sessionKeys } from '../support/stack.ts';

const SESSION = '__Host-Http-gaw-session';

async function sessionOf(
  context: BrowserContext,
): Promise<{ value: string; at: string; rt: string; idt: string }> {
  const cookie = (await context.cookies()).find((c) => c.name === SESSION);
  if (!cookie) throw new Error('no session cookie');
  const keys = sessionKeys();
  const { payload } = await jwtDecrypt(cookie.value, (header) =>
    Buffer.from(keys.find((k) => k.kid === header.kid)?.key ?? '', 'base64url'),
  );
  return { value: cookie.value, ...(payload as { at: string; rt: string; idt: string }) };
}

test.describe('session', () => {
  test('one HttpOnly, Secure, host-only, SameSite=Lax cookie holds the session', async ({
    page,
  }) => {
    await signIn(page, `e2e-${runId()}-cookies`);
    const cookies = await page.context().cookies();
    expect(cookies.map((c) => c.name)).toEqual([SESSION]);
    expect(cookies[0]).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      domain: 'localhost',
    });
    expect(await page.evaluate(() => document.cookie)).toBe('');
  });

  test('tokens never reach the browser: not in HTML, RSC payloads or storage', async ({ page }) => {
    const bodies: string[] = [];
    page.on('response', async (response) => {
      if (response.url().startsWith('http://localhost:9301'))
        bodies.push(await response.text().catch(() => ''));
    });
    await signIn(page, `e2e-${runId()}-leak`);
    await page.goto('/register');
    await register(page, 'Leak Check');
    const { at, rt, idt } = await sessionOf(page.context());
    for (const path of ['/houses', '/bookings', '/account', '/houses/mine']) {
      await page.goto(path);
      await page.getByRole('link', { name: 'Houses', exact: true }).click();
    }
    const storage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    for (const token of [at, rt, idt]) {
      expect(bodies.some((body) => body.includes(token))).toBe(false);
      expect(storage.includes(token)).toBe(false);
    }
  });

  test('an expired access token is renewed once for a burst of tabs, then again later', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await signIn(page, `e2e-${runId()}-refresh`, { accessTtl: 6 });
    await page.goto('/register');
    await register(page, 'Refresh Burst');
    const before = await sessionOf(context);
    await page.waitForTimeout(7_000);
    // Five tabs at once with the same expired cookie: the dev IdP revokes the login on
    // any refresh-token reuse, so a race would sign everyone out.
    const tabs = await Promise.all(Array.from({ length: 5 }, () => context.newPage()));
    const paths = ['/bookings', '/account', '/houses/mine', '/bookings?as=host', '/houses/new'];
    const statuses = await Promise.all(
      tabs.map(async (tab, i) => (await tab.goto(paths[i] ?? '/'))?.status()),
    );
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
    for (const tab of tabs) await expect(tab).not.toHaveURL(/authorize|auth\/error/);
    const after = await sessionOf(context);
    expect(after.at).not.toBe(before.at);
    expect(after.rt).not.toBe(before.rt);
    await page.waitForTimeout(7_000);
    expect((await page.goto('/account'))?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible();
    await context.close();
  });

  test('signing out ends the login: an old copy of the cookie stops working', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, `e2e-${runId()}-logout`, { accessTtl: 6 });
    await page.goto('/register');
    await register(page, 'Log Out');
    const stolen = (await context.cookies()).find((c) => c.name === SESSION);
    await page.getByRole('button', { name: /Log Out/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/localhost:9301\/houses/);
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

    const replay = await browser.newContext();
    if (stolen) await replay.addCookies([stolen]);
    await new Promise((resolve) => setTimeout(resolve, 7_000));
    const thief = await replay.newPage();
    await thief.goto('/account');
    await expect(thief).toHaveURL(/127\.0\.0\.1:9090\/authorize/);
    await context.close();
    await replay.close();
  });
});
