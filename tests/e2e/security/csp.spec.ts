import type { Page } from '@playwright/test';
import { as, expect, listHouse, test } from '../support/fixtures.ts';
import { runId } from '../support/stack.ts';

/** Records CSP violations the page reports, from the very first script. */
async function watchCsp(page: Page): Promise<string[]> {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/.test(message.text())) violations.push(message.text());
  });
  await page.exposeFunction('__cspViolation', (text: string) => violations.push(text));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { __cspViolation: (t: string) => void }).__cspViolation(
        `${event.violatedDirective} ${event.blockedURI}`,
      );
    });
  });
  return violations;
}

async function expectNoncedPage(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  const nonce = /'nonce-([^']+)'/.exec(response?.headers()['content-security-policy'] ?? '')?.[1];
  expect(nonce, path).toBeTruthy();
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.nonce));
  expect(scripts.length).toBeGreaterThan(0);
  expect(
    scripts.every((n) => n === nonce),
    `every script on ${path} carries the nonce`,
  ).toBe(true);
}

test.describe('CSP', () => {
  test('every page carries a fresh nonce on every script, with no violations', async ({
    browser,
  }) => {
    const host = await as(browser, 'host');
    const houseId = await listHouse(host, `Nonce ${runId()}`);
    const violations = await watchCsp(host);
    const paths = [
      '/houses',
      `/houses/${houseId}`,
      `/houses/${houseId}/edit`,
      '/houses/new',
      '/houses/mine',
      '/bookings',
      '/bookings?as=host',
      '/account',
      '/auth/error?code=LOGIN_FAILED',
    ];
    const nonces = new Set<string>();
    for (const path of paths) {
      await expectNoncedPage(host, path);
      nonces.add(await host.evaluate(() => document.scripts[0]?.nonce ?? ''));
    }
    expect(nonces.size).toBe(paths.length);
    expect(violations).toEqual([]);
  });

  test('soft navigations and dialogs load chunks without violations', async ({ browser }) => {
    const host = await as(browser, 'host');
    const violations = await watchCsp(host);
    await host.goto('/houses');
    await host.getByRole('link', { name: 'My houses' }).click();
    await expect(host).toHaveURL(/\/houses\/mine/);
    await host.getByRole('link', { name: 'Bookings' }).click();
    await expect(host).toHaveURL(/\/bookings/);
    await host.getByRole('button', { name: /Host/ }).click();
    await expect(host.getByRole('menu')).toBeVisible();
    await host.keyboard.press('Escape');
    await host.goto('/account');
    await host.getByRole('button', { name: 'Delete account' }).click();
    await expect(host.getByRole('alertdialog')).toBeVisible();
    await host.getByRole('button', { name: 'Keep it' }).click();
    expect(violations).toEqual([]);
  });
});
