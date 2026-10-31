# global-architecture-web

The web frontend of
[global-architecture-monolith](https://github.com/pshenok/global-architecture-monolith):
a Next.js 16 App Router app built as a BFF (backend for frontend). It signs people in
with OIDC on the server, keeps the tokens there, and gives the browser one encrypted
session cookie. Every screen talks to the monolith's API through a client generated from
its OpenAPI document. Features keep boundaries the way the monolith's modules do,
enforced by guardrails that test themselves, and Claude Code skills encode the rules.

```
 browser ── one cookie: __Host-Http-gaw-session (sealed JWE, HttpOnly, Secure, SameSite=Lax)
    │
    ▼  every request
 src/proxy.ts ── CSRF: Origin must be the app ── nonce CSP ── open the session,
    │            refresh the access token (single flight) ── deny by default
    ▼
 Server Components and Server Actions (features/*: views, defineAction)
    │  Caller (opaque; the token never leaves src/platform)
    ▼
 platform/api: openapi-fetch + guard (no token to public operations) + deadlines
    │  HTTPS, Bearer
    ▼
 global-architecture-monolith :9443  <── dev IdP :9090 (code flow + PKCE, for this app)
```

## Quick start

Prerequisites: the monolith checked out next to this repository (or `GAM_MONOLITH_DIR`)
with its stack running, and any `pnpm` 10+ (the repo pins and downloads Node 26 and
pnpm 12 itself).

```bash
cd ../global-architecture-monolith && pnpm install && pnpm stack:up && cd -
pnpm install
pnpm dev             # http://localhost:9300: Sign in opens the dev IdP's form (any subject)
```

`pnpm dev` writes `.env.local` the first time (the client registration comes from the
monolith's `modules.json`, the session key is random) and trusts the stack's dev
certificate. To run what production runs:

```bash
pnpm build && pnpm start          # the standalone server on :9301
pnpm test:e2e                     # Playwright against it and the monolith's stack
```

## What is inside

| Path                                   |                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/app`                              | routes only: thin pages that compose features, the shell, auth route handlers                                       |
| `src/features/{users,houses,bookings}` | feature slices: `model/`, `data/` (the only API callers), `views/`, `ui/`, `actions.ts`, `index.ts`, `server.ts`    |
| `src/platform`                         | the kit: config, outbound fetch, session, OIDC, the proxy pipeline, the API client, `defineAction`, errors, logging |
| `src/ui`                               | design system: shadcn primitives on Base UI (owned), composites                                                     |
| `src/kernel`                           | framework-free: problem codes, form state, money, dates                                                             |
| `templates/feature`                    | the feature template used by `pnpm new:feature` (compiled and tested in place)                                      |
| `contracts/monolith`                   | the API's OpenAPI snapshot and the monolith commit it came from                                                     |
| `security/public-routes.json`          | the only routes reachable without a session                                                                         |
| `tools`, `tests`                       | guardrails and their probes, codegen, generator, launchers, unit and e2e suites                                     |
| `plugins/gaw-platform`                 | Claude Code plugin with the platform skills (also linked into `.claude/skills`)                                     |
| `docs/architecture`                    | overview, threat model and architecture decision records                                                            |

## Stack

Node 26, pnpm 12, TypeScript 7, Next.js 16.4 (App Router, Turbopack, standalone output),
React 19.3, openid-client 6 + jose (OIDC, sealed session), openapi-typescript +
openapi-fetch (API client), Zod 4, Tailwind CSS 4 + shadcn (Base UI) + lucide, Vitest 5
(Node and browser mode) + MSW 3 + axe, Playwright, Biome + oxlint + knip. Why each was
chosen, and what was rejected: `docs/architecture/adr/0001-platform-stack.md`.

## Everyday commands

```bash
pnpm check                     # lint + typecheck + tests + api:check
pnpm test:coverage             # the security core's coverage ratchet
pnpm build                     # next build + check-build
pnpm api:sync                  # after the monolith's API changes (its stack up, its tree clean)
pnpm new:feature review        # after `pnpm new:module review` in the monolith
pnpm template:verify
pnpm ui:add <component>
```

## Working with Claude Code

Open the repo in Claude Code: `CLAUDE.md` (which loads `AGENTS.md`) and the `gaw-*` skills
load automatically. Start from the `gaw-architecture` skill. To use the skills in another
repository:

```text
/plugin marketplace add pshenok/global-architecture-web
/plugin install gaw-platform@global-architecture-web
```

## Status and known gaps

Verified: unit, template and component tests (Chromium, light and dark, axe), the template
check, a production build, and the end-to-end suite against the monolith's stack. CI runs
the same gate on every push and PR against the monolith commit in
`contracts/monolith/source.json`. Not built yet:
- every user behind this BFF shares the monolith's per-address rate limit (the monolith
  should key it on the token's subject before production load);
- the refresh single flight is per process: production needs one replica, sticky
  sessions, or a provider with a refresh-reuse grace window;
- the feature template's contract fixture is kept by hand until the monolith commits its
  template's OpenAPI document;
- no image publishing or deployment infrastructure.
