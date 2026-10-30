'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavEntry } from '@/ui/app-shell';

/** The main navigation; marks the current section (layouts do not re-render on navigation). */
export function Navigation({ entries }: { entries: readonly NavEntry[] }) {
  const pathname = usePathname();
  const current = entries
    .filter((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Main">
      <ul className="flex items-center gap-1 text-sm">
        {entries.map((entry) => (
          <li key={entry.href}>
            <Link
              href={entry.href as never}
              aria-current={current === entry.href ? 'page' : undefined}
              className="rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              {entry.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
