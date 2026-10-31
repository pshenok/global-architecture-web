'use server';

import { localPath } from '@/kernel/local-path';
import { defineAction } from '@/platform/actions';
import * as users from './data/users.gateway';
import { NoInput, RegisterForm, RenameForm, USER_MESSAGES, UserIdForm } from './model/forms';

/** Registers the login (identity access: it has no user yet). A double submit is fine. */
export const registerUser = defineAction({
  access: 'identity',
  input: RegisterForm,
  messages: USER_MESSAGES,
  run: async ({ caller }, { fullName, returnTo }) => {
    const result = await users.registerUser(caller, fullName);
    const done = {
      kind: 'redirect' as const,
      to: localPath(returnTo) ?? '/houses',
      shell: 'stale' as const,
    };
    if (!result.ok && result.problem.code === 'USER_ALREADY_REGISTERED') return done;
    return result.ok ? done : result;
  },
});

export const renameAccount = defineAction({
  access: 'user',
  input: RenameForm,
  messages: USER_MESSAGES,
  run: async ({ caller }, { fullName }) => {
    const result = await users.renameMe(caller, fullName);
    return result.ok ? { kind: 'refresh', message: 'Your name is saved.', shell: 'stale' } : result;
  },
});

/** Deletes the account, then signs out here and at the provider. */
export const deleteAccount = defineAction({
  access: 'user',
  input: NoInput,
  messages: USER_MESSAGES,
  run: async ({ caller }) => {
    const result = await users.deleteUser(caller, 'me');
    return result.ok ? { kind: 'logout' } : result;
  },
});

export const deleteUser = defineAction({
  access: 'admin',
  input: UserIdForm,
  messages: USER_MESSAGES,
  run: async ({ caller }, { id }) => {
    const result = await users.deleteUser(caller, id);
    const gone = !result.ok && result.problem.code === 'USER_NOT_FOUND';
    return result.ok || gone ? { kind: 'redirect', to: '/admin/users' } : result;
  },
});
