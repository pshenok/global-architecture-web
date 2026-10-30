import type { VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { buttonVariants } from '@/ui/primitives/button';

/** A link styled as a button (Base UI idiom: never a <button> wrapping a link). */
export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return <Link className={buttonVariants({ variant, size, className })} {...props} />;
}
