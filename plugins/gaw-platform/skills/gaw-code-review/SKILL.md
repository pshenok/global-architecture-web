---

name: gaw-code-review
description: Review checklist for global-architecture-web changes - tokens and the client boundary, Server Actions, the proxy and public routes, caching, API ownership and the contract, error mapping, UI tokens and accessibility, tests at the right level, pins and docs. Use it whenever reviewing a pull request or a diff in this repository, before committing a change, or when asked whether a change is safe.
---

# Code review

Run `pnpm check` first: the guardrails catch most structural problems. Then read for what
they cannot see.

## Security (G1-G18, docs/architecture/threat-model.md)

- [ ] No token, session, cookie value or raw API response with private data reaches a
  client component's props, a log line, a URL or the browser's storage.
- [ ] New server files start with `import 'server-only'`; `'use client'` files import no
  server code; actions reach client components as props.
- [ ] Mutations are `defineAction` exports with the narrowest `access`; handlers return
  outcomes; redirects are same-site paths.
- [ ] No change to `security/public-routes.json`, the proxy matcher, route handlers,
  `next.config.ts` headers or the CSP without a stated reason (CODEOWNERS).
- [ ] Access checks in the web are UX only; the API decides (and is tested to).
- [ ] No caching across requests, no segment config, no `NEXT_PUBLIC_`.
- [ ] Cookies removed with `expireCookie`.

## Data

- [ ] API calls only in the feature's `data/`, on its own `apiPaths`; public operations
  with `anonymous()`.
- [ ] Generated files untouched; a contract change came through `pnpm api:sync` from a
  clean monolith commit (`source.json` not dirty).
- [ ] Problems branch on `code`; new monolith reason codes added to
  `src/kernel/problem-codes.ts` or the feature's messages.
- [ ] A detail page's lookup runs before streaming (no `loading.tsx` above it).

## UI

- [ ] Design tokens only; lucide icons with `aria-hidden` or a label; no emoji.
- [ ] One h1, a unique title, labels on fields, `FormAlert` once, AlertDialog for deletes.
- [ ] Forms echo values and work without JavaScript (plain `<form action>`).

## Tests

- [ ] Logic in `model/` and `platform/` has unit tests; gateways and actions have MSW tests
  (the five problem tests per feature); components have browser tests with axe.
- [ ] User journeys and access rules have e2e (the five access tests per feature).
- [ ] A new guardrail rule has a probe that fails without it.
- [ ] The coverage ratchet did not go down.

## Hygiene

- [ ] New dependencies: exact pin, verified on npm, older than 24 h, a reason in ADR-0001.
- [ ] Docs, skills and ADRs agree with the change (a rule that changed is changed everywhere).
- [ ] Commit messages in English.
