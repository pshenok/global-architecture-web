# ADR-0003: BFF authentication and session

- Status: Accepted
- Date: 2026-10-30
- Related: ADR-0004 of `global-architecture-monolith` (identity and authorization)

## Context

The owner locked the IETF OAuth 2.0 for Browser-Based Apps BFF pattern (draft-27): OIDC tokens live only on the Next server, and the browser holds an httpOnly session cookie.

The monolith side:
- It accepts bearer access tokens with audience `gam-api` from configured issuers.
- It refuses ID tokens.
- It answers 401 `AUTH_TOKEN_*`, 403 `USER_NOT_REGISTERED`, and 503 (never 401) during an IdP outage.
- Users register themselves through `POST /v1/users`, and the users module is the system of record.
- Its dev IdP (`tools/dev-idp.ts`) only mints tokens through a JSON `POST /token`. It has no authorization endpoint, no PKCE, no refresh tokens and no end-session.

Next 16.4.3 constraints:
- Server Components cannot set cookies.
- Cookies the proxy sets are merged into `cookies()` for the same render (verified in source).
- The built-in check on Server Actions lets requests with no Origin header through, and Route Handlers get no CSRF check at all.
- The proxy runs on Node, in the same process as route handlers but in a separate module instance.

## Decision

1. **Relying party.** openid-client 6.8.8 as a confidential client named `gaw-web` (`client_secret_basic`), using authorization code + PKCE S256 + state + nonce, with `idTokenExpected`.
   - `redirect_uri` is built from `APP_ORIGIN`, never from Host.
   - Discovery is validated: the authorization and end-session endpoints must be on the issuer origin, the other endpoints must be on an allowlist, and S256 must be supported.
   - `allowInsecureRequests` is enabled only for an http issuer on a loopback host.
2. **Session.** A stateless JWE cookie sealed with jose 6.2.13 (`dir` + `A256GCM`).
   - `kid` rotation through `SESSION_KEYS`; `typ` is bound to the purpose (session or login transaction).
   - Absolute lifetime anchored on `createdAt`.
   - A 3800-byte cap with no chunking.
   - Contents: `{ iss, sub, sid, at, atExp, atLife, rt, idt, email, createdAt }`.
   - The platform user and roles are never stored. They come from `GET /v1/users/{me}` once per request.
   - Not a server-side store: the BCP recommends client-side sessions for a BFF, and this needs no Redis.
   - Not iron-session: jose is already in the tree, so it adds zero packages and uses raw keys.
3. **Cookie policy, the same everywhere.**
   - `__Host-Http-gaw-session` and `__Host-Http-gaw-txn` (600 s), both `HttpOnly; Secure; SameSite=Lax; Path=/` with no Domain.
   - `APP_ORIGIN` must be https or `http://localhost:<port>`. Chromium stores and sends these cookies on http://localhost (verified), so dev and e2e run the production cookie path.
   - Cookies are removed by setting them again, empty, with all their attributes and `Max-Age=0` (`expireCookie`), never with `cookies.delete()`: Next sends that without `Secure`, and browsers ignore the removal of a `__Host-` cookie that lacks it (found by the logout e2e).
   - **SameSite=Lax is a documented deviation from the BCP's SHOULD Strict.** Strict cookies are not sent on the cross-site IdP-to-callback chain or on email deep links, which would cause login loops.
4. **CSRF.** The proxy refuses every method other than GET, HEAD or OPTIONS unless `Origin === APP_ORIGIN`; a missing Origin is a 403. This check runs before any session work. It adds to:
   - Next's own check on Server Actions;
   - SameSite=Lax;
   - logout being POST only;
   - no GET that changes state.
     `serverActions.allowedOrigins` is never widened.
