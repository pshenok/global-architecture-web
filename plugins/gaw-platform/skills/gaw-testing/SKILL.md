---

name: gaw-testing
description: Testing global-architecture-web at every level - Vitest unit tests on Node with MSW doubles of the API and IdP, the template project, component tests in real Chromium with axe in light and dark, the security core's coverage ratchet, Playwright e2e against the monolith's real stack with personas signed in through the dev IdP form, the security and accessibility suites, and the guardrails' probes. Use it whenever you write or fix a test, add a feature (its five problem and five access tests), see a flaky e2e, or wonder which level a behavior belongs to.
---

# Testing

| Level                 | Command                       | What                                                                          |
| --------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| unit (Node)           | `pnpm test` (project `unit`)  | kernel, models, platform security logic, gateways and actions against MSW     |
| template              | project `template`            | `templates/feature` in place against its own contract                         |
| components (Chromium) | project `browser`             | synchronous `ui/` components, real CSS, axe, light and dark                   |
| coverage              | `pnpm test:coverage`          | the security core's ratchet (raise it, never lower it)                        |
| static                | `pnpm lint`                   | Biome, check-access, check-boundaries, check-text (with probes), oxlint, knip |
| e2e                   | `pnpm build && pnpm test:e2e` | Playwright: the standalone build against the monolith's stack                 |

## Unit

- `tests/support/unit-setup.ts` sets a valid env (API `https://api.test`, IdP
  `https://idp.test`) and runs MSW with unhandled requests as errors.
- `mswServer.use(http.get(`${API}/v1/...`, () => HttpResponse.json(...)))`;
  `problemResponse(status, code, { errors, metadata })` for problems; `useIdp()` and
  `idpState` (tests/support/idp.ts) for a full OIDC provider; `sessionCookie()` and
  `testSession()` for sealed cookies; `testCaller(token)` for gateways.
- Mock only at the edges: `@/platform/http/request-context` (request id, path),
  `next/headers` (a cookie jar), `next/cache`. `server-only` is an empty module here.
- Interrupts: `redirect()`/`notFound()` throw errors with a `digest`
  (`NEXT_REDIRECT;...;<path>;...`, `NEXT_HTTP_ERROR_FALLBACK;404`); assert on it.

Every feature keeps the **five problem tests** in `actions.spec.ts`: VALIDATION_FAILED to
its field, a module code to its message, 401 to sign-in, USER_NOT_REGISTERED to
`/register`, an unknown code to a generic message without internals.

## Components

`render(<main><h1>...</h1><Component .../></main>)` from `vitest-browser-react`, then
`expect.element(screen.getByRole(...))`, and `await expectAccessible()`
(tests/support/axe.ts). Both color schemes run every test; contrast failures are real.
Pass fake actions as props (a function returning a `FormState`). For text, assert
`element().textContent` with `toContain` (the matcher compares whole text).

## E2E

- Preflight (`tests/e2e/global-setup.ts`): the monolith is ready, the dev IdP has the code
  flow, `gaw-web` is registered with the 9301 callback, and the live OpenAPI document equals
  the snapshot. It prints what to run when not.
- Personas (`personas.setup.ts`): host, guest, stranger, admin (granted through the
  monolith's role CLI), unregistered; each signs in through the dev IdP form. Use
  `as(browser, 'guest')`; for flows that change identity, sign in a fresh subject with
  `signIn(page, sub, { accessTtl, returnTo })`.
- Name data after `runId()` so runs never collide. 2 workers (the API's rate limit is per
  address).
- `page.getByRole('main').getByRole('alert')`: Next's route announcer is an alert too.
- Wait for an action's settled result (`role=status`) before navigating away.
- Never a login bypass or a mocked backend.

Every feature keeps the **five access tests** (its e2e file): anonymous signs in, a
stranger gets 404, an admin sees it, a stranger's list omits it, a login without a user
registers.

## Guardrail probes

`tests/probes/{boundaries,access}`: each file starts with `// as: <virtual path>`; a line
marked `// refused` must be refused and no other line may be. When you add a rule, add a
probe that fails without it. Probes are not formatted by Biome (the markers sit on lines).
