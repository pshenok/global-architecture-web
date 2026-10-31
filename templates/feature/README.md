# templates/feature

The web twin of global-architecture-monolith's `templates/module`: a complete feature
for its `/v1/sample-items` (list, detail, create, edit, delete), compiled and tested in
place on every `pnpm check`, never mounted. `pnpm new:feature <noun>` copies it:

| Template                   | Becomes                               |
| -------------------------- | ------------------------------------- |
| `feature/`                 | `src/features/<plural>/`              |
| `routes/`                  | `src/app/<plural>/`                   |
| `e2e/sample-items.spec.ts` | `tests/e2e/features/<plural>.spec.ts` |

`contract/` is not copied: `sample-items.openapi.json` mirrors the monolith template's
routes (kept by hand), and `pnpm api:sync` merges it into the app's snapshot to generate
`schema.d.ts` and `operations.ts` for this folder only. Every feature keeps the five
problem tests (`feature/actions.spec.ts`) and the five access tests (`e2e/`).
The `gaw-new-feature` skill walks through the paired loop with the monolith.
