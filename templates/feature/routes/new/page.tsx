import type { Metadata } from 'next';
import { NewSampleItemView } from '@/features/sample-items/server';

export const metadata: Metadata = { title: 'New sample item' };

export default function Page() {
  return <NewSampleItemView />;
}
