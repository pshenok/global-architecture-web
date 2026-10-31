import 'server-only';
import { ListIcon, PencilIcon, PlusIcon, TrashIcon } from 'lucide-react';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { orInterrupt } from '@/platform/errors';
import { requireUser } from '@/platform/session';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { EmptyState } from '@/ui/empty-state';
import { LinkButton } from '@/ui/link-button';
import { PageHeader } from '@/ui/page-header';
import { Pager } from '@/ui/pager';
import { createSampleItem, deleteSampleItem, updateSampleItem } from '../actions';
import { getSampleItem, listSampleItems } from '../data/sample-items.gateway';
import { PageQuery, SampleItemId } from '../model/forms';
import type { SampleItem } from '../model/sample-item';
import { SampleItemForm } from '../ui/sample-item-form';
import { SampleItemList } from '../ui/sample-item-list';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Params = Promise<{ id: string }>;

/** One read per request, shared by the page and its metadata; a stranger's item is a 404. */
const loadSampleItem = cache(async (id: string): Promise<SampleItem> => {
  if (!SampleItemId.safeParse(id).success) notFound();
  const { caller } = await requireUser();
  return orInterrupt(getSampleItem(caller, id));
});

export async function sampleItemMetadata(params: Params) {
  return { title: (await loadSampleItem((await params).id)).name };
}

export async function SampleItemsView({ searchParams }: { searchParams: SearchParams }) {
  const { caller } = await requireUser();
  const { pageToken } = PageQuery.parse(await searchParams);
  const page = await orInterrupt(listSampleItems(caller, pageToken), {
    firstPage: '/sample-items',
  });
  const create = (
    <LinkButton href="/sample-items/new">
      <PlusIcon aria-hidden="true" data-icon="inline-start" />
      New sample item
    </LinkButton>
  );
  return (
    <>
      <PageHeader
        title="Sample items"
        description="Yours, newest first"
        actions={page.items.length > 0 ? create : null}
      />
      {page.items.length === 0 ? (
        <EmptyState
          icon={<ListIcon aria-hidden="true" />}
          title="No sample items yet"
          action={create}
        />
      ) : (
        <SampleItemList sampleItems={page.items} />
      )}
      <Pager
        path="/sample-items"
        query={{}}
        nextPageToken={page.nextPageToken}
        onFirstPage={!pageToken}
      />
    </>
  );
}

export async function SampleItemDetailView({ params }: { params: Params }) {
  // The lookup runs before anything streams, so a stranger's item is a real 404.
  const sampleItem = await loadSampleItem((await params).id);
  return (
    <>
      <PageHeader
        title={sampleItem.name}
        actions={
          <LinkButton variant="outline" href={`/sample-items/${sampleItem.id}/edit` as Route}>
            <PencilIcon aria-hidden="true" data-icon="inline-start" />
            Edit
          </LinkButton>
        }
      />
      {sampleItem.description ? (
        <p className="max-w-prose whitespace-pre-line">{sampleItem.description}</p>
      ) : null}
    </>
  );
}

export async function NewSampleItemView() {
  await requireUser();
  return (
    <>
      <PageHeader title="New sample item" />
      <SampleItemForm action={createSampleItem} initial={{}} submitLabel="Create" />
    </>
  );
}

export async function EditSampleItemView({ params }: { params: Params }) {
  const sampleItem = await loadSampleItem((await params).id);
  return (
    <>
      <PageHeader
        title={`Edit ${sampleItem.name}`}
        actions={
          <ConfirmDialog
            action={deleteSampleItem}
            fields={{ id: sampleItem.id }}
            trigger={
              <>
                <TrashIcon aria-hidden="true" data-icon="inline-start" />
                Delete
              </>
            }
            title="Delete this sample item?"
            description="This cannot be undone."
            confirmLabel="Delete"
          />
        }
      />
      <SampleItemForm
        action={updateSampleItem}
        sampleItemId={sampleItem.id}
        initial={{ name: sampleItem.name, description: sampleItem.description }}
        submitLabel="Save changes"
      />
    </>
  );
}
