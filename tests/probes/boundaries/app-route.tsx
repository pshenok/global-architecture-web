// as: src/app/houses/probe/page.tsx

import { nav } from '@/features/houses';
import { HouseCatalogueView } from '@/features/houses/server';
import { HouseCard } from '@/features/houses/ui/house-card'; // refused
import { api } from '@/platform/api'; // refused
import { requireUser } from '@/platform/session'; // refused
import { getHouse } from '../../../features/houses/data/houses.gateway'; // refused

export default function Page() {
  return [HouseCatalogueView, nav, HouseCard, api, requireUser, getHouse];
}
