# ADR-0004: Data access, mutations and the API contract

- Status: Accepted
- Date: 2026-10-30
- Related: ADR-0003 of `global-architecture-monolith` (API and error conventions)

## Context

The monolith exposes 14 HTTPS REST operations under `/v1/users`, `/v1/houses` and `/v1/bookings`, described by a runtime-only OpenAPI 3.0 document.
- Errors are `application/problem+json` with a stable UPPER_SNAKE `code` (a free string in the spec, not an enum), `errors[]` holding dotted field paths, and a `requestId`.
- List endpoints page by keyset (`nextPageToken`), and page tokens are bound to the filters and the caller.
- `GET /v1/houses` and `GET /v1/houses/{id}` are public. The API still verifies any token it receives, so an expired token sent there yields a 401.
- Writes may already have committed when the API answers 504 `REQUEST_TIMEOUT` after 30 s.

On the tooling side:
- TypeScript 7 has no compiler API. openapi-typescript 7.13.0 and @hey-api 0.99.0 crash on it.
- pnpm overrides do not redirect a peer dependency, but a separate workspace package does (verified on pnpm 12.16.1).

## Decision

1. **Types-only codegen.** openapi-typescript 7.13.0 runs in `tools/api-codegen` against `@typescript/typescript6@6.0.2`.
   - The runtime client is openapi-fetch 0.17.0, created once at module level.
   - Credentials are passed per call. There is never an auth middleware that would be shared across requests.
2. **Contract snapshot.**
   - `contracts/monolith/openapi.json` and `source.json` (`{repo, commit, syncedAt}`) are committed. The commit works like a lockfile: CI checks out exactly that monolith commit.
   - `pnpm api:sync` regenerates from the running sibling stack.
   - `pnpm api:check` runs offline: generator `--check`, plus a re-derived operations table.
   - The e2e global setup and CI assert that the live spec equals the snapshot.
   - A nightly job classifies drift against monolith `main` as compatible or breaking.
   - Rejected: a git submodule and a published contract package.
3. **Outbound chokepoint.** `src/platform/net/outbound.ts` is the only user of global `fetch`.
   - Each outbound target has an origin allowlist (API, and IdP).
   - `redirect: 'error'` and `cache: 'no-store'` are forced, and default timeouts apply.
   - `globalThis.fetch` is resolved at call time, because openapi-fetch captures it at `createClient` and MSW must still be able to intercept.
   - Dev TLS uses `NODE_EXTRA_CA_CERTS`, set by the launchers before Node starts.
4. **Token guard.** A middleware looks up a generated operations table (`'GET /v1/houses': 'none'`, `'POST /v1/houses': 'bearer'`, ...).
   - It refuses an unknown operation, a token sent to a public operation, and a protected operation called without a token.
   - Gateways pass `withCaller(caller, kind)` or `anonymous()`. Deadlines are 10 s for reads and 35 s for writes, so the API's own 504 arrives first.
   - Reads also stop when their render is abandoned (`cacheSignal()`); such a cancellation is rethrown, not reported as an outage. Writes never stop with the render: a browser leaving mid-action would otherwise abort a write halfway and make its outcome unknown (found by the cancel-booking e2e).
5. **Problems.**
   - `settle()` returns `ApiResult<T>`, after a runtime `isProblemDetails` guard. Upstream failures become BFF codes (`UPSTREAM_TIMEOUT`, `UPSTREAM_UNAVAILABLE`, ...).
   - Code branches only on `code`. A hand-kept catalogue in `src/kernel/problem-codes.ts` is reviewed whenever a monolith `DomainError` reason changes.
   - For reads, `orInterrupt` maps:
     - any 404, and any 403 except `USER_NOT_REGISTERED`, to `notFound()`;
     - 401 to sign-in;
     - `USER_NOT_REGISTERED` to `/register`;
     - `INVALID_PAGE_TOKEN` to the first page;
     - everything else to `error.tsx`, logged with the requestId.
   - Detail lookups run before anything streams, and there is no `loading.tsx` above a dynamic detail page, so the status code is real.
6. **Mutations.** Only `defineAction` in `features/*/actions.ts`.
   - Each action declares an inline access literal (`identity`, `user` or `admin`), a zod input, an API-field-to-form-field map and a message table.
   - The wrapper resolves the session, parses FormData, maps problems into a typed `FormState` (echoing values for `defaultValue`), and performs the handler's returned outcome (`refresh`, `redirect`, `logout`, `done`) outside every try block.
   - Message maps take known codes and a feature's own module codes (`SAMPLE_ITEM_NAME_TAKEN`).
   - Redirect outcomes take same-site paths only; logout goes to the provider's end-session URL.
   - An outcome with `shell: 'stale'` (registration, a rename) calls `revalidatePath('/', 'layout')` so the shell re-renders: layouts keep their render across navigations, and the shell shows the user. It is the only `revalidatePath` (`check-access` S5).
   - Writes are never retried automatically.
   - `BOOKING_ALREADY_CANCELLED` and `USER_ALREADY_REGISTERED` count as success.
   - `useOptimistic` is used only for cancel.
7. **No cross-request cache in v1.** No `'use cache'`, `unstable_cache`, fetch cache options or segment config exports.
   - Freshness after a mutation comes from `refresh()` or `redirect()`.
   - No TanStack Query and no nuqs: tokens never leave the server.
   - Pagination is forward-only, with "Next" and "First page".
8. **No runtime validation of responses.** The monolith types its responses from the same Zod schemas that emit the spec. Drift is caught by the snapshot, typecheck and e2e.

## Consequences

- Call sites read like the contract (`api().GET('/v1/houses/{id}', ...)`). No generated code runs, so a spec cannot inject code.
- The repo carries a TypeScript 6 copy, used only by codegen. orval 8.46.0 is the documented fallback if the isolation breaks.
- Reason codes are outside the spec, so drift there is caught by review and the nightly e2e until the monolith adds `x-problem-codes`.
- Every user behind the BFF shares the monolith's per-IP rate limit. The monolith must key the limit on the token subject, or trust the BFF, before production load.
- Template contract fixtures are hand-kept until the monolith commits its OpenAPI documents (optional follow-up M2).
