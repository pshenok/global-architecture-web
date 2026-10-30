import 'server-only';
import type { ApiProblem, FieldProblem } from '@/kernel/problem-codes';

/** A JSON body that looks like the monolith's problem details (checked at run time). */
export function isProblemDetails(body: unknown): body is {
  status: number;
  code: string;
  title?: string;
  detail?: string;
  metadata?: Record<string, string>;
  errors?: FieldProblem[];
  requestId?: string;
} {
  if (typeof body !== 'object' || body === null) return false;
  const value = body as Record<string, unknown>;
  return typeof value.status === 'number' && typeof value.code === 'string';
}

const stringRecord = (value: unknown): Record<string, string> =>
  typeof value === 'object' && value !== null
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};

const fieldErrors = (value: unknown): FieldProblem[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is FieldProblem =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as FieldProblem).field === 'string' &&
          typeof (item as FieldProblem).description === 'string',
      )
    : [];

const STATUS_FAMILY_CODES: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'AUTH_TOKEN_INVALID',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
};

/** Normalizes an error response: a problem body as sent, anything else by its status. */
export function toApiProblem(response: Response, body: unknown): ApiProblem {
  const requestId = response.headers.get('x-request-id') ?? undefined;
  if (isProblemDetails(body)) {
    return {
      status: response.status,
      code: body.code,
      title: body.title ?? response.statusText,
      ...(body.detail && response.status < 500 ? { detail: body.detail } : {}),
      fieldErrors: fieldErrors(body.errors),
      metadata: stringRecord(body.metadata),
      ...(body.requestId ? { requestId: body.requestId } : requestId ? { requestId } : {}),
      origin: 'api',
    };
  }
  return {
    status: response.status,
    code:
      STATUS_FAMILY_CODES[response.status] ??
      (response.status >= 500 ? 'UPSTREAM_BAD_RESPONSE' : 'BAD_REQUEST'),
    title: response.statusText || 'Error',
    fieldErrors: [],
    metadata: {},
    ...(requestId ? { requestId } : {}),
    origin: 'api',
  };
}
