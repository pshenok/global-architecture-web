import type { Metadata } from 'next';
import { EditHouseView } from '@/features/houses/server';

export const metadata: Metadata = { title: 'Edit house' };

export default function Page(props: PageProps<'/houses/[id]/edit'>) {
  return <EditHouseView params={props.params} />;
}
