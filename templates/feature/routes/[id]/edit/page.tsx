import type { Metadata } from 'next';
import { EditSampleItemView } from '@/features/sample-items/server';

export const metadata: Metadata = { title: 'Edit sample item' };

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <EditSampleItemView params={props.params} />;
}
