import type { NavEntry } from '@/ui/app-shell';

export type { User } from './model/user';
export { UserMenu } from './ui/user-menu';

export const nav: readonly NavEntry[] = [
  { href: '/admin/users', label: 'Users', audience: 'admin' },
];
