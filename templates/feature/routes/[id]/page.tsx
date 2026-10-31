import { SampleItemDetailView, sampleItemMetadata } from '@/features/sample-items/server';

export const generateMetadata = (props: { params: Promise<{ id: string }> }) =>
  sampleItemMetadata(props.params);

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <SampleItemDetailView params={props.params} />;
}
