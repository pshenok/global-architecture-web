// as: src/features/houses/views/probe.tsx
import 'server-only';
import { unstable_cache } from 'next/cache'; // refused
import { forbidden, notFound } from 'next/navigation'; // refused
import type { Session } from '@/platform/session/schema';

export async function Probe({ session }: { session: Session }) {
  const cached = unstable_cache(async () => 1); // refused
  async function act() {
    'use server'; // refused
  }
  const token = session.at; // refused
  const items = [1, 2].at(-1);
  await fetch('https://x.test', { next: { revalidate: 60 } }); // refused
  // @ts-expect-error probe // refused
  const nope: number = 'x';
  return [forbidden, notFound, cached, act, token, items, nope, process.env.NEXT_PUBLIC_KEY]; // refused
}
