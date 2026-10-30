import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import type { FormState } from '@/kernel/form-state';
import { expectAccessible } from '../../../../tests/support/axe';
import { CancelBooking } from './cancel-booking';

const ID = '01890a5d-ac96-774b-bcce-b302099a8057';

describe('CancelBooking', () => {
  it('shows Cancelled at once, before the action settles', async () => {
    let settle: (state: FormState<'id'>) => void = () => undefined;
    const pending = (_s: FormState<'id'>, _f: FormData) =>
      new Promise<FormState<'id'>>((resolve) => (settle = resolve));
    const screen = await render(
      <main>
        <h1>Booking</h1>
        <CancelBooking action={pending} bookingId={ID} status="CONFIRMED" cancellable />
      </main>,
    );
    await expect.element(screen.getByText('Confirmed')).toBeVisible();
    await screen.getByRole('button', { name: 'Cancel booking' }).click();
    await expect.element(screen.getByRole('alertdialog')).toBeVisible();
    await expectAccessible();
    await screen.getByRole('alertdialog').getByRole('button', { name: 'Cancel booking' }).click();
    await expect.element(screen.getByText('Cancelled')).toBeVisible();
    settle({ status: 'success' });
  });

  it('restores the status and explains when cancelling fails', async () => {
    const failing = async (): Promise<FormState<'id'>> => ({
      status: 'error',
      message: 'The service is unavailable. Try again in a moment.',
      fieldErrors: {},
      values: {},
    });
    const screen = await render(
      <main>
        <h1>Booking</h1>
        <CancelBooking action={failing} bookingId={ID} status="CONFIRMED" cancellable />
      </main>,
    );
    await screen.getByRole('button', { name: 'Cancel booking' }).click();
    await screen.getByRole('alertdialog').getByRole('button', { name: 'Cancel booking' }).click();
    await expect.element(screen.getByRole('alert')).toBeVisible();
    await expect.element(screen.getByText('Confirmed')).toBeVisible();
  });

  it('offers no cancel for a finished or cancelled stay', async () => {
    const screen = await render(
      <CancelBooking
        action={async () => ({ status: 'idle' })}
        bookingId={ID}
        status="CANCELLED"
        cancellable={false}
      />,
    );
    await expect.element(screen.getByText('Cancelled')).toBeVisible();
    expect(screen.getByRole('button').elements()).toHaveLength(0);
  });
});
