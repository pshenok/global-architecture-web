import type { ComponentProps, ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/ui/primitives/field';
import { Input } from '@/ui/primitives/input';
import { NativeSelect, NativeSelectOption } from '@/ui/primitives/native-select';
import { Textarea } from '@/ui/primitives/textarea';

/**
 * Labelled form fields with the accessibility wiring done once: id/htmlFor, aria-invalid,
 * aria-describedby to the hint and the error. Uncontrolled (defaultValue): React resets a
 * form after an action, so callers pass the echoed value back as the default.
 */
interface FieldProps {
  readonly name: string;
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: ReactNode;
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function FieldShell({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {hint ? <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription> : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  );
}

export function TextField({
  name,
  label,
  error,
  hint,
  ...input
}: FieldProps & Omit<ComponentProps<'input'>, 'name'>) {
  const id = `field-${name}`;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...input}
      />
    </FieldShell>
  );
}

export function TextareaField({
  name,
  label,
  error,
  hint,
  ...textarea
}: FieldProps & Omit<ComponentProps<'textarea'>, 'name'>) {
  const id = `field-${name}`;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <Textarea
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...textarea}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  error,
  hint,
  options,
  ...select
}: FieldProps &
  Omit<ComponentProps<'select'>, 'name' | 'size'> & {
    readonly options: readonly { value: string; label: string }[];
  }) {
  const id = `field-${name}`;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <NativeSelect
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...select}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </FieldShell>
  );
}
