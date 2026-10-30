import 'server-only';
import type { Page } from '@/kernel/page';
import { PAGE_SIZE } from '@/kernel/page';
import { type ApiResult, api, type components, settle, withCaller } from '@/platform/api';
import type { Caller } from '@/platform/session';
import type { User } from '../model/user';

type ApiUser = components['schemas']['User'];

const toUser = (user: ApiUser): User => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  roles: user.roles,
  createdAt: user.createdAt,
});

/** Registers the signed-in login (the API takes the email from its token). */
export async function registerUser(caller: Caller, fullName: string): Promise<ApiResult<User>> {
  return settle(
    api().POST('/v1/users', { body: { fullName }, ...(await withCaller(caller, 'write')) }),
    toUser,
  );
}

export async function renameMe(caller: Caller, fullName: string): Promise<ApiResult<User>> {
  return settle(
    api().PATCH('/v1/users/{id}', {
      params: { path: { id: 'me' } },
      body: { fullName },
      ...(await withCaller(caller, 'write')),
    }),
    toUser,
  );
}

export async function deleteUser(caller: Caller, id: string | 'me'): Promise<ApiResult<null>> {
  return settle(
    api().DELETE('/v1/users/{id}', {
      params: { path: { id } },
      ...(await withCaller(caller, 'write')),
    }),
    () => null,
  );
}

/** Admins only (the API answers 403 to anyone else). */
export async function listUsers(
  caller: Caller,
  pageToken: string | undefined,
): Promise<ApiResult<Page<User>>> {
  return settle(
    api().GET('/v1/users', {
      params: { query: { pageSize: PAGE_SIZE, ...(pageToken ? { pageToken } : {}) } },
      ...(await withCaller(caller)),
    }),
    (page) => ({ items: page.items.map(toUser), nextPageToken: page.nextPageToken }),
  );
}

export async function getUser(caller: Caller, id: string): Promise<ApiResult<User>> {
  return settle(
    api().GET('/v1/users/{id}', { params: { path: { id } }, ...(await withCaller(caller)) }),
    toUser,
  );
}
