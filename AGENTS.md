# global-architecture-web

The web frontend of global-architecture-monolith: a Next.js 16 App Router app acting as a
BFF (backend for frontend). OIDC tokens live only on this server; the browser holds one
encrypted session cookie. Read the `gaw-architecture` skill before changing anything; it
maps the repo and links the other `gaw-*` skills.

## Commands

```bash
pnpm install                    # pinned Node 26 + pnpm 12 are fetched automatically
pnpm dev                        # http://localhost:9300 (the monolith's `pnpm stack:up` first)
pnpm check                      # lint (Biome, guardrails, oxlint, knip) + typecheck + tests + api:check
pnpm build && pnpm test:e2e     # the standalone build on :9301 against the monolith's stack
pnpm api:sync                   # snapshot the monolith's OpenAPI document and regenerate the client
pnpm new:feature <noun>         # a feature from templates/feature (after `pnpm new:module <noun>` there)
pnpm template:verify            # prove the template still generates a green feature
pnpm ui:add <component>         # a shadcn primitive into src/ui/primitives (re-check pins after)
```

## Rules that break production when ignored

- Tokens never leave `src/platform`: features hold an opaque `Caller` and pass it to
  gateways; `authorizationHeader` is read only by `platform/api/call.ts`. Never put a
  token, a session or an API response with secrets into props of a client component.
- Every server module starts with `import 'server-only'` (platform, a feature's `data/`,
  `views/`, `server.ts`). `'use client'` files import no server code; Server Actions reach
  them as props.
- Every Server Action is `export const x = defineAction({ access, input, ... })` in a
  feature's `actions.ts`; never an inline `'use server'`. Handlers return an outcome; never
  call `redirect()` inside them.
- The monolith is the authority on who may do what. The web never decides access on its
  own data; `requireUser`/`requireAdmin` and `canEdit`-style checks are UX only.
- Pages are deny-by-default: a route is public only when listed in
  `security/public-routes.json` (CODEOWNERS). Never widen the proxy matcher, never add a
  route handler outside `auth/` and `healthz`, never add a login bypass.
- No cross-request caching: no `'use cache'`, `unstable_cache`, `revalidateTag`, fetch cache
  options or segment config exports. Every route renders per request (the CSP nonce).
- A feature calls the API only on its own `apiPaths` (features.json), with literal paths,
  through `api()` in `data/`. Another feature is reached through `@/features/<g>` or
  `@/features/<g>/server`, listed in `dependsOn`.
- No `NEXT_PUBLIC_` variables; `process.env` is read only by `platform/config/env.ts`.
- Cookies are removed with `expireCookie`, never `cookies.delete()` (`__Host-` cookies need
  their attributes to go away).
- UI: design tokens only (no raw palette classes), lucide icons, no emoji, one h1 per page,
  labels on every field, AlertDialog for destructive actions.
- Commit messages in English.

## Status

A full client of the monolith: sign-in (code flow + PKCE at the monolith's dev IdP),
registration, account, the house catalogue, house management, bookings as guest and host,
admin users. 171 unit, template and component tests; 33 end-to-end tests against the real
stack (features, security, accessibility in both color schemes).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
