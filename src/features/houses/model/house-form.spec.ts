import { describe, expect, it } from 'vitest';
import {
  EditHouseForm,
  HouseForm,
  priceEditable,
  toCreateHouseBody,
  toUpdateHouseBody,
} from './house-form';

const base = {
  title: ' Cabin ',
  line1: '1 Shore Rd',
  city: 'Odesa',
  countryCode: 'ua',
  maxGuests: '2',
};
const ID = '01890a5d-ac96-774b-bcce-b302099a8057';

describe('house form', () => {
  it('turns typed values into the API body, in minor units', () => {
    const form = HouseForm.parse({ ...base, currencyCode: 'USD', price: '120.5' });
    expect(toCreateHouseBody(form)).toEqual({
      title: 'Cabin',
      description: '',
      address: { line1: '1 Shore Rd', city: 'Odesa', countryCode: 'UA' },
      nightlyPrice: { currencyCode: 'USD', amountMinor: 12050 },
      maxGuests: 2,
    });
  });

  it('refuses a price with too many decimals for its currency', () => {
    expect(HouseForm.safeParse({ ...base, currencyCode: 'JPY', price: '1500.5' }).success).toBe(
      false,
    );
    expect(HouseForm.safeParse({ ...base, currencyCode: 'SEK', price: '100' }).success).toBe(false);
  });

  it('leaves a price it cannot edit out of the update', () => {
    const { id: _id, ...kept } = EditHouseForm.parse({ ...base, id: ID, keepPrice: 'true' });
    expect(toUpdateHouseBody(kept)).not.toHaveProperty('nightlyPrice');
    const { id: _id2, ...changed } = EditHouseForm.parse({
      ...base,
      id: ID,
      currencyCode: 'EUR',
      price: '90',
    });
    expect(toUpdateHouseBody(changed)).toMatchObject({
      nightlyPrice: { currencyCode: 'EUR', amountMinor: 9000 },
    });
    expect(
      EditHouseForm.safeParse({ ...base, id: ID, currencyCode: 'SEK', price: '90' }).success,
    ).toBe(false);
  });

  it('knows which currencies it can edit', () => {
    expect(priceEditable('USD')).toBe(true);
    expect(priceEditable('SEK')).toBe(false);
  });
});
