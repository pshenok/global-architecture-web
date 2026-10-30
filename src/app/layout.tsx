import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { DEFAULT_LOCALE } from '@/kernel/locale';
import { Shell } from './_shell/shell';
import './globals.css';

// Self-hosted at build time: no request to Google at run time, so font-src 'self' holds.
const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { template: '%s · Global Architecture', default: 'Global Architecture' },
  description: 'Houses to stay in, booked through the global-architecture-monolith API.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Every route renders per request: the CSP nonce applies everywhere and the build
  // never calls the API.
  await connection();
  return (
    <html lang={DEFAULT_LOCALE} className={geist.variable}>
      <body className="min-h-dvh antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
