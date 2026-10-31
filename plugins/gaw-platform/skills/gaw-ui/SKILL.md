---

name: gaw-ui
description: The UI system of global-architecture-web - shadcn on Base UI (base-nova) owned in src/ui/primitives, composites (AppShell, PageHeader, fields, FormAlert, SubmitButton, ConfirmDialog, Pager, EmptyState, MoneyText, StayDates, StatusBadge), design tokens and system dark mode, Base UI idioms (render, not asChild), lucide icons and no emoji, money and date formatting, motion, and accessibility gates. Use it whenever you build or change a component or a screen, add a shadcn primitive, style anything, or format money or dates.
---

# UI system

## Layers

`src/ui/primitives` (shadcn, owned) -> `src/ui` composites -> a feature's `ui/` -> pages.
Feature components are synchronous (R5): views fetch, components render.

## Primitives

- Add with `pnpm ui:add <name>` (`shadcn@4.23.0` through `pnpm dlx`, `--diff`). shadcn is
  never a dependency. After adding: check `package.json` (re-pin anything written as a
  range), run `pnpm check`.
- They are ours: edit them, with a `// Modified: <why>` comment (`FieldError` has no
  `role=alert`: the form's single alert announces errors).
- Base UI idioms: `render={<Button variant="outline" />}`, never `asChild`. A link styled as
  a button is `LinkButton` (`buttonVariants` on `next/link`), never a button wrapping a link.

## Composites

| Composite                                   | Use                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `AppShell`, `Navigation`                    | the frame (skip link, header, `main#main`), the nav with `aria-current`   |
| `PageHeader`                                | the page's single h1, description, actions                                |
| `TextField`, `TextareaField`, `SelectField` | label, input, hint and error wired (`aria-invalid`, `aria-describedby`)   |
| `FormAlert`                                 | the form's one live region: `role=alert` (error), `role=status` (success) |
| `SubmitButton`                              | pending state, stays focusable                                            |
| `ConfirmDialog`                             | destructive actions through an AlertDialog that submits a form            |
| `Pager`, `EmptyState`                       | paging, empty lists                                                       |
| `MoneyText`, `StayDates`, `StatusBadge`     | money, stays, booking status                                              |

## Tokens and theme

- Semantic tokens only in features (`bg-primary`, `text-muted-foreground`,
  `text-destructive`, `bg-success`); check-text refuses raw palette classes.
- Dark mode follows the system with no JavaScript: dark tokens under
  `@media (prefers-color-scheme: dark)`, `color-scheme: light dark`. No theme toggle (it
  would need a cookie read in the root layout, never an inline script).
- New app tokens go in `globals.css` the shadcn way (`--name`, `--name-foreground`,
  `--color-name` in `@theme inline`), checked for contrast by the axe tests in both schemes.

## Icons, text, motion

- lucide-react only; decorative icons `aria-hidden="true"`; icon-only buttons need
  `aria-label`. No emoji anywhere (check-text).
- CSS motion only, short; a global reduced-motion rule drops durations to 1 ms.

## Money and dates (src/kernel)

- `formatMoney({ currencyCode, amountMinor }, locale)`: minor units, ISO 4217 exponents,
  no floats. `toAmountMinor(text, currency)` parses what people type.
- Calendar dates are `YYYY-MM-DD` in UTC: `todayUtc()`, `addDays`, `nightsBetween`,
  `formatStay`. Instants: `formatInstant`. Always pass a locale (`DEFAULT_LOCALE`).
- Date inputs are native `<input type="date">` with `min` from the server's `todayUtc()`.

## Accessibility gates

One h1, landmarks, a skip link, a label on every field, AlertDialog for destructive
actions, visible focus. axe (WCAG 2.2 AA) runs in component tests (Chromium, real CSS,
light and dark) and on every page in e2e; a keyboard-only booking journey is tested.
