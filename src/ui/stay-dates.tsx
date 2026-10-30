import { formatStay, nightsBetween } from '@/kernel/dates';
import { DEFAULT_LOCALE } from '@/kernel/locale';

export function StayDates({
  checkIn,
  checkOut,
  locale = DEFAULT_LOCALE,
}: {
  checkIn: string;
  checkOut: string;
  locale?: string;
}) {
  const nights = nightsBetween(checkIn, checkOut);
  return (
    <span>
      <time dateTime={checkIn}>{formatStay(checkIn, checkOut, locale)}</time>
      <span className="text-muted-foreground">
        {' '}
        · {nights} {nights === 1 ? 'night' : 'nights'}
      </span>
    </span>
  );
}
