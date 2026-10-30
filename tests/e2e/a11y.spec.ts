import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { as, day, expect, listHouse, test } from './support/fixtures.ts';
import { runId } from './support/stack.ts';

async function expectAccessible(page: Page, path: string): Promise<void> {
  await page.goto(path);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.map(
      (v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([]);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main#main')).toHaveCount(1);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`every page passes axe (${colorScheme})`, async ({ browser }) => {
    const host = await as(browser, 'host');
    await host.emulateMedia({ colorScheme });
    const houseId = await listHouse(host, `Accessible ${runId()} ${colorScheme}`);
    for (const path of [
      '/houses',
      `/houses/${houseId}`,
      '/houses/new',
      `/houses/${houseId}/edit`,
      '/houses/mine',
      '/bookings',
      '/account',
      '/auth/error?code=LOGIN_FAILED',
      '/no-such-page',
    ]) {
      await expectAccessible(host, path);
    }
    const admin = await as(browser, 'admin');
    await admin.emulateMedia({ colorScheme });
    await expectAccessible(admin, '/admin/users');
  });
}

test('a booking can be made with the keyboard alone', async ({ browser }) => {
  const host = await as(browser, 'host');
  const houseId = await listHouse(host, `Keyboard ${runId()}`);
  const guest = await as(browser, 'guest');
  await guest.goto(`/houses/${houseId}`);
  await guest.keyboard.press('Tab');
  await expect(guest.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  // Chromium's date input keeps focus in its year segment after typing; Tab until it leaves.
  const typeDate = async (date: string) => {
    const [year, month, dayOfMonth] = date.split('-');
    await guest.keyboard.type(`${month}${dayOfMonth}${year}`);
    const field = await guest.evaluate(() => document.activeElement?.id);
    for (
      let i = 0;
      i < 3 && (await guest.evaluate(() => document.activeElement?.id)) === field;
      i += 1
    ) {
      await guest.keyboard.press('Tab');
    }
  };
  await guest.getByLabel('Check-in').focus();
  await typeDate(day(70));
  await expect(guest.getByLabel('Check-out')).toBeFocused();
  await typeDate(day(72));
  await expect(guest.getByLabel('Guests')).toBeFocused();
  await guest.keyboard.press('Tab');
  await expect(guest.getByRole('button', { name: 'Book' })).toBeFocused();
  await guest.keyboard.press('Enter');
  await expect(guest).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/);
});
