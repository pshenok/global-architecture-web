import 'server-only';

/**
 * The CSRF control (ADR-0006): an unsafe request is accepted only when its Origin equals
 * the app's origin exactly. A missing Origin, or the literal "null", is refused: every
 * browser that matters sends Origin on POST, and nothing else should post here.
 */
export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function sameOrigin(origin: string | null, appOrigin: string): boolean {
  return origin !== null && origin === appOrigin;
}

export function csrfProblem(): Response {
  return Response.json(
    { type: 'about:blank', title: 'Forbidden', status: 403, code: 'CSRF_ORIGIN_MISMATCH' },
    {
      status: 403,
      headers: { 'content-type': 'application/problem+json', 'cache-control': 'no-store' },
    },
  );
}

/** For route handlers of unsafe methods: the proxy checked already; check again here. */
export function assertSameOrigin(request: Request, appOrigin: string): Response | undefined {
  if (SAFE_METHODS.has(request.method)) return undefined;
  return sameOrigin(request.headers.get('origin'), appOrigin) ? undefined : csrfProblem();
}
