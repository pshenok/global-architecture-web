import 'server-only';

/** Liveness only: no upstream probes and no information (the API has its own readyz). */
export function healthz(): Response {
  return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
}
