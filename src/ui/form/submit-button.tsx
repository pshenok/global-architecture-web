'use client';

import { Loader2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/ui/primitives/button';

/** The form's submit button: pending while the action runs, still focusable when disabled. */
export function SubmitButton({
  children,
  variant,
}: {
  readonly children: ReactNode;
  readonly variant?: 'default' | 'destructive' | 'outline';
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant ?? 'default'}
      disabled={pending}
      focusableWhenDisabled
      aria-busy={pending || undefined}
    >
      {pending ? (
        <Loader2Icon aria-hidden="true" data-icon="inline-start" className="animate-spin" />
      ) : null}
      {children}
    </Button>
  );
}
