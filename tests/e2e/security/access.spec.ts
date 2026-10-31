import { as, expect, test } from '../support/fixtures.ts';
import { signIn } from '../support/sign-in.ts';
import { runId } from '../support/stack.ts';

const PROTECTED = [
  '/houses/new',
  '/houses/mine',
  '/bookings',
  '/bookings/01890a5d-ac96-774b-bcce-b302099a8057',
  '/account',
  '/register',
  '/admin/users',
  '/admin/users/01890a5d-ac96-774b-bcce-b302099a8057',
  '/houses/01890a5d-ac96-774b-bcce-b302099a8057/edit',
  '/no-such-page',
];

test.describe('access', () => {
  test('every protected route sends an anonymous visitor to sign in, keeping the way back', async ({
    page,
  }) => {
    for (const path of PROTECTED) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/127\.0\.0\.1:9090\/authorize/);
    }
  });

  test('the public catalogue works for anonymous visitors, with a real 404 for unknown houses', async ({
    page,
  }) => {
    expect((await page.goto('/houses'))?.status()).toBe(200);
    expect((await page.goto('/houses/01890a5d-ac96-774b-bcce-b302099a8057'))?.status()).toBe(404);
  });

  test('a returnTo that leaves the site is ignored after sign-in', async ({ page }) => {
    // A registered login (the guest persona's subject): the callback goes straight to
    // returnTo, so only the sanitizing keeps it on this site.
    for (const target of [
      '//evil.test/x',
      'https://evil.test/x',
      '/\\evil.test',
      '/\t/evil.test/x',
    ]) {
      await page.context().clearCookies();
      await page.goto(`/auth/login?returnTo=${encodeURIComponent(target)}`);
      await page.getByLabel('Subject (login id)').fill(`e2e-${runId()}-guest`);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page).toHaveURL('http://localhost:9301/houses');
    }
  });

  test('a cancelled sign-in explains itself without reflecting provider text', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/auth\/error\?code=IDP_ACCESS_DENIED/);
    await expect(page.getByText('The sign-in was cancelled.')).toBeVisible();
    await signIn(page, `e2e-${runId()}-after-cancel`);
  });

  test('a session that ended before a client-side navigation still lands on sign-in', async ({
    browser,
  }) => {
    const guest = await as(browser, 'guest');
    await guest.goto('/houses');
    await guest.context().clearCookies();
    await guest.getByRole('link', { name: 'Bookings' }).click();
    await expect(guest).toHaveURL(/127\.0\.0\.1:9090\/authorize/);
  });

  test('registration never forwards to another site, however returnTo is written', async ({
    browser,
  }) => {
    const guest = await as(browser, 'guest');
    for (const target of [
      '/\t/evil.test/x',
      '//evil.test/x',
      '/\\evil.test',
      'https://evil.test/x',
    ]) {
      await guest.goto(`/register?returnTo=${encodeURIComponent(target)}`);
      await expect(guest).toHaveURL(/^http:\/\/localhost:9301\/houses/);
    }
  });
});
