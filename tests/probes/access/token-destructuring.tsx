// as: src/features/houses/views/probe-token.tsx
import 'server-only';
import { getSession } from '@/platform/session';

export async function Probe() {
  const { at } = await getSession(); // refused
  const { rt: refresh } = await getSession(); // refused
  const session = await getSession();
  const idToken = session['idt']; // refused
  const { createdAt, sub } = session;
  return [at, refresh, idToken, createdAt, sub];
}
