---

name: gaw-local-stack
description: Run and debug global-architecture-web locally against global-architecture-monolith's stack - pnpm dev on :9300, the standalone build on :9301 (pnpm start), .env.local generation, the dev CA (NODE_EXTRA_CA_CERTS), the dev IdP's sign-in form and its access-token lifetime knob, granting admin, logs with request ids, and troubleshooting sign-in, refresh, CSP and API errors. Use it whenever someone wants to run the app, sign in locally, reproduce a bug, read logs, or something fails to start.
---

# Local stack

## Run

```bash
cd ../global-architecture-monolith && pnpm stack:up && cd -   # API :9443, dev IdP :9090, Postgres
pnpm dev                                                      # http://localhost:9300
pnpm build && pnpm start                                      # the production server on :9301
```

- The monolith checkout: `features.json` `monolith.dir` (`../global-architecture-monolith`)
  or `GAM_MONOLITH_DIR`.
- `.env.local` is written once (mode 0600): `APP_ORIGIN`, `API_BASE_URL`, `OIDC_ISSUER`,
  the `gaw-web` client from the monolith's `modules.json` (`devIdp.clients`), a random
  `SESSION_KEYS`. Delete it to regenerate (everyone signs in again).
- `tools/dev.ts` and `tools/serve.ts` set `NODE_EXTRA_CA_CERTS` to the monolith's
  `.certs/dev-ca.pem` (Node reads it only at start).

## Signing in

"Sign in" opens the dev IdP's form: any subject, an email (empty: `<subject>@example.com`),
"email verified", and the access-token lifetime (5-3600 s; 6 s to watch refresh). A new
subject lands on `/register`. The same subject at `pnpm dev:token <sub>` in the monolith is
the same platform user.

Admin: find the user id (`/account` shows nothing; use the monolith:
`TOKEN=$(pnpm -s dev:token <sub> --email <email>)`, `GET /v1/users/me`), then
`pnpm users:grant-role <id> admin` in the monolith. Roles apply on the next request.

## Logs

JSON lines (`level`, `time`, `msg`, `requestId`, `code`, `status`, `reason`). The
`requestId` is the one sent to the API as `x-request-id`: grep the monolith's logs for it
(`pnpm exec pm2 logs gam-api` there).

## Troubleshooting

| Symptom                                            | Cause                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `invalid configuration: ...` at start              | a variable in `.env.local` (names only are printed)                                                            |
| sign-in goes to `/auth/error?code=IDP_UNAVAILABLE` | the dev IdP is down or its discovery fails validation                                                          |
| `API_REJECTED_TOKEN` after sign-in                 | the API refuses the provider's tokens (audience, issuer not in `AUTH_ISSUERS`)                                 |
| "sign-in service unavailable" on a page            | the access token expired and refresh failed (IdP down); retry                                                  |
| every page asks to sign in again                   | the session key changed, the IdP restarted (refresh tokens live in its memory) or the absolute lifetime passed |
| 403 `CSRF_ORIGIN_MISMATCH`                         | a POST from another origin, or a tool that sends no Origin                                                     |
| `UNKNOWN_OPERATION`                                | the API snapshot lacks the operation: `pnpm api:sync`                                                          |
| e2e preflight: document differs                    | the running monolith is not the snapshot's commit: `pnpm api:sync` or check it out                             |
| CSP errors in the console in dev                   | dev allows `unsafe-eval` and inline styles; check a production build (`pnpm start`)                            |

The dev server also offers Next's MCP endpoint (`/_next/mcp`) with build and runtime errors.
