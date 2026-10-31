# ADR-0001: Platform stack

- Status: Accepted
- Date: 2026-10-30
- Derived from: ADR-0001 of `global-architecture-monolith`

## Context

`global-architecture-web` is the web frontend of `global-architecture-monolith`. The owner has locked four decisions:
- Next.js App Router as a BFF, with tokens only on the server.
- A full client of the monolith, built to the monolith's engineering level.
- shadcn/ui on Tailwind CSS 4, with lucide icons and no emoji.
- A public repository, `pshenok/global-architecture-web`.

Standing rules also apply:
- Use the same toolchain family as the monolith where it fits.
- Apply Clean Architecture thinking.
- Do not over-engineer.
- Verify every package and API in the version used.
- Security and tests are gates.

The 2026 ecosystem constrains the choice in four ways:
- TypeScript 7.0 ships no compiler API.
- typescript-eslint caps its TypeScript peer below 6.1.
- Next 16.4.3 type-checks by spawning the project `tsc` (`useTypeScriptCli` defaults to true), so TS 7 works with `next build`.
- Next's CI tests Node 20, 22 and 24, not 26.

## Decision

| Area             | Choice                                                                                                                                                                                                                          | Why                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime          | Node `^26.12.1` and pnpm `^12.16.1` through `devEngines` (`onFail: download`)                                                                                                                                                   | Same as the monolith. pnpm 12.16.1 is the version on which codegen isolation was verified. The monolith moves to 12.16.1 in the same change.                                                               |
| Framework        | next 16.4.3, react and react-dom 19.3.1                                                                                                                                                                                         | Locked decision. Turbopack and the Node-runtime proxy are defaults. Output is `standalone`.                                                                                                                |
| Types            | typescript 7.0.2, strict flags as in the monolith                                                                                                                                                                               | `next build` runs the project tsc. tsconfig is pre-written with the values Next enforces.                                                                                                                  |
| OIDC and session | openid-client 6.8.8, jose 6.2.13                                                                                                                                                                                                | A certified RP. jose is already in the tree and pinned in the monolith catalog (ADR-0003).                                                                                                                 |
| API              | openapi-fetch 0.17.0; openapi-typescript 7.13.0 isolated in `tools/api-codegen` on `@typescript/typescript6@6.0.2`                                                                                                              | Types-only codegen (ADR-0004).                                                                                                                                                                             |
| UI               | @base-ui/react 1.9.0, class-variance-authority 0.7.1, cn and lucide-react at the newest versions past the 24 h gate on bootstrap day (0.5.0 and 1.64.0 today), tailwindcss and @tailwindcss/postcss 4.3.3, tw-animate-css 1.4.0 | ADR-0005.                                                                                                                                                                                                  |
| Validation       | zod 4.6.7                                                                                                                                                                                                                       | Same as the monolith.                                                                                                                                                                                      |
| Lint and format  | Biome 2.6.2 + oxlint 1.89.0 with oxlint-tsgolint 7.0.2004 (the monolith pins), plus knip 6.44.0                                                                                                                                 | No ESLint, because typescript-eslint does not support TS 7. oxlint 1.89 already ships the React Compiler-based rules and the nextjs rules.                                                                 |
| Tests            | vitest 5.0.5, vite 8.3.5, @vitest/browser-playwright 5.0.5, vitest-browser-react 2.3.0, @vitest/coverage-v8 5.0.5, msw 3.0.3, axe-core and @axe-core/playwright 4.14.0, playwright and @playwright/test 1.64.1                  | ADR-0007.                                                                                                                                                                                                  |
| Supply chain     | `minimumReleaseAge: 1440`, `blockExoticSubdeps`, `strictDepBuilds` with an empty `allowBuilds`, `engineStrict`, `savePrefix: ''`, exact pins                                                                                    | Same policy as the monolith.                                                                                                                                                                               |
| React Compiler   | off                                                                                                                                                                                                                             | The code that is tested is the code that runs, and there is no Babel in the build. A server-rendered CRUD app has no measurable need for it. The oxlint compiler-based rules keep the code compiler-ready. |

Deliberate divergences from the monolith:
- One app package, so there is no Turborepo and no pnpm catalog. Exact pins live in package.json, and a nightly job compares the shared tool versions with the monolith catalog.
- Imports inside `src/` are extensionless `@/...` (bundler resolution, which is what shadcn generates). `tools/` keeps the `.ts` suffix rule.
- E2E runs on Playwright, because a browser is required.
- knip is added.
- No PM2: the web is a single process, and Playwright starts it.
- AGENTS.md is the canonical agent file (Next manages a block in it), and CLAUDE.md imports it.
- tsconfig includes `.next/types` but not `.next/dev/types`: with `next dev` running, both hold the same typed-route declarations, and the duplicate namespaces broke `Link` hrefs. The typecheck script runs `next typegen` first.
- GitHub Actions are pinned by SHA.
- A minimal JSON logger with a field allowlist replaces pino.

Rejected:
- next-auth, because v4 is in maintenance and v5 is a beta with a fail-open advisory.
- better-auth, because it would be a second user system of record.
- iron-session, because jose already covers the need.
- ESLint, eslint-config-next and eslint-plugin-boundaries, because typescript-eslint does not support TS 7.
- dependency-cruiser, because it supports only TS below 7.
- @hey-api/openapi-ts, because it crashes on TS 7 and has an advisory.
- orval, because of its generated-code RCE advisories. It stays as the documented fallback.
- TanStack Query, nuqs, form libraries, next-themes, sonner, motion, react-day-picker (v1), pm2, turbo, Testing Library, jsdom and radix-ui.
- shadcn as a dependency. It runs through `pnpm dlx shadcn@4.23.0` because its CLI tree is heavy.

Update policy:
- Pin the newest version that has cleared the 24 h gate, verified with `npm view`.
- Bump Biome, oxlint, TypeScript, Vitest, zod, jose and @types/node together with the monolith.

## Consequences

- Both repositories share one toolchain, one supply-chain policy and the same review habits. Drift is detected nightly.
- TypeScript 7 costs Next's IDE plugin diagnostics and requires a second TypeScript, used only by codegen, in one private package.
- Node 26 is validated by this repository's CI, not by Next. Dev, build, the standalone server and every test run on Node 26.13 without a workaround.
- Every dependency has a recorded reason. Adding one requires an ADR update and a check that the version exists and has cleared the gate.
