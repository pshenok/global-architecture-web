# ADR-0005: UI system

- Status: Accepted
- Date: 2026-10-30

## Context

The owner locked shadcn/ui on Tailwind CSS 4, with vector icons only (lucide) and never emoji.

The state of the ecosystem shapes the choices:
- shadcn 4.23.0 defaults to Base UI (1.9.0) since 2026-07. Its `init --defaults` produces the `base-nova` style.
- Generated components import `cn` from the npm package `cn`, which is pre-1.0. A different author owned that name in 2013 (versions below 0.2.0).
- next-themes 0.4.6 is unmaintained and renders an inline script, which a nonce CSP would have to allow.
- tw-animate-css ignores `prefers-reduced-motion`.
- The next@16.4.3 bundled docs install Tailwind through `@tailwindcss/postcss`, and Vite reads the same PostCSS config.

Forms must work with Server Actions and before hydration.

## Decision

- **Base and style.** shadcn 4.23.0 with Base UI and the `base-nova` style (lucide, Geist, neutral, CSS variables).
  - The CLI runs only as `pnpm dlx shadcn@4.23.0` (`ui:add` passes `--diff`). It is never a dependency.
  - The shadcn Tailwind variants are inlined into `globals.css` (what `shadcn eject` does) and owned; `components.json` points the CLI at `src/ui`.
  - Generated files live in `src/ui/primitives`. They are ours, and every edit carries `// Modified: <why>`.
  - Composites live in `src/ui`.
  - `cn` and lucide-react are pinned exactly to the newest version that has cleared the 24 h gate. `cn` below 0.2.0 is never accepted.
- **Base UI idioms.** Use `render`, not `asChild`. Links are styled with `buttonVariants()` on `next/link`, never rendered through Button.
- **Tailwind.** `tailwindcss` with `@tailwindcss/postcss` 4.3.3 through `postcss.config.mjs`, one pipeline for Next and Vitest. Biome uses `css.parser.tailwindDirectives`.
- **Tokens.**
  - oklch tokens in `:root`, mapped in `@theme inline`.
  - App tokens such as `--success` and `--warning` are added the shadcn way.
  - Features use semantic tokens only. `check-text` refuses raw palette classes.
  - `--destructive` is darker than shadcn's default in light mode and lighter in dark mode: axe measured the defaults below 4.5:1 on cards and popovers.
- **Dark mode.** Follows the system with zero JavaScript:
  - remove the `.dark` custom variant;
  - put the dark tokens under `@media (prefers-color-scheme: dark)`;
  - set `color-scheme: light dark`.
  - No next-themes. A future toggle would be a cookie read in the root layout.
- **Forms.** A plain `<form action>` with `useActionState` and the feature's zod schema. No form library.
  - Native constraints mirror the schema.
  - Values are echoed into `defaultValue`.
  - One `role=alert` summary, with focus moved to the first invalid field.
  - `SubmitButton` uses `focusableWhenDisabled`.
- **Dates and money.**
  - Booking dates are native `<input type="date">`: `YYYY-MM-DD`, `min` = UTC today computed on the server. Range rules and availability stay server-side.
  - Money uses an explicit ISO 4217 exponent table with integer string math.
  - Dates use `Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).formatRange`.
  - Formatters always take a locale and run on the server.
- **No toasts in v1.** Inline `role=status` and `role=alert` messages and the optimistic status badge are enough.
- **Motion.** CSS only, 200 ms or less, with a global reduced-motion override set to 1 ms. No `motion` package, no route transitions.
- **Accessibility gates.**
  - Every page has a unique title, one h1, landmarks and a skip link.
  - Icon-only buttons need `aria-label`.
  - Destructive actions use AlertDialog.
  - axe (WCAG 2.0, 2.1 and 2.2 AA) runs in component tests in Chromium with real CSS, and on every page in e2e in light and dark.
  - A keyboard-only booking journey is tested.
  - `check-text` refuses emoji.
- **i18n readiness.** `DEFAULT_LOCALE`, `<html lang>`, messages keyed by problem code, no sentence concatenation, logical spacing classes.

## Consequences

- The UI follows upstream shadcn with the fewest possible packages. There is no inline script, so the CSP stays strict.
- Updates to ejected CSS and to components are manual, reviewed with `--diff`, and pins must be re-checked after every `ui:add`.
- There is no in-app theme toggle. The date fields look plainer than a range calendar and cannot grey out booked dates. Upgrade path: shadcn Calendar with react-day-picker 10.0.2 once the API exposes availability, and the Base UI toast when an in-place outcome needs one.
- `cn` is pre-1.0 and churns quickly. Exact pins and the publish-age gate contain the risk.
