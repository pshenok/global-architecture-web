import type { NavEntry } from '@/ui/app-shell';

export type { SampleItem } from './model/sample-item';

export const nav: readonly NavEntry[] = [
  { href: '/sample-items', label: 'Sample items', audience: 'user' },
];
