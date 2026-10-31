import { HttpResponse, http } from 'msw/http';
import { describe, expect, it, vi } from 'vitest';
import { problemResponse } from '@/platform/api/testing';
import { API, mswServer } from '../../../tests/support/msw';
import { findHouseSummary } from './server';

vi.mock('@/platform/http/request-context', () => ({
  requestId: async () => 'req',
  currentPath: async () => '/',
}));

const ID = '01890a5d-ac96-774b-bcce-b302099a8057';
const HOUSE = {
  id: ID,
  ownerId: '01890a5d-ac96-774b-bcce-b302099a8058',
  title: 'Cabin',
  description: '',
  address: { line1: '1 Shore Rd', city: 'Odesa', countryCode: 'UA' },
  nightlyPrice: { currencyCode: 'USD', amountMinor: 12000 },
  maxGuests: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('findHouseSummary', () => {
  it('tells a gone house from an API that cannot answer', async () => {
    mswServer.use(http.get(`${API}/v1/houses/${ID}`, () => HttpResponse.json(HOUSE)));
    expect(await findHouseSummary(ID)).toMatchObject({
      status: 'found',
      house: { title: 'Cabin', city: 'Odesa' },
    });
    mswServer.use(
      http.get(`${API}/v1/houses/${ID}`, () => problemResponse(404, 'HOUSE_NOT_FOUND')),
    );
    expect(await findHouseSummary(ID)).toEqual({ status: 'gone' });
    mswServer.use(
      http.get(`${API}/v1/houses/${ID}`, () => problemResponse(503, 'DATABASE_TIMEOUT')),
    );
    expect(await findHouseSummary(ID)).toEqual({ status: 'unavailable' });
  });
});
