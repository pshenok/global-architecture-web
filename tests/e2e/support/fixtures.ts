import { type Browser, test as base, type Page } from '@playwright/test';

export type Persona = 'host' | 'guest' | 'stranger' | 'admin' | 'unregistered';

/** A page signed in as a persona (from personas.setup.ts). */
export async function as(browser: Browser, persona: Persona): Promise<Page> {
  const context = await browser.newContext({
    storageState: `tests/e2e/.auth/${persona}.json`,
    reducedMotion: 'reduce',
  });
  return context.newPage();
}

export const test = base;
export { expect } from '@playwright/test';

/** A calendar date n days from today (UTC), as the API counts them. */
export function day(n: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + n * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
}

/** Lists a house through the UI as the given page's user; returns its id. */
export async function listHouse(
  page: Page,
  title: string,
  options: { maxGuests?: number; price?: string } = {},
): Promise<string> {
  await page.goto('/houses/new');
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Street address').fill('1 Test St');
  await page.getByLabel('City').fill('Kyiv');
  await page.getByLabel('Country code').fill('UA');
  await page.getByLabel('Price per night').fill(options.price ?? '100');
  await page.getByLabel('Guests').fill(String(options.maxGuests ?? 3));
  await page.getByRole('button', { name: 'List house' }).click();
  await page.waitForURL(/\/houses\/[0-9a-f-]{36}$/);
  return page.url().split('/').at(-1) as string;
}
