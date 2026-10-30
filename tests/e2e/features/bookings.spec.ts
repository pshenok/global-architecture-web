import { as, day, expect, listHouse, test } from '../support/fixtures.ts';
import { runId } from '../support/stack.ts';

async function book(
  page: import('@playwright/test').Page,
  houseId: string,
  from: number,
  to: number,
  guests = 1,
) {
  await page.goto(`/houses/${houseId}`);
  await page.getByLabel('Check-in').fill(day(from));
  await page.getByLabel('Check-out').fill(day(to));
  await page.getByLabel('Guests').fill(String(guests));
  await page.getByRole('button', { name: 'Book' }).click();
}

test.describe('bookings', () => {
  test('a guest books a house; the host sees it; the guest cancels', async ({ browser }) => {
    const host = await as(browser, 'host');
    const houseId = await listHouse(host, `Bookable ${runId()}`, { price: '100', maxGuests: 3 });
    const guest = await as(browser, 'guest');
    await book(guest, houseId, 10, 13, 2);
    await guest.waitForURL(/\/bookings\/[0-9a-f-]{36}$/);
    await expect(guest.getByText('$300.00')).toBeVisible();
    await expect(guest.getByText('Confirmed')).toBeVisible();
    const bookingUrl = guest.url();

    await host.goto('/bookings?as=host');
    await expect(host.getByRole('link', { name: `Bookable ${runId()}` })).toBeVisible();

    await guest.goto(bookingUrl);
    await guest.getByRole('button', { name: 'Cancel booking' }).click();
    await guest.getByRole('alertdialog').getByRole('button', { name: 'Cancel booking' }).click();
    await expect(guest.getByText('Cancelled')).toBeVisible();
    await expect(guest.getByRole('main').getByRole('status')).toContainText(
      'The booking is cancelled',
    );
    await guest.reload();
    await expect(guest.getByText('Cancelled')).toBeVisible();
  });

  test('taken dates and too many guests are explained at their fields', async ({ browser }) => {
    const host = await as(browser, 'host');
    const houseId = await listHouse(host, `Popular ${runId()}`, { maxGuests: 2 });
    const guest = await as(browser, 'guest');
    await book(guest, houseId, 20, 23);
    await guest.waitForURL(/\/bookings\//);

    const stranger = await as(browser, 'stranger');
    await book(stranger, houseId, 21, 24);
    await expect(stranger.getByRole('main').getByRole('alert')).toContainText('already booked');
    await expect(stranger.getByLabel('Check-in')).toHaveAttribute('aria-invalid', 'true');

    // Past the browser's own max: the API is the authority.
    await stranger.goto(`/houses/${houseId}`);
    await stranger
      .getByRole('main')
      .locator('form')
      .evaluate((form: HTMLFormElement) => {
        form.noValidate = true;
      });
    await stranger.getByLabel('Check-in').fill(day(40));
    await stranger.getByLabel('Check-out').fill(day(41));
    await stranger.getByLabel('Guests').fill('5');
    await stranger.getByRole('button', { name: 'Book' }).click();
    await expect(stranger.getByLabel('Guests')).toHaveAccessibleDescription(
      /sleeps at most 2 guests/,
    );
  });

  test("someone else's booking does not exist for you", async ({ browser }) => {
    const host = await as(browser, 'host');
    const houseId = await listHouse(host, `Discreet ${runId()}`);
    const guest = await as(browser, 'guest');
    await book(guest, houseId, 50, 52);
    await guest.waitForURL(/\/bookings\//);
    const stranger = await as(browser, 'stranger');
    expect((await stranger.goto(guest.url()))?.status()).toBe(404);
  });
});
