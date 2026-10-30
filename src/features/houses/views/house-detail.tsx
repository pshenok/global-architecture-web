import 'server-only';
import { MapPinIcon, PencilIcon, UsersIcon } from 'lucide-react';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { formatDate } from '@/kernel/dates';
import { DEFAULT_LOCALE } from '@/kernel/locale';
import { orInterrupt } from '@/platform/errors';
import { getOptionalUser } from '@/platform/session';
import { LinkButton } from '@/ui/link-button';
import { MoneyText } from '@/ui/money-text';
import { PageHeader } from '@/ui/page-header';
import { getHouse } from '../data/houses.gateway';
import { canEdit, type House } from '../model/house';
import { HouseId } from '../model/search';

/** One read of a house per request, shared by the page, its metadata and other features. */
export const loadHouse = cache(async (id: string): Promise<House> => {
  if (!HouseId.safeParse(id).success) notFound();
  return orInterrupt(getHouse(id));
});

export async function houseDetailMetadata(params: Promise<{ id: string }>) {
  const house = await loadHouse((await params).id);
  return { title: house.title };
}

export async function HouseDetailView({ params }: { params: Promise<{ id: string }> }) {
  // The lookup runs before anything streams, so an unknown house is a real 404.
  const [house, user] = await Promise.all([loadHouse((await params).id), getOptionalUser()]);
  return (
    <>
      <PageHeader
        title={house.title}
        description={
          <span className="flex items-center gap-1">
            <MapPinIcon aria-hidden="true" className="size-3.5" />
            {house.address.line1}, {house.address.city}, {house.address.countryCode}
          </span>
        }
        actions={
          canEdit(house, user?.me.id) ? (
            <LinkButton variant="outline" href={`/houses/${house.id}/edit` as Route}>
              <PencilIcon aria-hidden="true" data-icon="inline-start" />
              Edit
            </LinkButton>
          ) : null
        }
      />
      <dl className="mb-8 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Price per night</dt>
          <dd className="text-lg font-medium">
            <MoneyText value={house.nightlyPrice} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sleeps</dt>
          <dd className="flex items-center gap-1 text-lg font-medium">
            <UsersIcon aria-hidden="true" className="size-4" />
            {house.maxGuests}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Listed</dt>
          <dd className="text-lg font-medium">
            {formatDate(house.createdAt.slice(0, 10), DEFAULT_LOCALE)}
          </dd>
        </div>
      </dl>
      {house.description ? (
        <p className="mb-8 max-w-prose whitespace-pre-line">{house.description}</p>
      ) : null}
    </>
  );
}
