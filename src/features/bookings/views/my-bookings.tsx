import 'server-only';
import { CalendarDaysIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { findHouseSummary } from '@/features/houses/server';
import { orInterrupt } from '@/platform/errors';
import { requireUser } from '@/platform/session';
import { EmptyState } from '@/ui/empty-state';
import { LinkButton } from '@/ui/link-button';
import { PageHeader } from '@/ui/page-header';
import { Pager } from '@/ui/pager';
import { listBookings } from '../data/bookings.gateway';
import { BookingsTable } from '../ui/bookings-table';

const Query = z.object({
  as: z.enum(['guest', 'host']).catch('guest'),
  pageToken: z.string().min(1).max(512).optional().catch(undefined),
});

export async function MyBookingsView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { caller } = await requireUser();
  const query = Query.parse(await searchParams);
  const page = await orInterrupt(listBookings(caller, query), {
    firstPage: `/bookings?as=${query.as}`,
  });
  const houseIds = [...new Set(page.items.map((b) => b.houseId))];
  const houses = new Map(
    await Promise.all(houseIds.map(async (id) => [id, await findHouseSummary(id)] as const)),
  );
  const tab = (as: 'guest' | 'host', label: string) => (
    <Link
      href={`/bookings?as=${as}` as Route}
      aria-current={query.as === as ? 'page' : undefined}
      className="rounded-md px-3 py-1.5 text-sm text-muted-foreground aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground"
    >
      {label}
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Bookings"
        description={query.as === 'guest' ? 'Your stays' : 'Stays at your houses'}
      />
      <nav aria-label="Bookings" className="mb-6 flex gap-1">
        {tab('guest', 'As guest')}
        {tab('host', 'As host')}
      </nav>
      {page.items.length === 0 ? (
        <EmptyState
          icon={<CalendarDaysIcon aria-hidden="true" />}
          title={query.as === 'guest' ? 'No stays yet' : 'No one has booked your houses yet'}
          {...(query.as === 'guest'
            ? { action: <LinkButton href="/houses">Find a house</LinkButton> }
            : {})}
        />
      ) : (
        <BookingsTable bookings={page.items} houses={houses} />
      )}
      <Pager
        path="/bookings"
        query={{ as: query.as }}
        nextPageToken={page.nextPageToken}
        onFirstPage={!query.pageToken}
      />
    </>
  );
}
