import type { Metadata } from 'next';
import { HouseCatalogueView } from '@/features/houses/server';

export const metadata: Metadata = { title: 'Houses' };

export default function Page(props: PageProps<'/houses'>) {
  return <HouseCatalogueView searchParams={props.searchParams} />;
}
