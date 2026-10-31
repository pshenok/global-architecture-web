import type { Route } from 'next';
import Link from 'next/link';
import { formatInstant } from '@/kernel/dates';
import { DEFAULT_LOCALE } from '@/kernel/locale';
import type { SampleItem } from '../model/sample-item';

export function SampleItemList({ sampleItems }: { sampleItems: readonly SampleItem[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {sampleItems.map((sampleItem) => (
        <li key={sampleItem.id} className="flex items-center justify-between px-4 py-3">
          <Link
            className="font-medium underline-offset-4 hover:underline"
            href={`/sample-items/${sampleItem.id}` as Route}
          >
            {sampleItem.name}
          </Link>
          <span className="text-sm text-muted-foreground">
            {formatInstant(sampleItem.createdAt, DEFAULT_LOCALE)}
          </span>
        </li>
      ))}
    </ul>
  );
}
