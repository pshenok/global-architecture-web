---

name: gaw-platform-maintenance
description: Maintaining global-architecture-web's platform - upgrading Next, React, TypeScript and the toolchain together with global-architecture-monolith, re-checking the CSP, typed routes and tsconfig after a Next upgrade, changing guardrails and their probes, changing the feature template, keeping the API contract and the problem-code catalogue in step, CI and drift, and recording decisions in ADRs. Use it whenever you bump a dependency, change a guardrail, the template, CI or configuration, or the monolith's platform changed.
---

# Platform maintenance

## Upgrades

- Pins are exact. Before adding or bumping: `npm view <pkg>@<v> time` (exists, older than
  24 h: pnpm's `minimumReleaseAge` refuses newer), changelog read, then `pnpm check`,
  `pnpm build`, `pnpm test:e2e`.
- Shared tools move together with the monolith's catalog: TypeScript, Biome, oxlint,
  oxlint-tsgolint, Vitest, Vite, zod, jose, @types/node, Node and pnpm (`devEngines`, CI,
  Dockerfile). The nightly `drift.yml` warns when they differ.
- GitHub Actions are pinned by commit with the release in a comment; Dependabot proposes
  bumps (with a 7-day cooldown).
- shadcn primitives: `pnpm ui:add <name>` with `--diff`; keep `// Modified:` edits.

## A Next.js upgrade

Read `node_modules/next/dist/docs/01-app/02-guides/upgrading/` first. Then check:
- `next dev` and `next build` did not rewrite `tsconfig.json` or the managed block in
  `AGENTS.md` (commit Next's block if it changed);
- the CSP e2e (every script nonced, no violations on full loads and soft navigations);
- `check-build` (the proxy's manifest entry and matcher, nothing prerendered);
- `unstable_doesMiddlewareMatch` and other `experimental/testing` imports;
- Cache Components: still off by choice (ADR-0006); Next 17 makes it mandatory, which
  needs a nonce-compatible plan first.

## The API contract

- The monolith changed its API: `pnpm api:sync` (its stack up at a committed, clean
  tree), review the diff in `contracts/` and `src/platform/api/generated/`, fix types.
- New or renamed reason codes: `src/kernel/problem-codes.ts` and the features' messages.
- The monolith's module template changed: update
  `templates/feature/contract/sample-items.openapi.json` by hand, `pnpm api:sync`,
  `pnpm template:verify`.

## Guardrails

`tools/check-boundaries.ts` (R1-R12), `tools/check-access.ts` (S1-S10), `check-text.ts`,
`check-build.ts`, all on TypeScript 7's `unstable` API (`tools/source.ts`). A rule change
needs a probe in `tests/probes/` that fails without it (and the probes keep their
`// refused` markers on the right lines). The same rule is described in AGENTS.md, the
skills and the ADRs: change them together.

## Changing the platform kit

`src/platform` is CODEOWNERS-protected and covered by the coverage ratchet: add tests with
the change, raise the thresholds in `vitest.config.ts` when coverage goes up. A change to
the proxy, the session or the cookies needs the security e2e suite.

## Monolith-side follow-ups (not done)

- Key the monolith's rate limit on the token subject (all BFF users share one address).
- Commit the monolith template's OpenAPI document (the template fixture is hand-kept).
- `x-problem-codes` per response in the OpenAPI document.

## Decisions

A change of approach gets an ADR in `docs/architecture/adr/` (Nygard format: context,
decision, consequences), or an update to the one it changes.
