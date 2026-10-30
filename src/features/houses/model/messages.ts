import type { KnownProblemCode } from '@/kernel/problem-codes';

export const HOUSE_MESSAGES = {
  HOUSE_NOT_FOUND: 'This house no longer exists.',
  HOUSE_PERMISSION_DENIED: 'Only the owner can change this house.',
  HOUSE_OWNER_NOT_FOUND: 'Your account no longer exists. Sign in again.',
} satisfies Partial<Record<KnownProblemCode, string>>;
