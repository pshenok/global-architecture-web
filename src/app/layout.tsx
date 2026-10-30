import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { template: '%s · Global Architecture', default: 'Global Architecture' },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Every route renders per request: the CSP nonce applies everywhere and the build
  // never calls the API.
  await connection();
  return (
    <html lang="en-US">
      <body>{children}</body>
    </html>
  );
}
