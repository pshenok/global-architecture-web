---

name: gaw-pages-and-routing
description: Pages and routes in global-architecture-web - thin route files in src/app that compose feature views, typed routes, metadata titles, the deny-by-default proxy and security/public-routes.json, real 404s (no loading.tsx above dynamic pages), error.tsx and not-found.tsx, route handlers (only auth and healthz), and the app shell. Use it whenever you add or move a page, make a page public, add metadata, change error pages, or see check-access S1, S2, S5 or S6.
---

# Pages and routing

## A route file only composes

```tsx
// src/app/houses/[id]/page.tsx
import { BookingPanelView } from '@/features/bookings/server';
import { houseDetailMetadata, HouseDetailView } from '@/features/houses/server';

export const generateMetadata = (props: PageProps<'/houses/[id]'>) =>
  houseDetailMetadata(props.params);

export default function Page(props: PageProps<'/houses/[id]'>) {
  return (
    <>
      <HouseDetailView params={props.params} />
      <BookingPanelView params={props.params} />
    </>
  );
}
```

- Pass `params`/`searchParams` promises down; views await them.
- Every page has a unique title (`metadata` or `generateMetadata`; the layout's template
  adds " · Global Architecture") and exactly one h1 (`PageHeader`).
- No segment config exports (`dynamic`, `revalidate`, `runtime`...): every route renders per
  request because the root layout calls `connection()` (the CSP nonce). check-access S5.
- `typedRoutes` is on: static hrefs are checked; dynamic ones are `` `/houses/${id}` `` or,
  for nested dynamic paths, `` `/houses/${id}/edit` as Route ``.

## Public or not

Deny by default: the proxy sends any page GET without a session to `/auth/login?returnTo=`
unless the route is in `security/public-routes.json` (patterns match segment by segment;
`[id:uuid]` matches a UUID only). Today public: the house catalogue and house pages, the
auth endpoints, `/auth/error`, `/healthz`. Unknown paths need a session too.

To make a page public: add `{ "route": "/x/[id:uuid]", "reason": "..." }` (CODEOWNERS
reviews it); check-access S1 checks every entry exists; the public-routes unit test
classifies every route in `src/app`. A public page must work signed out: use
`getOptionalUser()`, gateways with `anonymous()`.

## Status codes

A page's lookup runs before anything streams, so `notFound()` answers 404. Never add a
`loading.tsx` in or above a segment with a dynamic page (check-access S6): it streams a 200
first. List pages may have one.

## Error pages

- `src/app/error.tsx`: unexpected errors (an upstream failure, the sign-in service down
  while renewing a session): a generic message with the digest and a retry.
- `src/app/not-found.tsx`: what `notFound()` renders (unknown, foreign or forbidden).
- `src/app/global-error.tsx`: the root layout itself failed.
- `src/app/auth/error/page.tsx`: sign-in failures by code; the provider's text is never shown.

## Route handlers

Only `auth/login` (GET), `auth/callback` (GET), `auth/logout` (POST) and `healthz` (GET),
each one line into `@/platform/auth` or `@/platform/health` (check-access S2). Everything
else is a page or a Server Action. Unsafe-method handlers re-check the Origin.

## The shell

`src/app/layout.tsx` -> `_shell/shell.tsx`: `AppShell` (skip link, header, `main#main`),
navigation from every feature's `nav` filtered by audience, and the user slot (menu, "Finish
sign-up" or "Sign in"). Layouts do not re-render on navigation: an action that changes who
the user is returns `shell: 'stale'` (gaw-forms-and-actions). Links to `/auth/login` are
plain `<a>`, never `next/link` (nothing may prefetch the login route).
