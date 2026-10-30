'use client';

import {
  CalendarDaysIcon,
  ChevronDownIcon,
  HomeIcon,
  LogOutIcon,
  ShieldIcon,
  UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/primitives/dropdown-menu';

/** The signed-in user's menu. Sign-out is a form POST (no GET logout exists). */
export function UserMenu({
  name,
  email,
  admin,
}: {
  name: string;
  email: string | null;
  admin: boolean;
}) {
  return (
    <>
      <form id="sign-out-form" method="post" action="/auth/logout" hidden />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" />}>
          <UserIcon aria-hidden="true" data-icon="inline-start" />
          <span className="max-w-40 truncate">{name}</span>
          <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block truncate font-medium text-foreground">{name}</span>
              {email ? <span className="block truncate text-xs font-normal">{email}</span> : null}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/account" />}>
            <UserIcon aria-hidden="true" />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/bookings" />}>
            <CalendarDaysIcon aria-hidden="true" />
            My bookings
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/houses/mine" />}>
            <HomeIcon aria-hidden="true" />
            My houses
          </DropdownMenuItem>
          {admin ? (
            <DropdownMenuItem render={<Link href="/admin/users" />}>
              <ShieldIcon aria-hidden="true" />
              Users (admin)
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<button type="submit" form="sign-out-form" />}>
            <LogOutIcon aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
