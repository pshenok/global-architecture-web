---

name: gaw-forms-and-actions
description: Forms and Server Actions in global-architecture-web - defineAction (access, zod input, API field maps, message maps, successCodes, outcomes), the plain form recipe with useActionState and echoed values, field errors and the single alert, optimistic updates, ConfirmDialog for destructive actions, and what never to do in an action. Use it whenever you add or change a form, a mutation, a Server Action, error messages for API codes, or see check-access S4.
---

# Forms and Server Actions

## defineAction

```ts
// src/features/houses/actions.ts
'use server';
import { defineAction } from '@/platform/actions';

export const createHouse = defineAction({
  access: 'user', // 'identity' (signed in, maybe unregistered) | 'user' | 'admin'
  input: HouseForm, // zod, field by field as posted
  fields: HOUSE_API_FIELDS, // API errors[].field (dotted) -> form field
  messages: HOUSE_MESSAGES, // code -> message, or { field, message }
  successCodes: [], // codes that mean "already done" here: the page refreshes
  run: async ({ caller, me, requestId }, input) => {
    const result = await houses.createHouse(caller, toCreateHouseBody(input));
    return result.ok ? { kind: 'redirect', to: `/houses/${result.value.id}` } : result;
  },
});
```

The wrapper: session (none -> `SESSION_EXPIRED` with a sign-in link; expired and not
renewed -> `IDP_UNAVAILABLE`), user for `user`/`admin` (`USER_NOT_REGISTERED` ->
`/register`), parse (field errors, values echoed), run, map problems, then the outcome
outside every try block:

| Outcome                                 | Effect                                                      |
| --------------------------------------- | ----------------------------------------------------------- |
| `{ kind: 'done', message? }`            | success state                                               |
| `{ kind: 'refresh', message?, shell? }` | re-render this page (`refresh()`)                           |
| `{ kind: 'redirect', to, shell? }`      | same-site path only                                         |
| `{ kind: 'logout' }`                    | clear the session, leave through the provider's end-session |

`shell: 'stale'` when the action changed who the user is (registration, a rename): the
root layout re-renders, so the header shows it.

A delete whose resource is already gone (another tab deleted it) goes where a successful
delete goes, in `run` (`result.ok || gone ? { kind: 'redirect', ... }`): a refresh would
land on a page that no longer exists.

Rules (check-access S4): only `export const x = defineAction({ access: '<literal>', ... })`
in `actions.ts`, with `defineAction` imported by name from `@/platform/actions` (never
declared, wrapped or renamed); no inline `'use server'`, wherever it sits in a directive
prologue; `actions.ts` imports no `next/navigation`,
`next/cache`, `next/headers` or `@/platform/api`. Handlers return outcomes; they never
call `redirect()`. A thrown error becomes a generic message with the request id.

## Problem mapping

`VALIDATION_FAILED` errors go to fields through `fields` (or same-named fields); the rest
join the summary. `messages` names business codes; `{ field, message }` puts the message
under a field (`BOOKING_DATES_UNAVAILABLE` under check-in), a function reads metadata
(`maxGuests`). 401 -> sign in again; timeouts on writes -> "could not confirm, refresh
before retrying"; unknown codes -> a message for their status family (4xx shows the
API's `detail`, 5xx never does).

## The form

```tsx
'use client';
const [state, formAction] = useActionState<FormState<Field>, FormData>(action, IDLE);
const form = useRef<HTMLFormElement>(null);
useFocusFirstInvalid(form, state);
const errors = state.status === 'error' ? state.fieldErrors : {};
const value = (f: Field) => (state.status === 'error' ? state.values[f] : undefined) ?? initial[f] ?? '';
return (
  <form ref={form} action={formAction} className="grid gap-5">
    <FormAlert state={state} />
    <TextField name="title" label="Title" required maxLength={200} defaultValue={value('title')} error={errors.title} />
    <SubmitButton>Save</SubmitButton>
  </form>
);
```

- The action arrives as a prop from the server view (client files import no server code).
- Uncontrolled inputs with `defaultValue` from the echoed values: React resets a form after
  an action.
- Native constraints mirror the zod schema; the server parse is the authority.
- One `FormAlert` (role alert / status) per form; field errors sit under fields without a
  role; focus goes to the first invalid field.
- Destructive actions: `ConfirmDialog` (AlertDialog; its confirm button submits a form).
- Optimistic UI only where it pays (the booking status): `useOptimistic` inside the action
  wrapper, and show the settled result (`role=status`).
