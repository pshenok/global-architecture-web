// as: src/features/houses/data/probe.gateway.ts
import 'server-only';
import { revalidatePath } from 'next/cache'; // refused
import { notFound } from 'next/navigation'; // refused

export const probe = () => {
  revalidatePath('/houses'); // refused
  return notFound;
};
