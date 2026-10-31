import type { Money } from '@/kernel/money';

/** A house as the UI shows it (mapped from the API's House by data/). */
export interface House {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly description: string;
  readonly address: { readonly line1: string; readonly city: string; readonly countryCode: string };
  readonly nightlyPrice: Money;
  readonly maxGuests: number;
  readonly createdAt: string;
}

/** What another feature (bookings) may read about a house. */
export interface HouseSummary {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly city: string;
  readonly nightlyPrice: Money;
  readonly maxGuests: number;
}

/** A house another feature asked about. */
export type HouseLookup =
  | { readonly status: 'found'; readonly house: HouseSummary }
  | { readonly status: 'gone' }
  | { readonly status: 'unavailable' };

export const toSummary = (house: House): HouseSummary => ({
  id: house.id,
  ownerId: house.ownerId,
  title: house.title,
  city: house.address.city,
  nightlyPrice: house.nightlyPrice,
  maxGuests: house.maxGuests,
});

/** UX only: the API decides (it answers 404 to anyone else). */
export const canEdit = (house: Pick<House, 'ownerId'>, userId: string | undefined) =>
  userId !== undefined && house.ownerId === userId;
