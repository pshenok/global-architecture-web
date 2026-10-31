// as: src/features/bookings/data/probe-bypass.gateway.ts
import 'server-only';
import { api } from '@/platform/api';
import { api as indexed } from '@/platform/api/index'; // refused
import { getSession } from '@/platform//session'; // refused
import { trailing } from '@/platform/api/'; // refused
export { api as client } from '@/platform/api'; // refused
export * from '@/platform/api'; // refused

export async function probe() {
  await api().GET('/v1/bookings/{id}');
  await api()?.GET('/v1/users/{id}'); // refused
  await api(/* x */).GET('/v1/users/{id}'); // refused
  await api().GET?.('/v1/bookings'); // refused
  await api().GET('/v1/users/{id}'); // refused
  await (await import('@/platform/api')).api().GET('/v1/users'); // refused
  return [indexed, getSession, trailing, { api }]; // refused
}
