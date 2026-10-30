import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { expectAccessible } from '../../../tests/support/axe';
import { FormAlert } from './form-alert';

describe('FormAlert', () => {
  it('announces an error once, with a sign-in link when the session ended', async () => {
    const screen = await render(
      <main>
        <FormAlert
          state={{
            status: 'error',
            message: 'Your session has ended.',
            fieldErrors: {},
            values: {},
            signIn: true,
            requestId: 'req-9',
          }}
        />
      </main>,
    );
    await expect.element(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByRole('alert').element().textContent).toContain('Your session has ended.');
    await expect
      .element(screen.getByRole('link', { name: 'Sign in' }))
      .toHaveAttribute('href', '/auth/login');
    await expect.element(screen.getByText('Reference: req-9')).toBeVisible();
    await expectAccessible();
  });

  it('uses a polite status for success, and renders nothing when idle', async () => {
    const screen = await render(
      <main>
        <FormAlert state={{ status: 'success', message: 'Saved.' }} />
        <FormAlert state={{ status: 'idle' }} />
      </main>,
    );
    await expect.element(screen.getByRole('status')).toBeVisible();
    expect(screen.getByRole('status').element().textContent).toContain('Saved.');
    expect(document.querySelectorAll('[data-slot="form-alert"]')).toHaveLength(1);
    await expectAccessible();
  });
});
