import type { NavEntry } from '@/ui/app-shell';

export type { House, HouseLookup, HouseSummary } from './model/house';

export const nav: readonly NavEntry[] = [
  { href: '/houses', label: 'Houses', audience: 'everyone' },
  { href: '/houses/mine', label: 'My houses', audience: 'user' },
];
