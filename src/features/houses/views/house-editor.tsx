import 'server-only';
import { TrashIcon } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireUser } from '@/platform/session';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { PageHeader } from '@/ui/page-header';
import { createHouse, deleteHouse, updateHouse } from '../actions';
import { canEdit } from '../model/house';
import { toFormValues } from '../model/house-form';
import { HouseForm } from '../ui/house-form';
import { loadHouse } from './house-detail';

export async function NewHouseView() {
  await requireUser();
  return (
    <>
      <PageHeader title="List a house" description="Guests can book it as soon as it is listed." />
      <HouseForm
        action={createHouse}
        initial={{ currencyCode: 'USD', maxGuests: '2' }}
        submitLabel="List house"
      />
    </>
  );
}

export async function EditHouseView({ params }: { params: Promise<{ id: string }> }) {
  const [{ me }, house] = await Promise.all([
    requireUser(),
    params.then(({ id }) => loadHouse(id)),
  ]);
  // The API refuses anyone else too; this keeps the page from showing a form they cannot use.
  if (!canEdit(house, me.id)) notFound();
  return (
    <>
      <PageHeader
        title={`Edit ${house.title}`}
        actions={
          <ConfirmDialog
            action={deleteHouse}
            fields={{ id: house.id }}
            trigger={
              <>
                <TrashIcon aria-hidden="true" data-icon="inline-start" />
                Delete house
              </>
            }
            title="Delete this house?"
            description="Its upcoming bookings are cancelled. This cannot be undone."
            confirmLabel="Delete house"
          />
        }
      />
      <HouseForm
        action={updateHouse}
        houseId={house.id}
        initial={toFormValues(house)}
        submitLabel="Save changes"
      />
    </>
  );
}
