import { SearchXIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/ui/empty-state';
import { LinkButton } from '@/ui/link-button';

export const metadata: Metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <>
      <h1 className="sr-only">Not found</h1>
      <EmptyState
        icon={<SearchXIcon aria-hidden="true" />}
        title="This page does not exist"
        description="It may have been removed, or you may not have access to it."
        action={<LinkButton href="/houses">Browse houses</LinkButton>}
      />
    </>
  );
}
