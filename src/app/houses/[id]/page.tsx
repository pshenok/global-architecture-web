import { BookingPanelView } from '@/features/bookings/server';
import { HouseDetailView, houseDetailMetadata } from '@/features/houses/server';

export const generateMetadata = (props: PageProps<'/houses/[id]'>) =>
  houseDetailMetadata(props.params);

export default function Page(props: PageProps<'/houses/[id]'>) {
  return (
    <>
      <HouseDetailView params={props.params} />
      <BookingPanelView params={props.params} />
    </>
  );
}
