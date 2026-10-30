import { HttpResponse, http } from 'msw/http';
import { describe, expect, it, vi } from 'vitest';
import { API, mswServer } from '../../../tests/support/msw';
import { testCaller } from '../session/testing';
import { anonymous, settle, withCaller } from './call';
import { ApiMisuseError, api } from './client';
import { problemResponse } from './testing';

vi.mock('@/platform/http/request-context', () => ({
  requestId: async () => 'req-1',
  currentPath: async () => '/',
}));

const HOUSE = '01890a5d-ac96-774b-bcce-b302099a8057';

describe('API client', () => {
  it('sends the caller token and the request id to protected operations', async () => {
    let seen: Headers | undefined;
    mswServer.use(
      http.get(`${API}/v1/bookings`, ({ request }) => {
        seen = request.headers;
        return HttpResponse.json({ items: [], nextPageToken: null });
      }),
    );
    const result = await settle(
      api().GET('/v1/bookings', { ...(await withCaller(testCaller('tok'))) }),
    );
    expect(result).toEqual({ ok: true, value: { items: [], nextPageToken: null } });
    expect(seen?.get('authorization')).toBe('Bearer tok');
    expect(seen?.get('x-request-id')).toBe('req-1');
  });

  it('refuses a token on a public operation and a missing one on a protected operation', async () => {
    await expect(
      api().GET('/v1/houses/{id}', {
        params: { path: { id: HOUSE } },
        ...(await withCaller(testCaller())),
      }),
    ).rejects.toThrow(ApiMisuseError);
    await expect(api().GET('/v1/bookings', { ...(await anonymous()) })).rejects.toThrow(
      'MISSING_TOKEN',
    );
  });

  it('refuses operations the contract does not list', async () => {
    const untyped = api() as unknown as { GET: (path: string, init: object) => Promise<unknown> };
    await expect(untyped.GET('/v1/secret', await anonymous())).rejects.toThrow('UNKNOWN_OPERATION');
  });

  it('normalizes problem responses, keeping field errors and metadata', async () => {
    mswServer.use(
      http.post(`${API}/v1/bookings`, () =>
        problemResponse(412, 'BOOKING_TOO_MANY_GUESTS', {
          detail: 'the house sleeps at most 2 guests',
          metadata: { maxGuests: '2' },
        }),
      ),
    );
    const result = await settle(
      api().POST('/v1/bookings', {
        body: { houseId: HOUSE, checkIn: '2030-01-01', checkOut: '2030-01-02', guests: 5 },
        ...(await withCaller(testCaller(), 'write')),
      }),
    );
    expect(result).toEqual({
      ok: false,
      problem: expect.objectContaining({
        status: 412,
        code: 'BOOKING_TOO_MANY_GUESTS',
        detail: 'the house sleeps at most 2 guests',
        metadata: { maxGuests: '2' },
        requestId: 'req-api',
        origin: 'api',
      }),
    });
  });

  it('never passes a 5xx detail on, and classifies bodies that are not problems', async () => {
    mswServer.use(
      http.get(`${API}/v1/houses`, () =>
        HttpResponse.json(
          { status: 500, code: 'INTERNAL', detail: 'stack trace' },
          { status: 500 },
        ),
      ),
      http.get(`${API}/v1/houses/${HOUSE}`, () =>
        HttpResponse.text('<html>bad gateway</html>', { status: 502 }),
      ),
    );
    const internal = await settle(api().GET('/v1/houses', { ...(await anonymous()) }));
    expect(internal).toMatchObject({ ok: false, problem: { code: 'INTERNAL' } });
    expect(internal.ok ? undefined : internal.problem.detail).toBeUndefined();
    const gateway = await settle(
      api().GET('/v1/houses/{id}', { params: { path: { id: HOUSE } }, ...(await anonymous()) }),
    );
    expect(gateway).toMatchObject({
      ok: false,
      problem: { status: 502, code: 'UPSTREAM_BAD_RESPONSE' },
    });
  });

  it('turns network failures and timeouts into BFF problems', async () => {
    mswServer.use(http.get(`${API}/v1/houses`, () => HttpResponse.error()));
    expect(await settle(api().GET('/v1/houses', { ...(await anonymous()) }))).toMatchObject({
      ok: false,
      problem: { status: 503, code: 'UPSTREAM_UNAVAILABLE', origin: 'bff' },
    });
    mswServer.use(
      http.get(`${API}/v1/houses`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({ items: [], nextPageToken: null });
      }),
    );
    expect(
      await settle(api().GET('/v1/houses', { headers: {}, signal: AbortSignal.timeout(10) })),
    ).toMatchObject({ ok: false, problem: { status: 504, code: 'UPSTREAM_TIMEOUT' } });
  });
});
