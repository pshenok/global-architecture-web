import { nav as bookings } from '@/features/bookings';
import { nav as houses } from '@/features/houses';
import { nav as users } from '@/features/users';
import type { NavEntry } from '@/ui/app-shell';

export const NAV: readonly NavEntry[] = [
  ...houses,
  ...bookings,
  ...users,
  // pnpm new:feature adds nav entries
];
