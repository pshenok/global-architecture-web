// as: src/features/houses/views/probe-prologue.tsx
import 'server-only';

export async function Probe() {
  async function remove() {
    'use no memo';
    'use server'; // refused
  }
  const cached = async () => {
    'use strict';
    'use cache'; // refused
  };
  return [remove, cached];
}
