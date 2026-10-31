---

name: gaw-auth-and-security
description: Authentication and browser security in global-architecture-web - the BFF model (tokens only on the server, one __Host- sealed session cookie), the proxy pipeline order (CSRF, CSP, session and refresh, route gate), OIDC code flow with PKCE, single-flight refresh, logout and end-session, the opaque Caller and the session DAL (requireUser, requireAdmin), the nonce CSP, cookies, and the guarantees G1-G18. Use it whenever you touch sign-in, sessions, cookies, the proxy, route handlers, CSP or headers, add anything a browser could reach, or review a change for security.
---

# Authentication and security

## The model

- The browser holds one cookie, `__Host-Http-gaw-session`: a JWE (`dir` + A256GCM) with
  the tokens, sealed with `SESSION_KEYS` (first seals, all open: rotate by prepending).
  HttpOnly, Secure, SameSite=Lax, Path=/, host-only; ends at the absolute lifetime
  (`SESSION_MAX_AGE_S`, from login, not from refresh).
- Tokens never leave `src/platform`. Code outside holds a `Caller` (the token sits in a
  WeakMap; `JSON.stringify(caller)` shows only the subject). Only `platform/api/call.ts`
  turns it into an Authorization header (R10, S8).
- The monolith decides access. The web's checks (`requireAdmin`, `canEdit`) are UX.

## The proxy, in order (src/platform/proxy/pipeline.ts)

1. CSRF: a method other than GET/HEAD/OPTIONS needs `Origin === APP_ORIGIN` (a missing or
   `null` Origin is refused) -> 403 `CSRF_ORIGIN_MISMATCH`. Before any session work.
2. Context: a fresh nonce CSP and request id (inbound `x-request-id`/`x-gaw-*` overwritten),
   the path for returnTo.
3. Session: open the cookie; refresh the access token when due. **Only here**: Server
   Components cannot set cookies, and a lost rotated refresh token would revoke the login
   at the next reuse. Single flight per refresh token; the result is kept 60 s.
4. Route gate: a page GET without a session -> `/auth/login?returnTo=` unless public.
5. The same CSP on the request (Next nonces its scripts from it) and the response.

## Sign-in, refresh, logout

- `/auth/login`: PKCE S256, state, nonce sealed in `__Host-Http-gaw-txn` (10 min);
  `returnTo` through `safeReturnTo` (same-site paths only).
- `/auth/callback`: state, nonce, PKCE, RFC 9207 `iss`; a fresh session; `GET /v1/users/me`
  decides: back, `/register`, or an error page (a 401 there means the API refuses this
  provider: no session, no loop).
- Refresh: `invalid_grant` ends the session; network, timeout and 5xx keep it (the page
  then shows "sign-in service unavailable" if the token expired); a refreshed ID token must
  keep `iss` and `sub`.
- `/auth/logout` (POST, Origin re-checked): clear the cookie, revoke the refresh token if
  the provider can, leave through `end_session_endpoint` with `id_token_hint`.
- Remove cookies with `expireCookie` (full attributes, Max-Age=0), never `cookies.delete()`:
  browsers ignore the removal of a `__Host-` cookie without `Secure`.

## The session DAL (src/platform/session)

`getOptionalUser()` (never throws; public pages and the shell), `requireCaller()` (signed
out -> sign-in; expired and not renewed -> `IdentityUnavailableError`), `requireUser()`
(unregistered -> `/register`), `requireAdmin()` (else 404), `getSignInEmail()`. Check in
views and actions, never only in layouts.

## CSP and headers

`script-src 'self' 'nonce-N' 'strict-dynamic'`, `style-src 'self' 'nonce-N'` (dev: inline),
`style-src-attr 'unsafe-inline'`, `form-action 'self' <issuer>`, `frame-ancestors 'none'`,
no third parties, no inline scripts of our own (so no theme script). Static headers in
`next.config.ts`: HSTS, nosniff, DENY framing, COOP, CORP, Permissions-Policy.

## Never

- a login bypass, a test-only route that mints sessions, `NEXT_PUBLIC_` variables;
- a route handler outside `auth/` and `healthz`; a GET that changes state;
- widening the proxy matcher or `serverActions.allowedOrigins`;
- a token, session or cookie value in props, logs, URLs or client state;
- `forbidden()`/`unauthorized()` (a 403 is shown as a 404).

`docs/architecture/threat-model.md` maps each guarantee to its enforcement and its test.
CODEOWNERS covers `src/platform`, `src/proxy.ts`, `security/`, the guardrails and configs.

## Another provider

Register a confidential client (code + PKCE, `offline_access`, an access token with the
API's audience, `end_session_endpoint`), set `OIDC_ISSUER`, `OIDC_CLIENT_ID`,
`OIDC_CLIENT_SECRET` (and `OIDC_AUTH_PARAMS` such as `{"audience": "..."}`,
`OIDC_EXTRA_ORIGINS` for back-channel endpoints elsewhere), and add the issuer to the
monolith's `AUTH_ISSUERS`. Discovery is validated at first use and fails closed.
