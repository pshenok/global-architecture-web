import 'server-only';
import { cache } from 'react';
import { getHouse } from './data/houses.gateway';
import { type HouseLookup, type HouseSummary, toSummary } from './model/house';
import { loadHouse } from './views/house-detail';

export { HouseCatalogueView } from './views/catalogue';
export { HouseDetailView, houseDetailMetadata } from './views/house-detail';
export { EditHouseView, NewHouseView } from './views/house-editor';
export { MyHousesView } from './views/my-houses';

/**
 * For views on a house's own page: the same cached read as the page, so no second call,
 * and the same interrupts (an unknown house is a 404).
 */
export const getHouseSummary = cache(
  async (id: string): Promise<HouseSummary> => toSummary(await loadHouse(id)),
);

/**
 * For views about something else (a booking outlives its house): found, gone (the API
 * answered 404), or unavailable (the API could not say, so say that rather than "gone").
 */
export const findHouseSummary = cache(async (id: string): Promise<HouseLookup> => {
  const result = await getHouse(id);
  if (result.ok) return { status: 'found', house: toSummary(result.value) };
  return result.problem.status === 404 ? { status: 'gone' } : { status: 'unavailable' };
});
