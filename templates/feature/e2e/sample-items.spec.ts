import { as, expect, test } from '../support/fixtures.ts';
import { signIn } from '../support/sign-in.ts';
import { runId } from '../support/stack.ts';

/**
 * The five access tests every feature keeps (the twin of the monolith module template's):
 * the API decides, and the web shows its answers the same way everywhere. Runs once the
 * monolith mounts the module (pnpm new:module there, then stack:up).
 */
test.describe('sample items: access', () => {
  async function createdBy(owner: import('@playwright/test').Page): Promise<string> {
    await owner.goto('/sample-items/new');
    await owner
      .getByLabel('Name')
      .fill(`Sample ${runId()} ${Math.random().toString(36).slice(2, 7)}`);
    await owner.getByRole('button', { name: 'Create' }).click();
    await owner.waitForURL(/\/sample-items\/[0-9a-f-]{36}$/);
    return owner.url();
  }

  test('anonymous visitors sign in first', async ({ page }) => {
    await page.goto('/sample-items');
    await expect(page).toHaveURL(/127\.0\.0\.1:9090\/authorize/);
  });

  test("someone else's item is a 404", async ({ browser }) => {
    const url = await createdBy(await as(browser, 'host'));
    const stranger = await as(browser, 'stranger');
    expect((await stranger.goto(url))?.status()).toBe(404);
  });

  test('an admin sees it', async ({ browser }) => {
    const url = await createdBy(await as(browser, 'host'));
    const admin = await as(browser, 'admin');
    expect((await admin.goto(url))?.status()).toBe(200);
  });

  test("a stranger's list does not show it", async ({ browser }) => {
    const host = await as(browser, 'host');
    await createdBy(host);
    const name = await host.getByRole('heading', { level: 1 }).textContent();
    const stranger = await as(browser, 'stranger');
    await stranger.goto('/sample-items');
    await expect(stranger.getByRole('link', { name: name ?? '' })).toHaveCount(0);
  });

  test('a login without a user registers first', async ({ page }) => {
    await signIn(page, `e2e-${runId()}-sample-items-unregistered`, { returnTo: '/sample-items' });
    await expect(page).toHaveURL(/\/register\?returnTo=%2Fsample-items/);
  });
});
