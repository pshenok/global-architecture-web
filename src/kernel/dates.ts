/**
 * Calendar dates ("YYYY-MM-DD", no time, no zone) as the API uses them for stays, and
 * instants (ISO 8601) for createdAt-style fields. All formatting is in UTC so a date
 * never shifts with the server's zone.
 */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(ms).toISOString().slice(0, 10) === value;
}

/** Today in UTC, the monolith's rule for the earliest check-in. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Nights between two calendar dates (checkOut exclusive). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const toMs = (date: string) => {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toMs(checkOut) - toMs(checkIn)) / 86_400_000);
}

const calendar = (locale: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });

const toUtcDate = (date: string) => new Date(`${date}T00:00:00Z`);

export function formatDate(date: string, locale: string): string {
  return calendar(locale).format(toUtcDate(date));
}

/** "Nov 3 – 6, 2026": a stay from check-in to check-out. */
export function formatStay(checkIn: string, checkOut: string, locale: string): string {
  return calendar(locale).formatRange(toUtcDate(checkIn), toUtcDate(checkOut));
}

export function formatInstant(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}
