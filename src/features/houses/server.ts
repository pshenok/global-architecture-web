import 'server-only';
import { cache } from 'react';
import { getHouse } from './data/houses.gateway';
import { type HouseSummary, toSummary } from './model/house';

export { HouseCatalogueView } from './views/catalogue';
export { HouseDetailView, houseDetailMetadata } from './views/house-detail';
export { EditHouseView, NewHouseView } from './views/house-editor';
export { MyHousesView } from './views/my-houses';

/** A house's summary, or null when it is gone (a booking outlives its house). */
export const findHouseSummary = cache(async (id: string): Promise<HouseSummary | null> => {
  const result = await getHouse(id);
  return result.ok ? toSummary(result.value) : null;
});
