import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import type { FormState } from '@/kernel/form-state';
import { expectAccessible } from '../../../../tests/support/axe';
import { SampleItemForm } from './sample-item-form';

type Field = 'name' | 'description' | 'id';

describe('SampleItemForm', () => {
  it('shows the field error the action returns, keeps the input and passes axe', async () => {
    const action = async (_state: FormState<Field>, form: FormData): Promise<FormState<Field>> => ({
      status: 'error',
      message: 'You already have one with this name.',
      fieldErrors: { name: 'You already have one with this name.' },
      values: { name: String(form.get('name')) },
    });
    const screen = await render(
      <main>
        <h1>New sample item</h1>
        <SampleItemForm action={action} initial={{}} submitLabel="Create" />
      </main>,
    );
    await screen.getByLabelText('Name').fill('Lamp');
    await screen.getByRole('button', { name: 'Create' }).click();
    await expect.element(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    await expect.element(screen.getByLabelText('Name')).toHaveValue('Lamp');
    await expect.element(screen.getByLabelText('Name')).toHaveFocus();
    await expectAccessible();
  });
});
