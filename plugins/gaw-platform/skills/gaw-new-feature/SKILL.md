---

name: gaw-new-feature
description: Create a feature in global-architecture-web from templates/feature with `pnpm new:feature <noun>`, paired with `pnpm new:module <noun>` in global-architecture-monolith, then reshape it from the SampleItem placeholder to the real resource. Use it whenever someone wants a new screen area backed by a new monolith module, a new resource in the UI, or asks how features are scaffolded, registered (features.json, nav), named, or verified (template:verify).
---

# A new feature

A feature pairs with a monolith module of the same noun: `review` -> module
`modules/reviews` (API `/v1/reviews`) -> feature `src/features/reviews` (routes
`/reviews`). Naming is the monolith's (`tools/naming.ts` mirrors its `new-module.ts`).

## The paired loop

```bash
# 1. In the monolith: the module, then reshape its domain and HTTP (gam-new-module)
cd ../global-architecture-monolith
pnpm new:module review
pnpm stack:up                                   # the API now serves /v1/reviews
# 2. Here: the contract, then the feature
cd -
pnpm api:sync --allow-dirty                     # snapshot from the running stack (dirty: uncommitted module)
pnpm new:feature review                         # refuses if /v1/reviews is not in the snapshot
pnpm dev
```

`--allow-dirty` marks `contracts/monolith/source.json` dirty, so `pnpm api:check` (and CI)
fails until you commit the monolith and run a clean `pnpm api:sync`. Commit the monolith
first, sync again, then commit here.

`pnpm new:feature` creates:

| Created                                                              | From                                         |
| -------------------------------------------------------------------- | -------------------------------------------- |
| `src/features/reviews/`                                              | `templates/feature/feature/`                 |
| `src/app/reviews/` (list, new, detail, edit)                         | `templates/feature/routes/`                  |
| `tests/e2e/features/reviews.spec.ts`                                 | `templates/feature/e2e/sample-items.spec.ts` |
| `features.json` entry (`apiPaths: ["/v1/reviews"]`, `dependsOn: []`) |                                              |
| the nav import in `src/app/_shell/nav.ts` (at its marker)            |                                              |

Options: `--plural <noun>` for irregular plurals (`person --plural people`),
`--no-contract-check` to scaffold before the API exists. A failed run removes what it
made and restores `features.json` and `nav.ts`.

## Reshaping SampleItem

1. `model/<noun>.ts`: the view model (what the UI shows), not the API DTO.
2. `model/forms.ts`: the zod form schema field by field as the browser posts it (strings;
   numbers through `.transform(Number).pipe(z.number()...)`), the API-field map (dotted
   `errors[].field` -> form field), and the module's reason codes -> messages (bind one to
   a field with `{ field, message }`).
3. `data/<plural>.gateway.ts`: one function per operation, `settle(api().VERB('/v1/...',
   { ...(await withCaller(caller, 'read'|'write')) }), toModel)`; public operations use
   `anonymous()`. Paths are literals under the feature's `apiPaths` (R8).
4. `ui/`: synchronous components; forms are `'use client'` with `useActionState`.
5. `views/`: async views (`requireUser`, gateways, `orInterrupt`), metadata functions.
6. `actions.ts`: `defineAction` per mutation (gaw-forms-and-actions).
7. `index.ts`: `nav` entries and client-safe types; `server.ts`: views and reads for other features.
8. Routes: thin pages calling views; route files only compose.

Keep the **five problem tests** (`actions.spec.ts`: VALIDATION_FAILED to a field, a module
code to its message, 401 to sign-in, USER_NOT_REGISTERED to registration, an unknown code
to a generic message) and the **five access tests** (e2e: anonymous signs in, a stranger
gets 404, an admin sees it, a stranger's list omits it, a login without a user registers).

## Public pages

Never added by the generator. To make a page public: list it in
`security/public-routes.json` with a reason (CODEOWNERS review), make its gateway use
`anonymous()` (the client guard refuses a token on public operations), and make sure the
monolith marks the operation public (`@Access.public`).

## Changing the template

Edit `templates/feature/` (and `contract/sample-items.openapi.json` when the monolith's
module template changes), run `pnpm api:sync` (regenerates `contract/`) and
`pnpm template:verify`: it generates `zz-template-checks`, runs the guardrails,
typecheck, its tests and `next build`, then restores everything.