5. **Refresh happens only in the proxy.**
   - Single flight per refresh token: a `globalThis` map keyed by sha256 holds the in-flight call and keeps the settled result for 60 s, for requests that still carry the pre-rotation cookie.
   - A refresh is due when `atExp - now <= min(60, atLife / 2)`.
   - `invalid_grant` ends the session. Network errors, timeouts and 5xx keep it.
   - A refreshed ID token must keep the original `iss` and `sub`.
   - There is no refresh during render and no `/auth/refresh` route. An expired token at render time shows "sign-in service unavailable" with a retry.
   - An unavailable IdP is not remembered: the next request tries again.
   - The discovered OIDC configuration is memoized per module instance, not on `globalThis`. The proxy and the route handlers load separate copies of openid-client, and a `Configuration` from one fails the other's `instanceof` check (found when every refresh reported the IdP unavailable).
6. **Route protection.**
   - The proxy denies by default, using a list compiled from `security/public-routes.json` (CODEOWNERS-reviewed). Patterns support `[id:uuid]`. A session-less GET or HEAD is redirected to `/auth/login`; unsafe methods are never redirected.
   - A server-only DAL (`requireCaller`, `requireUser`, `requireAdmin`) runs in views and in every action.
   - The monolith API remains the only authorization authority.
7. **Caller.** An opaque `Caller` (the token is in a module-private WeakMap) is passed explicitly to gateways. This mirrors the monolith's `currentUser()` as first argument. Only the API layer reads its authorization header.
8. **Flows.**
   - `GET /auth/login`: `safeReturnTo` is applied, and the login transaction is sealed into the txn cookie.
   - `GET /auth/callback`: a fresh session is created, which makes it safe against session fixation. It then calls `GET /v1/users/me`: a 200 goes to returnTo, `USER_NOT_REGISTERED` goes to `/register`, and a 401 goes to an error page with no loop.
   - `/register` calls the Server Action `POST /v1/users`. `USER_ALREADY_REGISTERED` counts as success.
   - `POST /auth/logout`: the Origin is re-checked, the cookie is cleared, refresh revocation is attempted best-effort, then the user goes to the end-session endpoint with `id_token_hint` and `client_id`.
9. **Dev IdP: extend the monolith's dev IdP** (`tools/dev-idp/`, split by endpoint; monolith PR #1).
   - It gains `/authorize` with a strict sign-in form (sub, email, email_verified, and an access-token lifetime knob), single-use codes bound to the client, redirect, PKCE challenge and nonce, and `iss` on every authorization response.
   - `POST /token` gains form-encoded grants: code and refresh. Refresh tokens are issued only with `offline_access`, are rotated on every use, and reuse revokes the family.
   - ID tokens with `aud = client_id`, and `/end-session`.
   - Clients are registered in `modules.json` `devIdp.clients`. The dev secret `dev-insecure-gaw-web` is committed and labelled as a non-secret.
   - The JSON mint, `/jwks.json`, `/userinfo` and `/rotate` stay unchanged.
   - Rejected: a second IdP in the web repo (two subjects per person, a cross-repo issuer dependency) and oidc-provider (a disproportionate config surface, unverified here).
   - One issuer means `pnpm dev:token alice` and a web login as alice are the same platform user.
10. **Never a login bypass.** No test-only route mints a session. e2e signs in through the dev IdP form.

## Consequences

- Tokens never reach the browser. Guarantees G1, G3, G5, G8, G9 and G10 are each pinned by unit tests and by a security e2e suite: token-leak scan, CSRF, parallel refresh burst with 6 s tokens, logout replay, open-redirect table, and access sweep.
- A stateless session cannot be revoked instantly. A stolen cookie works until its access token expires, so production access tokens should live 5 minutes or less.
- The refresh dedupe is per process. Production must run one replica, use sticky sessions, or set an IdP refresh-reuse grace of at least 60 s.
- Session max age equals the refresh token's absolute lifetime.
- An IdP whose tokens exceed the 3800-byte cap fails login loudly. Supporting it needs an ADR change, such as a server-side store behind the same read and write API.
- The monolith carried a prerequisite PR (dev IdP code flow, client registry, its own e2e, ADR-0004 local-development notes), merged as monolith PR #1; `contracts/monolith/source.json` pins a commit on the monolith's main, which CI checks out.
- Dev-IdP restarts drop refresh tokens. Web sessions then end at their next refresh.
