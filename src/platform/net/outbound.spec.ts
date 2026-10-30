import { HttpResponse, http } from 'msw/http';
import { describe, expect, it } from 'vitest';
import { API, mswServer } from '../../../tests/support/msw';
import { apiFetch, createOutboundFetch, idpFetch, OutboundBlockedError } from './outbound';

describe('outbound fetch', () => {
  it('calls the API on /v1/ paths only', async () => {
    mswServer.use(http.get(`${API}/v1/houses`, () => HttpResponse.json({ ok: true })));
    const response = await apiFetch(`${API}/v1/houses`);
    expect(await response.json()).toEqual({ ok: true });
    expect(() => apiFetch(`${API}/openapi.json`)).toThrow(OutboundBlockedError);
  });

  it('refuses any origin that is not allowlisted, before sending anything', () => {
    expect(() => apiFetch('https://evil.test/v1/houses')).toThrow(OutboundBlockedError);
    expect(() => idpFetch(`${API}/token`)).toThrow(OutboundBlockedError);
    expect(() => apiFetch('http://api.test/v1/houses')).toThrow(OutboundBlockedError);
  });

  it('never follows a redirect', async () => {
    mswServer.use(
      http.get(`${API}/v1/redirect`, () =>
        HttpResponse.text('', { status: 302, headers: { location: 'https://evil.test/' } }),
      ),
    );
    await expect(apiFetch(`${API}/v1/redirect`)).rejects.toThrow();
  });

  it('gives up at its deadline', async () => {
    mswServer.use(
      http.get(`${API}/v1/slow`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return HttpResponse.json({});
      }),
    );
    const quick = createOutboundFetch({ name: 'api', allowedOrigins: () => [API], timeoutMs: 20 });
    await expect(quick(`${API}/v1/slow`)).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
