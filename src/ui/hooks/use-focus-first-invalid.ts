'use client';

import { type RefObject, useEffect } from 'react';
import type { FormState } from '@/kernel/form-state';

/** After a failed submit, moves focus to the first invalid field (or the form's alert). */
export function useFocusFirstInvalid(
  form: RefObject<HTMLFormElement | null>,
  state: FormState,
): void {
  useEffect(() => {
    if (state.status !== 'error') return;
    const target =
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form.current?.querySelector<HTMLElement>('[data-slot="form-alert"]');
    target?.focus();
  }, [form, state]);
}
