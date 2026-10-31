import type { Metadata } from 'next';
import { SampleItemsView } from '@/features/sample-items/server';

export const metadata: Metadata = { title: 'Sample items' };

export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SampleItemsView searchParams={props.searchParams} />;
}
