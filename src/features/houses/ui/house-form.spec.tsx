import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type { FormState } from '@/kernel/form-state';
import { expectAccessible } from '../../../../tests/support/axe';
import { HouseForm } from './house-form';

type Field = Parameters<typeof HouseForm>[0]['action'] extends (
  s: FormState<infer F>,
  f: FormData,
) => unknown
  ? F
  : never;

const failing = vi.fn(
  async (_state: FormState<Field>, form: FormData): Promise<FormState<Field>> => ({
    status: 'error',
    message: 'Check the highlighted fields.',
    code: 'VALIDATION_FAILED',
    fieldErrors: { price: 'A positive amount, e.g. 120 or 120.50' },
    values: Object.fromEntries(
      [...form].filter((e): e is [string, string] => typeof e[1] === 'string'),
    ),
  }),
);

describe('HouseForm', () => {
  it('labels every field and passes axe', async () => {
    const screen = await render(
      <main>
        <h1>List a house</h1>
        <HouseForm
          action={failing}
          initial={{ currencyCode: 'USD', maxGuests: '2' }}
          submitLabel="List house"
        />
      </main>,
    );
    for (const label of [
      'Title',
      'Description',
      'Street address',
      'City',
      'Country code',
      'Price per night',
      'Currency',
      'Guests',
    ]) {
      await expect.element(screen.getByLabelText(label, { exact: true })).toBeVisible();
    }
    await expectAccessible();
  });

  it('keeps what was typed, marks the invalid field and moves focus to it', async () => {
    const screen = await render(
      <main>
        <h1>List a house</h1>
        <HouseForm
          action={failing}
          initial={{ currencyCode: 'USD', maxGuests: '2' }}
          submitLabel="List house"
        />
      </main>,
    );
    await screen.getByLabelText('Title', { exact: true }).fill('Cabin');
    await screen.getByLabelText('Street address').fill('1 Shore Rd');
    await screen.getByLabelText('City').fill('Odesa');
    await screen.getByLabelText('Country code').fill('UA');
    await screen.getByLabelText('Price per night').fill('12.345');
    await screen.getByRole('button', { name: 'List house' }).click();

    const price = screen.getByLabelText('Price per night');
    await expect.element(screen.getByRole('alert')).toBeVisible();
    await expect.element(price).toHaveAttribute('aria-invalid', 'true');
    await expect.element(price).toHaveAccessibleDescription(/A positive amount/);
    await expect.element(price).toHaveFocus();
    await expect.element(screen.getByLabelText('Title', { exact: true })).toHaveValue('Cabin');
    await expect.element(price).toHaveValue('12.345');
    expect(failing).toHaveBeenCalledOnce();
    await expectAccessible();
    await page.screenshot({ save: false });
  });
});
