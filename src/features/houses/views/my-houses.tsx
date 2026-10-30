import 'server-only';
import { HomeIcon, PlusIcon } from 'lucide-react';
import { orInterrupt } from '@/platform/errors';
import { requireUser } from '@/platform/session';
import { EmptyState } from '@/ui/empty-state';
import { LinkButton } from '@/ui/link-button';
import { PageHeader } from '@/ui/page-header';
import { Pager } from '@/ui/pager';
import { listHouses } from '../data/houses.gateway';
import { CatalogueQuery } from '../model/search';
import { HouseGrid } from '../ui/house-card';

export async function MyHousesView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { me } = await requireUser();
  const { pageToken } = CatalogueQuery.parse(await searchParams);
  const page = await orInterrupt(listHouses({ ownerId: me.id, pageToken }), {
    firstPage: '/houses/mine',
  });
  const listButton = (
    <LinkButton href="/houses/new">
      <PlusIcon aria-hidden="true" data-icon="inline-start" />
      List a house
    </LinkButton>
  );
  return (
    <>
      <PageHeader
        title="My houses"
        description="The houses you host"
        actions={page.items.length > 0 ? listButton : null}
      />
      {page.items.length === 0 ? (
        <EmptyState
          icon={<HomeIcon aria-hidden="true" />}
          title="You host no houses yet"
          description="List one and guests can book it."
          action={listButton}
        />
      ) : (
        <HouseGrid houses={page.items} />
      )}
      <Pager
        path="/houses/mine"
        query={{}}
        nextPageToken={page.nextPageToken}
        onFirstPage={!pageToken}
      />
    </>
  );
}
