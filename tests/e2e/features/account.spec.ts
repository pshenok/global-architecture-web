import { expect, test } from '../support/fixtures.ts';
import { register, signIn } from '../support/sign-in.ts';
import { runId } from '../support/stack.ts';

test.describe('registration and account', () => {
  test('a new login registers, then lands where it was going', async ({ page }) => {
    await signIn(page, `e2e-${runId()}-newcomer`, { returnTo: '/bookings' });
    await expect(page).toHaveURL(/\/register\?returnTo=%2Fbookings/);
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(
      `e2e-${runId()}-newcomer@example.com`,
    );
    await register(page, 'New Comer');
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(page.getByRole('button', { name: /New Comer/ })).toBeVisible();
  });

  test('a user renames themselves and the header follows', async ({ page }) => {
    await signIn(page, `e2e-${runId()}-renamer`);
    await page.goto('/register');
    await register(page, 'Before Rename');
    await page.goto('/account');
    await page.getByLabel('Name').fill('After Rename');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText('Your name is saved');
    await expect(page.getByRole('button', { name: /After Rename/ })).toBeVisible();
  });

  test('deleting the account signs out here and at the provider', async ({ page }) => {
    await signIn(page, `e2e-${runId()}-leaver`);
    await page.goto('/register');
    await register(page, 'Leaving Soon');
    await page.goto('/account');
    await page.getByRole('button', { name: 'Delete account' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete account' }).click();
    await expect(page).toHaveURL(/localhost:9301\/houses/);
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    expect((await page.context().cookies()).some((c) => c.name === '__Host-Http-gaw-session')).toBe(
      false,
    );
  });
});
