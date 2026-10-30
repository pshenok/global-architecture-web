import 'server-only';
import type { Page } from '@/kernel/page';
import { PAGE_SIZE } from '@/kernel/page';
import {
  type ApiResult,
  anonymous,
  api,
  type components,
  settle,
  withCaller,
} from '@/platform/api';
import type { Caller } from '@/platform/session';
import type { House } from '../model/house';
import type { toHouseBody } from '../model/house-form';

type ApiHouse = components['schemas']['House'];

const toHouse = (house: ApiHouse): House => ({
  id: house.id,
  ownerId: house.ownerId,
  title: house.title,
  description: house.description,
  address: house.address,
  nightlyPrice: house.nightlyPrice,
  maxGuests: house.maxGuests,
  createdAt: house.createdAt,
});

const toPage = (page: components['schemas']['HousePage']): Page<House> => ({
  items: page.items.map(toHouse),
  nextPageToken: page.nextPageToken,
});

/** The public catalogue: never with a token (an expired cookie must not turn it into a 401). */
export async function listHouses(query: {
  city?: string | undefined;
  ownerId?: string;
  pageToken?: string | undefined;
}): Promise<ApiResult<Page<House>>> {
  return settle(
    api().GET('/v1/houses', {
      params: {
        query: {
          pageSize: PAGE_SIZE,
          ...(query.city ? { city: query.city } : {}),
          ...(query.ownerId ? { ownerId: query.ownerId } : {}),
          ...(query.pageToken ? { pageToken: query.pageToken } : {}),
        },
      },
      ...(await anonymous()),
    }),
    toPage,
  );
}

export async function getHouse(id: string): Promise<ApiResult<House>> {
  return settle(
    api().GET('/v1/houses/{id}', { params: { path: { id } }, ...(await anonymous()) }),
    toHouse,
  );
}

export async function createHouse(
  caller: Caller,
  body: ReturnType<typeof toHouseBody>,
): Promise<ApiResult<House>> {
  return settle(
    api().POST('/v1/houses', { body, ...(await withCaller(caller, 'write')) }),
    toHouse,
  );
}

export async function updateHouse(
  caller: Caller,
  id: string,
  body: ReturnType<typeof toHouseBody>,
): Promise<ApiResult<House>> {
  return settle(
    api().PATCH('/v1/houses/{id}', {
      params: { path: { id } },
      body,
      ...(await withCaller(caller, 'write')),
    }),
    toHouse,
  );
}

export async function deleteHouse(caller: Caller, id: string): Promise<ApiResult<null>> {
  return settle(
    api().DELETE('/v1/houses/{id}', {
      params: { path: { id } },
      ...(await withCaller(caller, 'write')),
    }),
    () => null,
  );
}
