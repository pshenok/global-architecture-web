import 'server-only';
import { HomeIcon, PlusIcon } from 'lucide-react';
import { orInterrupt } from '@/platform/errors';
import { getOptionalUser } from '@/platform/session';
import { EmptyState } from '@/ui/empty-state';
import { LinkButton } from '@/ui/link-button';
import { PageHeader } from '@/ui/page-header';
import { Pager } from '@/ui/pager';
import { listHouses } from '../data/houses.gateway';
import { CatalogueQuery } from '../model/search';
import { CityFilter } from '../ui/city-filter';
import { HouseGrid } from '../ui/house-card';

export async function HouseCatalogueView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = CatalogueQuery.parse(await searchParams);
  const [page, user] = await Promise.all([
    orInterrupt(listHouses(query), {
      firstPage: query.city ? `/houses?city=${encodeURIComponent(query.city)}` : '/houses',
    }),
    getOptionalUser(),
  ]);
  return (
    <>
      <PageHeader
        title="Houses"
        description={
          query.city ? `Places to stay in ${query.city}` : 'Places to stay, newest first'
        }
        actions={
          user ? (
            <LinkButton href="/houses/new">
              <PlusIcon aria-hidden="true" data-icon="inline-start" />
              List a house
            </LinkButton>
          ) : null
        }
      />
      <div className="mb-6">
        <CityFilter city={query.city} />
      </div>
      {page.items.length === 0 ? (
        <EmptyState
          icon={<HomeIcon aria-hidden="true" />}
          title={query.city ? `No houses in ${query.city} yet` : 'No houses yet'}
          description={
            query.city ? 'Try another city, or clear the filter.' : 'Be the first to list one.'
          }
        />
      ) : (
        <HouseGrid houses={page.items} />
      )}
      <Pager
        path="/houses"
        query={{ city: query.city }}
        nextPageToken={page.nextPageToken}
        onFirstPage={!query.pageToken}
      />
    </>
  );
}
