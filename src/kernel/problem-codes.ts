/**
 * The `code` values a problem can carry: the monolith's DomainError reasons and generic
 * HTTP codes (its ADR-0003), plus the ones this BFF produces itself. Reason codes are not
 * in the OpenAPI document, so review this list whenever the monolith adds or renames one.
 * Branch on `code`, never on `detail` or `title`.
 */
const API_PROBLEM_CODES = [
  // generic
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'BAD_REQUEST',
  'TOO_MANY_REQUESTS',
  'INVALID_PAGE_TOKEN',
  'TRANSACTION_CONFLICT',
  'DATABASE_TIMEOUT',
  'REQUEST_TIMEOUT',
  'INTERNAL',
  // identity (monolith ADR-0004)
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_INVALID',
  'AUTH_TOKEN_EXPIRED',
  'IDENTITY_PROVIDER_UNAVAILABLE',
  'USER_NOT_REGISTERED',
  'ADMIN_ROLE_REQUIRED',
  'EMAIL_NOT_VERIFIED',
  // users
  'USER_NOT_FOUND',
  'USER_EMAIL_TAKEN',
  'USER_ALREADY_REGISTERED',
  // houses
  'HOUSE_NOT_FOUND',
  'HOUSE_OWNER_NOT_FOUND',
  'HOUSE_PERMISSION_DENIED',
  // bookings
  'BOOKING_NOT_FOUND',
  'BOOKING_GUEST_NOT_FOUND',
  'BOOKING_HOUSE_NOT_FOUND',
  'BOOKING_TOO_MANY_GUESTS',
  'BOOKING_DATES_UNAVAILABLE',
  'BOOKING_ALREADY_CANCELLED',
] as const;

/** Codes the BFF itself produces (never sent by the API). */
export const BFF_PROBLEM_CODES = [
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_BAD_RESPONSE',
  'SESSION_EXPIRED',
  'IDP_UNAVAILABLE',
  'CSRF_ORIGIN_MISMATCH',
] as const;

export type KnownProblemCode =
  | (typeof API_PROBLEM_CODES)[number]
  | (typeof BFF_PROBLEM_CODES)[number];

/** A known code, or any other UPPER_SNAKE code a newer API may send. */
export type ProblemCode = KnownProblemCode | (string & {});

export interface FieldProblem {
  /** Dotted path in the API body, e.g. `address.city`. */
  readonly field: string;
  readonly description: string;
}

/** An RFC 9457 problem from the API, or one the BFF made for an upstream failure. */
export interface ApiProblem {
  readonly status: number;
  readonly code: ProblemCode;
  readonly title: string;
  /** Client-facing for 4xx (monolith ADR-0003); never shown for 5xx. */
  readonly detail?: string;
  readonly fieldErrors: readonly FieldProblem[];
  readonly metadata: Readonly<Record<string, string>>;
  readonly requestId?: string;
  readonly origin: 'api' | 'bff';
}

export function bffProblem(
  status: number,
  code: (typeof BFF_PROBLEM_CODES)[number],
  title: string,
): ApiProblem {
  return { status, code, title, fieldErrors: [], metadata: {}, origin: 'bff' };
}
