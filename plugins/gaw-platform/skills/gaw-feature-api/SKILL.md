---

name: gaw-feature-api
description: What a global-architecture-web feature exposes and how features use each other - index.ts (client-safe) and server.ts (server-only) public entries, the nav entries, dependsOn in features.json, cross-feature reads through server.ts, and API path ownership. Use it when one feature needs another's data or components, when deciding what to export, when adding a feature dependency, or when check-boundaries reports R3, R4 or R8.
---

# A feature's public API

## Two entries

| Entry       | Imported as             | Holds                                                                                            | Never holds                   |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------- |
| `index.ts`  | `@/features/<f>`        | types, client-safe components (`UserMenu`), `nav: NavEntry[]`                                    | anything server-only, actions |
| `server.ts` | `@/features/<f>/server` | `import 'server-only'`; views, metadata functions, reads for other features (`findHouseSummary`) | client components             |

Everything else (`model/`, `data/`, `views/`, `ui/`, `actions.ts`) is private: another
feature or the app never deep-imports it (R3).

## Using another feature

1. Add the dependency in `features.json`: `"dependsOn": ["houses"]`. The graph must stay
   acyclic (check-boundaries reports a cycle).
2. Import its public entry: `import { findHouseSummary } from '@/features/houses/server'`
   in a view; `import type { HouseSummary } from '@/features/houses'` anywhere.
3. Never call the other feature's API paths from your gateways: each feature owns its
   `apiPaths` (R8). Ask the owner feature for a read in its `server.ts`.

Example: bookings shows the house's title. `houses/server.ts` exports
`findHouseSummary(id)` (cached per request, `null` when the house is gone), bookings
lists `houses` in `dependsOn` and calls it from its views.

## Cross-feature reads

- Return a small summary type (`HouseSummary`), not the full model.
- Wrap in React `cache()` with primitive arguments: one API call per request however many
  views ask.
- Decide what "missing" means for the caller: `findX` returns `null` (a booking outlives
  its house), `loadX` interrupts with a 404 (the page is about it).

## Composition in routes

The app's routes may compose any features' views (`src/app/houses/[id]/page.tsx` renders
`HouseDetailView` from houses and `BookingPanelView` from bookings). Prefer composing in
the route over one feature rendering another's views.

## Nav entries

`nav` in `index.ts`: `{ href, label, audience: 'everyone' | 'user' | 'admin' }`. The shell
(`src/app/_shell/nav.ts`) imports every feature's `nav`; check-boundaries refuses a
registered feature whose nav the shell does not import (R12).
