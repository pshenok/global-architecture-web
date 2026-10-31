---

name: gaw-data-access
description: Calling global-architecture-monolith's API from global-architecture-web - gateways in a feature's data/, the generated openapi-fetch client, withCaller/anonymous, the token guard, settle and ApiResult, orInterrupt, problem codes, paging, deadlines, no caching, and keeping the contract in step (api:sync, api:check, source.json). Use it whenever you add or change an API call, map a DTO, handle an API error, paginate, see UNKNOWN_OPERATION / TOKEN_ON_PUBLIC_OPERATION / MISSING_TOKEN, or the monolith's API changed.
---

# Data access

## A gateway

```ts
// src/features/houses/data/houses.gateway.ts
import 'server-only';
import {
  type ApiResult,
  anonymous,
  api,
  type components,
  settle,
  withCaller,
} from '@/platform/api';
import type { Caller } from '@/platform/session';

export async function getHouse(id: string): Promise<ApiResult<House>> {
  return settle(
    api().GET('/v1/houses/{id}', { params: { path: { id } }, ...(await anonymous()) }),
    toHouse,
  );
}
export async function createHouse(
  caller: Caller,
  body: CreateHouseBody,
): Promise<ApiResult<House>> {
  return settle(
    api().POST('/v1/houses', { body, ...(await withCaller(caller, 'write')) }),
    toHouse,
  );
}
```

- Only `data/` calls `api()`; only on the feature's `apiPaths`, with literal paths (R8).
- `withCaller(caller, 'read' | 'write')` adds the bearer token and `x-request-id`;
  `anonymous()` only the request id. The **guard** (from the OpenAPI document's
  `security`) throws `ApiMisuseError`: `UNKNOWN_OPERATION` (not in the snapshot),
  `TOKEN_ON_PUBLIC_OPERATION` (an expired cookie would turn the public catalogue into a
  401), `MISSING_TOKEN`.
- Map DTOs to the feature's model in the gateway (`toHouse`); views never see API types.
- Deadlines: reads 10 s and stop when their render is abandoned; writes 35 s and run to
  their end (the API's own 504 comes first at 30 s). Writes are never retried.

## ApiResult and problems

`settle` returns `{ ok: true, value }` or `{ ok: false, problem }`. `ApiProblem` has
`status`, `code` (branch on this only), `detail` (4xx only), `fieldErrors` (dotted API
fields), `metadata`, `requestId`, `origin: 'api' | 'bff'`. Network failures are
`UPSTREAM_UNAVAILABLE` (503), timeouts `UPSTREAM_TIMEOUT` (504).

In views, `orInterrupt(result, { firstPage? })` returns the value or interrupts:
404 and any 403 except `USER_NOT_REGISTERED` -> `notFound()` (the monolith answers 404
for what the caller may not know); 401 -> sign-in; `USER_NOT_REGISTERED` ->
`/register`; `INVALID_PAGE_TOKEN` -> `firstPage`; anything else -> `UpstreamError`
(error.tsx shows a reference). In actions, `defineAction` maps problems (gaw-forms-and-actions).

Reason codes are not in the OpenAPI document: `src/kernel/problem-codes.ts` lists the
monolith's. Review it whenever the monolith adds or renames a `DomainError` reason.

## Reads in views

- Parse params with zod first (`z.uuid()`); an invalid id is `notFound()` without a call.
- Run a page's main lookup before anything streams (no `loading.tsx` above dynamic pages:
  check-access S6) so a 404 is a real 404.
- Independent reads in parallel (`Promise.all`); shared reads through React `cache()`.
- Nothing is cached across requests: no `'use cache'`, `unstable_cache`, fetch `next`
  options (check-access S5). Freshness after a write comes from the action's outcome.

## Paging

Keyset: `Page<T> = { items, nextPageToken }`, page size `PAGE_SIZE`. The `<Pager>` shows
"Next" with `pageToken` and "First page"; filters are GET forms (`next/form`) without the
token. A stale token is `INVALID_PAGE_TOKEN` -> `orInterrupt` redirects to `firstPage`.

## The contract

- `contracts/monolith/openapi.json` + `source.json` (`commit`, `dirty`) are committed; CI
  checks out that monolith commit and the e2e preflight asserts the live document equals
  the snapshot.
- `pnpm api:sync` (the monolith's stack up, its tree clean) snapshots, regenerates
  `src/platform/api/generated/{schema.d.ts,operations.ts}` and the template's contract.
  Never edit generated files.
- `pnpm api:check` (in `pnpm check`) fails on stale generated files or a dirty source.
- openapi-typescript runs in `tools/api-codegen` with TypeScript 6 (it does not support 7).
