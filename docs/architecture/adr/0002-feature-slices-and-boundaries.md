# ADR-0002: Feature slices and boundaries

- Status: Accepted
- Date: 2026-10-30
- Derived from: ADR-0002 of `global-architecture-monolith` (modules and boundaries)

## Context

The app must stay structured as it grows to dozens of features, many of them written by AI agents. The monolith enforces module boundaries with packages, a registry (`modules.json`), lint, and TypeScript 7 AST checkers (`check-boundaries`, `check-access`) whose self-testing probes prove they work.

A Next.js app is one compilation unit:
- `PageProps`, `LayoutProps` and typed hrefs exist only in the app's tsconfig project.
- Workspace packages would need `transpilePackages` and would lose those types.
- Off-the-shelf boundary tools do not support TS 7: dependency-cruiser stops below TS 7, and eslint-plugin-boundaries needs ESLint.

Next adds its own boundary: a `'use client'` file must never pull server code. Next fails the build only when the `server-only` marker is present.

## Decision

**Slices.** Each slice is named after the monolith package that plays the same role.

| Slice              | Monolith analogue | Contents and limits                                                                                                                                                                                                  |
| ------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/kernel`       | `@gam/kernel`     | Framework-free: no npm packages, no React, no zod. Holds problem codes, form state, `Page`, money, dates and locale.                                                                                                 |
| `src/platform`     | `@gam/platform`   | Config, outbound fetch, session, auth, proxy, API client, actions, errors, observability and health. Reached only through `@/platform/<entry>` roots, each with designated importers. Never imports features or app. |
| `src/ui`           | (none)            | Design system: shadcn primitives (owned), composites and hooks.                                                                                                                                                      |
| `src/features/<f>` | modules           | Feature slices.                                                                                                                                                                                                      |
| `src/app`          | apps/api          | Routing only, and the composition root. Route files are thin and may compose several features.                                                                                                                       |

**Registry.** `features.json` is managed by `pnpm new:feature`. Each entry declares the feature's dir, its owned API path prefixes (`apiPaths`) and its feature dependencies (`dependsOn`, which must be acyclic).

**Feature anatomy.**

| Path         | Role                                                        |
| ------------ | ----------------------------------------------------------- |
| `index.ts`   | Client-safe public API                                      |
| `server.ts`  | Server public API, starts with `import 'server-only'`       |
| `actions.ts` | `'use server'`; contains only `defineAction` exports        |
| `model/`     | Framework-free: zod form schemas, mappings, messages, rules |
| `data/`      | Server-only gateways. The only code that calls `api()`      |
| `views/`     | Server-only async Server Components                         |
| `ui/`        | Synchronous components only                                 |

Client components receive Server Actions only as props. A feature reaches another feature only through `@/features/<g>` or `@/features/<g>/server`, and only if `<g>` is listed in its `dependsOn`. A feature's `data/` may call only literal API paths under its own `apiPaths`. This is the web counterpart of the monolith's schema-per-module rule.

There is no ports-and-adapters layer inside a feature. The monolith owns every business rule, and the generated OpenAPI types are the port.

**Enforcement.**
- `tools/check-boundaries.ts` is ported from the monolith's walker and runs on `typescript/unstable/ast` + `unstable/sync`, covering `.ts` and `.tsx`. It enforces rules R1 to R12:
  - relative imports stay inside their slice, and alias imports name their target directly (no empty, `.` or `..` segments, no `/index`);
  - `src` holds only the known slices, and the slice matrix and platform entries hold;
  - the declared, acyclic feature graph, reached through public entries only;
  - the layer matrix;
  - synchronous `ui/`;
  - the client boundary;
  - the required `server-only` marker;
  - API ownership, read on the syntax tree: `api().<METHOD>('<literal path>', ...)` only, the client imported statically by name and never re-exported;
  - single owners of `openapi-fetch`, `openid-client`, `jose`, global `fetch` and `next/headers`;
  - `authorizationHeader` used only by the API layer;
  - testing modules never imported by production code;
  - the registry matches the folders on disk.
- Each run self-tests on `tests/probes/boundaries`: a line marked `// refused` must be refused, and no other line may be.
- Biome `noRestrictedImports` overrides mirror the main rules for editor feedback.
- `next build` provides the transitive guarantee through `server-only`.

**Template.** New features come from `templates/feature`, the UI twin of the monolith's `templates/module` (`/v1/sample-items`):
- It is compiled and tested in place under its own tsconfig.
- `pnpm new:feature` copies and renames it, reusing the monolith's naming code copied verbatim.
- `pnpm template:verify` generates a throwaway feature, runs every check and `next build`, then restores the tree.

## Consequences

- Boundaries depend on a custom checker plus a registry rather than package edges. The owner maintains about 300 lines on TypeScript's unstable API, and the probes fail loudly if that API changes.
- Adding a feature means running `pnpm new:feature`. Cross-feature reuse becomes explicit (`dependsOn`, `server.ts` queries) and reviewable.
- Components in `ui/` stay unit-testable. Async composition lives in `views/` and is covered by e2e, because Vitest cannot render async Server Components.
- Rejected:
  - one workspace package per feature, because typed routes would be lost;
  - dependency-cruiser and eslint-plugin-boundaries, because of TS 7;
  - route groups as access declarations (ADR-0003);
  - a use-case and ports layer, because the API owns all rules.
