# ADR-0006: Rendering, caching and browser security

- Status: Accepted
- Date: 2026-10-30

## Context

Next 16.4 recommends Cache Components (`cacheComponents` plus `partialPrefetching`) for every app. `create-next-app` enables both by default, and Next 17 will remove the opt-out.

That recommendation conflicts with this app in three ways:
- The Next CSP guide says Partial Prerendering is incompatible with a nonce-based CSP.
- `'use cache'` keys and tags are stored in plain text.
- Almost every page here shows per-user data fetched with a bearer token.

Other facts that bear on the decision:
- Verified in next@16.4.3 source: boundary chunk scripts, `<style>` and `<link>` all carry `ctx.nonce`. The #98015 fix is shipped even though the issue is still open.
- A proxy response whose CSP differs from the request's disables the nonce (#99360).
- Streaming responses keep status 200 once the body has started.
- `forbidden()` and `unauthorized()` still require the experimental `authInterrupts` flag.
- A route that reads no request data is prerendered at build time, and its fetches run during `next build`.

## Decision

- **Every route renders at request time.** The root layout calls `await connection()`.
  - `cacheComponents` stays off.
  - No `dynamic`, `revalidate`, `fetchCache`, `runtime` or `dynamicParams` segment exports, and no `'use cache'` (`check-access` S5). The code stays mechanical to migrate.
  - `check-build` asserts that no app route is prerendered (Next's own `/_not-found` and `/_global-error` excepted).
  - Verified on the standalone build: every `<script>` carries the request's nonce, on full loads and soft navigations, with no CSP violation; no fallback was needed.
- **Nonce CSP from the proxy, identical on request and response:**
  - `script-src 'self' 'nonce-N' 'strict-dynamic'`;
  - `style-src 'self' 'nonce-N'` and `style-src-attr 'unsafe-inline'`;
  - `form-action 'self'` plus the issuer origin;
  - `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'`;
  - `upgrade-insecure-requests` on https;
  - in dev only, `'unsafe-eval'` and inline styles.
  - There are no inline scripts of our own.
  - Documented fallbacks, used only if the CSP e2e gate trips: `experimental.turbopackSharedRuntime: false`, and `style-src 'unsafe-inline'`.
- **Static hardening headers** in `next.config.ts`: HSTS, nosniff, Referrer-Policy, `X-Frame-Options: DENY`, COOP, CORP and Permissions-Policy. `poweredByHeader` is off.
- **No experimental feature flags.**
  - Authorization problems in reads map to `notFound()`, in line with the monolith's rule of returning 404 for what the caller may not know. The mapping is isolated in `src/platform/errors/interrupts.ts`.
  - The only `experimental` key is `proxyClientMaxBodySize: '1mb'`, which is a size limit.
  - React Compiler, `taint` and `viewTransition` are off.
- **Real status codes.** Detail lookups run before anything streams, and no `loading.tsx` sits above a dynamic detail page (`check-access` S6).
- **Output and deploy.**
  - `output: 'standalone'` with `typedRoutes`.
  - `deploymentId` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` are shared across all instances of a release.
  - Behind a TLS-terminating reverse proxy that does not buffer responses and that overwrites `Host` and `X-Forwarded-*`.
- **Observability.**
  - `instrumentation.register()` validates the env at boot.
  - `onRequestError` logs the digest, path, route type and request id, never headers.
  - OpenTelemetry is deferred.

**Revisit triggers.** Next 17 (which removes the opt-out), or Next documenting nonce support together with a static shell. The first candidate for caching is the anonymous house catalogue: a token-free `'use cache'` getter with a short `cacheLife`.

## Consequences

- The CSP is strict, with no per-user data in any cache, and the CSP e2e gate covers full loads and soft navigations of every route.
- Every page costs a server render, with no prerendered shell, and the app departs from Next's own recommendation. A migration is certain at Next 17.
- Users who are not allowed to see a page get a 404, never a 403 page. Switching to `forbidden()` later is a one-file change plus enabling the flag.
