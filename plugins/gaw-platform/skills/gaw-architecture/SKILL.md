---

name: gaw-architecture
description: Map and ground rules of global-architecture-web, the Next.js 16 App Router BFF in front of global-architecture-monolith (OIDC on the server, one sealed session cookie, a proxy pipeline, an API client generated from the monolith's OpenAPI document, feature slices with enforced boundaries). Use it first whenever you work in this repository or on a feature generated from its template, even for a "small" change, and whenever you need to decide where code belongs, which slice may import which, how sessions, API calls, Server Actions, errors and caching work, or which other gaw-* skill applies.
---

# global-architecture-web: platform map

One Next.js 16.4 app (App Router, Turbopack, standalone output) on Node 26 and React 19.3.
It renders every page on the server, keeps OIDC tokens there, and calls the monolith's
API for the signed-in person. The browser holds one cookie. The monolith is the authority
on data and access; this app is a thin, strict client of it.

**Read the Next docs in `node_modules/next/dist/docs/`, never memory**: this version
renamed middleware to proxy, made request APIs async and changed caching.

## Repository layout

| Path                          | What                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/proxy.ts`                | Next's proxy entry: one line, `runProxy(request)`, a pinned matcher                                                                   |
| `src/instrumentation.ts`      | validates config at boot, logs request errors                                                                                         |
| `src/app/`                    | routes only (the composition root): thin pages, `_shell/` (header, nav, user menu), `auth/` and `healthz` route handlers              |
| `src/features/<f>/`           | feature slices (`users`, `houses`, `bookings`), registered in `features.json`                                                         |
| `src/platform/`               | the kit: `config`, `net`, `session`, `auth`, `proxy`, `api`, `actions`, `errors`, `http`, `observability`, `health`                   |
| `src/ui/`                     | design system: `primitives/` (shadcn on Base UI, owned), composites, `form/`, `hooks/`                                                |
| `src/kernel/`                 | framework-free: problem codes, form state, page, money, dates, locale                                                                 |
| `templates/feature/`          | the feature template (`SampleItem`), compiled and tested in place                                                                     |
| `contracts/monolith/`         | `openapi.json` snapshot + `source.json` (the monolith commit, a lockfile for CI)                                                      |
| `security/public-routes.json` | the only routes reachable without a session (CODEOWNERS)                                                                              |
| `tools/`                      | guardrails (`check-boundaries`, `check-access`, `check-text`, `check-build`), `api-sync`, `new-feature`, `verify-template`, launchers |
| `tests/`                      | `support/` (MSW, fake IdP, session helpers), `probes/` (guardrail self-tests), `e2e/` (Playwright)                                    |

## Slices and who imports whom

| Slice          | May import                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernel`       | nothing outside itself (no npm packages)                                                                                                              |
| `ui`           | kernel, ui, React, Base UI, lucide, `cn`, cva, `next/link`, `next/form`, `next/navigation`                                                            |
| `platform`     | kernel, platform, npm packages; never features, app or ui                                                                                             |
| `features/<f>` | kernel, ui, platform **entries** (`@/platform/<entry>`), its own files, and `@/features/<g>` / `@/features/<g>/server` when `g` is in its `dependsOn` |
| `app`          | features' `index.ts`/`server.ts`, ui, kernel; `app/auth` uses `@/platform/auth`, `app/_shell` uses `@/platform/session`                               |

Platform entries and their users: `api` (a feature's `data/`), `session` (`views/`,
`server.ts`, `actions.ts`, the shell), `actions` (`actions.ts`), `errors` (`views/`,
`server.ts`), `auth` (`app/auth`), `health` (`app/healthz`), `proxy` (`src/proxy.ts`).

## Inside a feature

```
index.ts    client-safe public API: types, client-safe components, `nav`
server.ts   'server-only': views, metadata functions, reads other features may use
actions.ts  'use server': only `export const x = defineAction({...})`
model/      framework-free: view models, zod form schemas, field maps, messages, UX rules
data/       'server-only' gateways: the ONLY callers of api(), on the feature's own apiPaths
views/      'server-only' async Server Components: session, gateways, orInterrupt, compose ui/
ui/         synchronous components ('use client' where interactive); actions arrive as props
```

Layer matrix (value imports): model <- data <- views; ui <- model; actions.ts <- model,
data; server.ts <- model, data, views, actions; index.ts <- model, ui. Type-only imports
are always allowed.

## The request in one paragraph

`proxy.ts` refuses unsafe requests from other origins, sets a nonce CSP, opens the session
cookie and refreshes the access token when due (the only place that refreshes), and sends
signed-out page requests to sign-in unless the route is public. Pages render views; views
call gateways with an opaque `Caller`; the API client refuses a token on public operations
and a missing one elsewhere; problems become a 404, sign-in, registration or the error
page. Mutations are `defineAction` Server Actions used by plain forms.

## Which skill

| Task                                                | Skill                      |
| --------------------------------------------------- | -------------------------- |
| a new feature (with the monolith's `new:module`)    | `gaw-new-feature`          |
| what a feature exposes, cross-feature reads         | `gaw-feature-api`          |
| calling the API, the contract, problems, paging     | `gaw-data-access`          |
| pages, routes, public routes, metadata, error pages | `gaw-pages-and-routing`    |
| forms and Server Actions                            | `gaw-forms-and-actions`    |
| sessions, OIDC, CSRF, CSP, tokens                   | `gaw-auth-and-security`    |
| components, tokens, accessibility                   | `gaw-ui`                   |
| tests at every level                                | `gaw-testing`              |
| running and debugging locally                       | `gaw-local-stack`          |
| reviewing a change                                  | `gaw-code-review`          |
| upgrades, guardrails, the template                  | `gaw-platform-maintenance` |

## Decisions

`docs/architecture/adr/0001..0007`, `overview.md`, `threat-model.md` (the "why"). The
monolith's own skills (`gam-*`) cover the API side.
