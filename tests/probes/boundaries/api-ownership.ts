// as: src/features/bookings/data/probe-ownership.gateway.ts
import 'server-only';
import { api } from '@/platform/api';
import { gateway } from '@/kernel/../features/users/data/users.gateway'; // refused
import { read } from '@/kernel/../platform/session/read'; // refused
import { helper } from '@/kernel/../../tests/support/session'; // refused

export async function probe() {
  await api().GET('/v1/bookings');
  const client = api(); // refused
  await client.GET('/v1/users');
  await api().HEAD('/v1/users'); // refused
  await api().request('get', '/v1/users'); // refused
  const stored = api; // refused
  return [gateway, read, helper, stored, { api: 1 }.api];
}
