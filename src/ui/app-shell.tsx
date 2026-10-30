import { Building2Icon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The page frame: a skip link, the header (brand, navigation, the user slot) and the one
 * <main>. Navigation and the user slot are passed in by the app's shell, which knows the
 * features and the session; this component knows neither.
 */
export function AppShell({
  navigation,
  user,
  children,
}: {
  navigation: ReactNode;
  user: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-3 focus:ring-ring/50"
      >
        Skip to content
      </a>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link href="/houses" className="flex items-center gap-2 font-heading font-semibold">
            <Building2Icon aria-hidden="true" className="size-5" />
            Global Architecture
          </Link>
          {navigation}
          <div className="ms-auto flex items-center gap-2">{user}</div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 py-8 outline-none">
        {children}
      </main>
    </>
  );
}

export interface NavEntry {
  readonly href: string;
  readonly label: string;
  /** Who sees the entry: everyone, signed-in users, or admins. */
  readonly audience: 'everyone' | 'user' | 'admin';
}
