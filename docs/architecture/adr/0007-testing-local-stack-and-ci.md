# ADR-0007: Testing, local stack and CI

- Status: Accepted
- Date: 2026-10-30
- Derived from: the testing and CI sections of `global-architecture-monolith` (one job, real stack, no bypass)

## Context

The owner treats security and tests as gates. Several constraints shape the test setup:
- Vitest cannot render async Server Components.
- Base UI needs browser APIs that jsdom lacks.
- The e2e suite must exercise the real OIDC flow and the real API contract, so a mocked backend defeats its purpose.
- `NODE_EXTRA_CA_CERTS` is read only when Node starts.
- `next start` with standalone output only warns. The supported launcher is `node .next/standalone/server.js`.
- The monolith is public, so CI can check it out without a token.
- The monolith rate-limits each IP to 600 requests per minute.

## Decision

- **Unit tests.** Vitest 5.0.5, project `unit`, running on Node. The suite covers:
  - kernel and feature `model/` code;
  - platform security logic: codec, session policy, refresher, CSRF, CSP, route classification over every app route, the matcher pinned with `unstable_doesMiddlewareMatch`, and a proxy integration test against an MSW IdP;
  - gateways and actions against typed MSW 3.0.3 handlers.

  `server-only` is aliased to an empty module, and Next modules are mocked only at the edge.
- **Coverage gate.** A ratchet on `src/platform/{proxy,session,auth,net,api,actions}` (statements 94, branches 84, functions 94, lines 95 at adoption): raise it, never lower it. The remaining branches are defensive fallbacks; chasing 100% would add tests that prove nothing. There is no global coverage gate.
- **Component tests.** Vitest browser mode in Chromium (`@vitest/browser-playwright`, vitest-browser-react 2.3.0), in both color schemes. The real `server-only` and the real Tailwind CSS through PostCSS are loaded, and axe-core 4.14.0 runs with WCAG 2.2 AA tags. Only synchronous `ui/` components are tested here.
- **Template tests.** A `template` project runs `templates/feature` in place against its own contract (aliases point the feature and the operations table at the template).
- **E2E tests.** Playwright 1.64.1, Chromium only.
  - Runs against the monolith stack (`pnpm stack:up`) and the standalone web server on `http://localhost:9301`, started through `tools/serve.ts`. The tested artifact is the deploy artifact.
  - The global setup preflights `/readyz`, IdP discovery, client registration, and that the live spec equals the snapshot.
  - Personas log in through the dev IdP form. Admin is granted with the monolith CLI.
  - storageState files are gitignored and never uploaded.
  - The suite contains the security tests (CSRF, CSP, token leak, cookies, refresh race, logout, redirects, headers, authorization statuses, access sweep), the feature journeys, and axe in light and dark.
  - It uses 2 workers, because of the rate limit.
  - Never a login bypass, a mocked-backend gate, or `next/experimental/testmode`.
- **Guardrails.** `check-boundaries`, `check-access` and `check-text` run in `pnpm lint` and self-test against their probes. `check-build` runs after `next build`.
- **Template check.** `pnpm template:verify` generates a throwaway feature, runs everything against it, then restores the tree.
- **Local stack.**
  - `tools/env-files.ts` generates `.env.local`.
  - `tools/dev.ts` and `tools/serve.ts` set `NODE_EXTRA_CA_CERTS` before launching Next.
  - Dev runs on `http://localhost:9300`.
  - No PM2 and no web-side TLS.
- **CI.** One job, like the monolith.
  - Check out the web repo into `web/` and the monolith at the commit in `contracts/monolith/source.json` into `monolith/`.
  - Run: install, `pnpm audit`, lint, typecheck, tests, `api:check`, build, `template:verify`, monolith `db:setup` and `stack:up`, then e2e.
  - On failure, upload the reports, never the auth state.
  - Actions are pinned by SHA, with `contents: read`.
  - A nightly `drift.yml` runs contract drift, e2e against monolith `main`, a toolchain diff against the monolith catalog, and the audit.

## Consequences

- Contract and auth regressions surface in the PR that causes them, while the pinned monolith commit keeps CI reproducible.
- The CI job is heavier than a static check: it needs Postgres, the monolith stack and Chromium.
- Async Server Components are covered only by e2e, so they must stay thin.
- The coverage gate can be gamed by low-value tests. Code review stays necessary.
