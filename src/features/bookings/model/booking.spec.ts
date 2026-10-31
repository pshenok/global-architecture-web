import { describe, expect, it } from 'vitest';
import { canCancel, houseLabel } from './booking';

describe('booking model', () => {
  it('names the house, or says why it cannot', () => {
    const house = {
      id: 'h',
      ownerId: 'o',
      title: 'Cabin',
      city: 'Odesa',
      nightlyPrice: { currencyCode: 'USD', amountMinor: 1 },
      maxGuests: 2,
    };
    expect(houseLabel({ status: 'found', house })).toBe('Cabin');
    expect(houseLabel({ status: 'gone' })).toBe('House no longer listed');
    expect(houseLabel({ status: 'unavailable' })).toBe('House details unavailable');
  });

  it('offers cancelling a confirmed stay until its check-out day', () => {
    expect(canCancel({ status: 'CONFIRMED', checkOut: '2026-11-02' }, '2026-11-01')).toBe(true);
    expect(canCancel({ status: 'CONFIRMED', checkOut: '2026-11-01' }, '2026-11-01')).toBe(false);
    expect(canCancel({ status: 'CANCELLED', checkOut: '2026-12-01' }, '2026-11-01')).toBe(false);
  });
});
