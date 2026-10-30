import { as, expect, listHouse, test } from '../support/fixtures.ts';
import { runId } from '../support/stack.ts';

test.describe('houses', () => {
  test('anyone can browse and filter the catalogue', async ({ browser, page }) => {
    const host = await as(browser, 'host');
    const city = `Lviv-${runId()}`;
    await host.goto('/houses/new');
    await host.getByLabel('Title', { exact: true }).fill(`Catalogue house ${runId()}`);
    await host.getByLabel('Street address').fill('2 Market Sq');
    await host.getByLabel('City').fill(city);
    await host.getByLabel('Country code').fill('UA');
    await host.getByLabel('Price per night').fill('80');
    await host.getByRole('button', { name: 'List house' }).click();
    await host.waitForURL(/\/houses\/[0-9a-f-]{36}$/);

    const response = await page.goto('/houses');
    expect(response?.status()).toBe(200);
    await page.getByRole('searchbox').or(page.getByPlaceholder('Filter by city')).fill(city);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(new RegExp(`city=${city}`));
    await expect(page.getByRole('link', { name: `Catalogue house ${runId()}` })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Houses' })).toBeVisible();
  });

  test('a host lists, edits and deletes a house, with validation on the way', async ({
    browser,
  }) => {
    const host = await as(browser, 'host');
    await host.goto('/houses/new');
    await host.getByLabel('Title', { exact: true }).fill('Seaside');
    await host.getByLabel('Street address').fill('1 Shore Rd');
    await host.getByLabel('City').fill('Odesa');
    await host.getByLabel('Country code').fill('UA');
    await host.getByLabel('Price per night').fill('12.345');
    await host.getByRole('button', { name: 'List house' }).click();
    await expect(host.getByRole('main').getByRole('alert')).toContainText(
      'Check the highlighted fields',
    );
    await expect(host.getByLabel('Price per night')).toHaveAttribute('aria-invalid', 'true');
    await expect(host.getByLabel('Title', { exact: true })).toHaveValue('Seaside');

    await host.getByLabel('Price per night').fill('120.50');
    await host.getByRole('button', { name: 'List house' }).click();
    await host.waitForURL(/\/houses\/[0-9a-f-]{36}$/);
    await expect(host.getByText('$120.50')).toBeVisible();

    await host.getByRole('link', { name: 'Edit' }).click();
    await host.getByLabel('Title', { exact: true }).fill('Seaside villa');
    await host.getByRole('button', { name: 'Save changes' }).click();
    await expect(host.getByRole('heading', { level: 1 })).toHaveText('Seaside villa');
    const url = host.url();

    await host.getByRole('link', { name: 'Edit' }).click();
    await host.getByRole('button', { name: 'Delete house' }).click();
    await host.getByRole('alertdialog').getByRole('button', { name: 'Delete house' }).click();
    await expect(host).toHaveURL(/\/houses\/mine$/);
    expect((await host.goto(url))?.status()).toBe(404);
  });

  test("nobody else can edit a host's house", async ({ browser }) => {
    const host = await as(browser, 'host');
    const id = await listHouse(host, `Private ${runId()}`);
    const stranger = await as(browser, 'stranger');
    expect((await stranger.goto(`/houses/${id}/edit`))?.status()).toBe(404);
    await stranger.goto(`/houses/${id}`);
    await expect(stranger.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  });
});
