import { z } from 'zod';
import type { KnownProblemCode } from '@/kernel/problem-codes';

const fullName = z.string().trim().min(1, 'Enter your name').max(200, 'At most 200 characters');

export const RegisterForm = z.object({ fullName, returnTo: z.string().default('/houses') });
export const RenameForm = z.object({ fullName });
export const NoInput = z.object({});
export const UserIdForm = z.object({ id: z.uuid() });

export const USER_MESSAGES = {
  USER_EMAIL_TAKEN:
    'Another account already uses this email. Sign out and sign in with that account.',
  EMAIL_NOT_VERIFIED: 'Your sign-in provider has not verified your email yet.',
  USER_NOT_FOUND: 'This account no longer exists.',
} satisfies Partial<Record<KnownProblemCode, string>>;
