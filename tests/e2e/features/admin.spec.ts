import { as, expect, test } from '../support/fixtures.ts';

test.describe('admin', () => {
  test('an admin lists users and opens one', async ({ browser }) => {
    const admin = await as(browser, 'admin');
    await admin.goto('/admin/users');
    await expect(admin.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
    await admin.getByRole('table').getByRole('link').first().click();
    await expect(admin).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/);
  });

  test('everyone else gets a 404', async ({ browser }) => {
    const guest = await as(browser, 'guest');
    expect((await guest.goto('/admin/users'))?.status()).toBe(404);
  });
});
