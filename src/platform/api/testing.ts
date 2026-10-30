import { HttpResponse } from 'msw/http';

/** A problem+json response as the monolith sends it (tests only). */
export function problemResponse(
  status: number,
  code: string,
  extra: {
    detail?: string;
    metadata?: Record<string, string>;
    errors?: { field: string; description: string }[];
  } = {},
) {
  return HttpResponse.json(
    {
      type: 'about:blank',
      title: 'Error',
      status,
      code,
      instance: '/v1',
      requestId: 'req-api',
      ...extra,
    },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}
