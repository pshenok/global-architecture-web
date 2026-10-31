import 'server-only';
import type { Page } from '@/kernel/page';
import { PAGE_SIZE } from '@/kernel/page';
import { type ApiResult, api, type components, settle, withCaller } from '@/platform/api';
import type { Caller } from '@/platform/session';
import type { SampleItem } from '../model/sample-item';

type ApiSampleItem = components['schemas']['SampleItem'];

const toSampleItem = (item: ApiSampleItem): SampleItem => ({
  id: item.id,
  ownerId: item.ownerId,
  name: item.name,
  description: item.description,
  createdAt: item.createdAt,
});

/** The caller's sample items (an admin's: everyone's), newest first. */
export async function listSampleItems(
  caller: Caller,
  pageToken: string | undefined,
): Promise<ApiResult<Page<SampleItem>>> {
  return settle(
    api().GET('/v1/sample-items', {
      params: { query: { pageSize: PAGE_SIZE, ...(pageToken ? { pageToken } : {}) } },
      ...(await withCaller(caller)),
    }),
    (page) => ({ items: page.items.map(toSampleItem), nextPageToken: page.nextPageToken }),
  );
}

export async function getSampleItem(caller: Caller, id: string): Promise<ApiResult<SampleItem>> {
  return settle(
    api().GET('/v1/sample-items/{id}', { params: { path: { id } }, ...(await withCaller(caller)) }),
    toSampleItem,
  );
}

export async function createSampleItem(
  caller: Caller,
  body: { name: string; description: string },
): Promise<ApiResult<SampleItem>> {
  return settle(
    api().POST('/v1/sample-items', { body, ...(await withCaller(caller, 'write')) }),
    toSampleItem,
  );
}

export async function updateSampleItem(
  caller: Caller,
  id: string,
  body: { name: string; description: string },
): Promise<ApiResult<SampleItem>> {
  return settle(
    api().PATCH('/v1/sample-items/{id}', {
      params: { path: { id } },
      body,
      ...(await withCaller(caller, 'write')),
    }),
    toSampleItem,
  );
}

export async function deleteSampleItem(caller: Caller, id: string): Promise<ApiResult<null>> {
  return settle(
    api().DELETE('/v1/sample-items/{id}', {
      params: { path: { id } },
      ...(await withCaller(caller, 'write')),
    }),
    () => null,
  );
}
