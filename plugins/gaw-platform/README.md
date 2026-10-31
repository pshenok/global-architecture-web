# gaw-platform (Claude Code plugin)

Skills that teach Claude Code (and developers) how to build on global-architecture-web.

| Skill                      | Use it for                                                                   |
| -------------------------- | ---------------------------------------------------------------------------- |
| `gaw-architecture`         | the map: layout, slices, the request, which skill to use                     |
| `gaw-new-feature`          | a new feature from the template, paired with the monolith's new module       |
| `gaw-feature-api`          | a feature's public entries, cross-feature reads, `dependsOn`                 |
| `gaw-data-access`          | gateways, the API client and guard, problems, paging, the contract           |
| `gaw-pages-and-routing`    | route files, public routes, status codes, error pages, the shell             |
| `gaw-forms-and-actions`    | `defineAction`, forms, problem mapping, optimistic updates                   |
| `gaw-auth-and-security`    | sessions, OIDC, the proxy, cookies, CSP, guarantees                          |
| `gaw-ui`                   | primitives and composites, tokens, dark mode, money and dates, accessibility |
| `gaw-testing`              | unit, components, coverage, e2e, probes                                      |
| `gaw-local-stack`          | run and debug against the monolith's stack                                   |
| `gaw-code-review`          | review checklist                                                             |
| `gaw-platform-maintenance` | upgrades, Next upgrades, the contract, guardrails, ADRs                      |

## Install

Inside this repository the skills load automatically (`.claude/skills` links to them).
To use them in another project:

```text
/plugin marketplace add pshenok/global-architecture-web
/plugin install gaw-platform@global-architecture-web
```
