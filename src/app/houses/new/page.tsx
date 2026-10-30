import type { Metadata } from 'next';
import { NewHouseView } from '@/features/houses/server';

export const metadata: Metadata = { title: 'List a house' };

export default function Page() {
  return <NewHouseView />;
}
