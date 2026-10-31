import { HttpResponse, http } from 'msw/http';
import { describe, expect, it, vi } from 'vitest';
import { problemResponse } from '@/platform/api/testing';
import { testCaller } from '@/platform/session/testing';
import { API, mswServer } from '../../../../tests/support/msw';
import { createSampleItem, getSampleItem, listSampleItems } from './sample-items.gateway';

vi.mock('@/platform/http/request-context', () => ({
  requestId: async () => 'req-1',
  currentPath: async () => '/',
}));

const ITEM = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  ownerId: '01890a5d-ac96-774b-bcce-b302099a8058',
  name: 'Lamp',
  description: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('sample items gateway', () => {
  it('acts as the caller, with the request id', async () => {
    let headers: Headers | undefined;
    mswServer.use(
      http.get(`${API}/v1/sample-items`, ({ request }) => {
        headers = request.headers;
        return HttpResponse.json({ items: [ITEM], nextPageToken: null });
      }),
    );
    const result = await listSampleItems(testCaller('tok'), undefined);
    expect(result).toMatchObject({
      ok: true,
      value: { items: [{ id: ITEM.id, name: 'Lamp' }], nextPageToken: null },
    });
    expect(headers?.get('authorization')).toBe('Bearer tok');
    expect(headers?.get('x-request-id')).toBe('req-1');
  });

  it('passes the module problems through', async () => {
    mswServer.use(
      http.get(`${API}/v1/sample-items/${ITEM.id}`, () =>
        problemResponse(404, 'SAMPLE_ITEM_NOT_FOUND'),
      ),
      http.post(`${API}/v1/sample-items`, () =>
        problemResponse(409, 'SAMPLE_ITEM_NAME_TAKEN', { metadata: { name: 'Lamp' } }),
      ),
    );
    expect(await getSampleItem(testCaller(), ITEM.id)).toMatchObject({
      ok: false,
      problem: { status: 404, code: 'SAMPLE_ITEM_NOT_FOUND' },
    });
    expect(await createSampleItem(testCaller(), { name: 'Lamp', description: '' })).toMatchObject({
      ok: false,
      problem: { status: 409, code: 'SAMPLE_ITEM_NAME_TAKEN', metadata: { name: 'Lamp' } },
    });
  });
});
