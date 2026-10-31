import 'server-only';
import type { Route } from 'next';
import { refresh, revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import type { FormState } from '@/kernel/form-state';
import { localPath } from '@/kernel/local-path';
import type { ApiProblem, ProblemCode } from '@/kernel/problem-codes';
import type { ApiResult } from '@/platform/api/call';
import { endSessionUrl } from '@/platform/auth/end-session';
import { requestId } from '@/platform/http/request-context';
import { log } from '@/platform/observability/log';
import { type Caller, mintCaller } from '@/platform/session/caller';
import { fetchMe, type Me } from '@/platform/session/current-user';
import { isExpired, nowSeconds } from '@/platform/session/policy';
import { getSession } from '@/platform/session/read';
import { clearSession } from '@/platform/session/write';

/**
 * Every Server Action is `export const x = defineAction({...})` in a feature's
 * actions.ts (check-access S4): Server Actions are public POST endpoints, so each one
 * authenticates, validates its input and maps API problems the same way. Handlers return
 * an outcome; redirects and refreshes happen here, outside every try block.
 *
 * - identity: a session (a login that may not be registered yet: /register)
 * - user: a session; the API decides what the user may do
 * - admin: a session of a user with the admin role (the API checks it too)
 */
export type Access = 'identity' | 'user' | 'admin';

export interface ActionContext {
  readonly caller: Caller;
  /** The user (null for `identity` actions, which run before registration). */
  readonly me: Me | null;
  readonly requestId: string;
}

export type ActionOutcome =
  | { readonly kind: 'done'; readonly message?: string }
  | { readonly kind: 'refresh'; readonly message?: string; readonly shell?: 'stale' }
  /** shell: 'stale' when the action changed who the user is (registration, a rename). */
  | { readonly kind: 'redirect'; readonly to: string; readonly shell?: 'stale' }
  /** Ends the session and signs out at the IdP (account deletion). */
  | { readonly kind: 'logout' };

type Message = string | ((problem: ApiProblem) => string);

export interface ActionSpec<S extends z.ZodObject, F extends string> {
  readonly access: Access;
  readonly input: S;
  /** API field (dotted, from errors[].field) -> form field. */
  readonly fields?: Readonly<Record<string, F>>;
  /** Business codes -> message; with a field, the message shows under that field. */
  readonly messages?: Readonly<
    // Known codes autocomplete; a feature's own module codes (SAMPLE_ITEM_...) are welcome.
    Partial<Record<ProblemCode, Message | { field: F; message: Message }>>
  >;
  /** Codes that mean the action already happened (a double submit). */
  readonly successCodes?: readonly ProblemCode[];
  readonly run: (
    context: ActionContext,
    input: z.output<S>,
  ) => Promise<ApiResult<ActionOutcome> | ActionOutcome>;
}

const GENERIC: Readonly<Record<string, string>> = {
  SESSION_EXPIRED: 'Your session has ended. Sign in again to continue.',
  IDP_UNAVAILABLE: 'The sign-in service is unavailable. Try again in a moment.',
  UPSTREAM_TIMEOUT: 'We could not confirm the change. Refresh the page before trying again.',
  REQUEST_TIMEOUT: 'We could not confirm the change. Refresh the page before trying again.',
  UPSTREAM_UNAVAILABLE: 'The service is unavailable. Try again in a moment.',
  TRANSACTION_CONFLICT: 'Something changed at the same time. Try again.',
  TOO_MANY_REQUESTS: 'Too many requests. Wait a moment and try again.',
  VALIDATION_FAILED: 'Check the highlighted fields.',
  NOT_FOUND: 'This no longer exists.',
};

const familyMessage = (status: number) =>
  status >= 500
    ? 'Something went wrong on our side. Try again in a moment.'
    : status === 404 || status === 403
      ? 'This no longer exists, or you cannot change it.'
      : 'The request could not be completed.';

const FORM_KEYS = /^\$ACTION_/;

function formValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form) {
    if (!FORM_KEYS.test(key) && typeof value === 'string') values[key] = value;
  }
  return values;
}

type Decision<F extends string> =
  | { readonly kind: 'state'; readonly state: FormState<F> }
  | { readonly kind: 'outcome'; readonly outcome: ActionOutcome };

export function defineAction<S extends z.ZodObject, F extends Extract<keyof z.input<S>, string>>(
  spec: ActionSpec<S, F>,
): (previous: FormState<F>, form: FormData) => Promise<FormState<F>> {
  const fail = (
    message: string,
    values: Partial<Record<F, string>>,
    extra: {
      fieldErrors?: Partial<Record<F, string>>;
      code?: string;
      signIn?: boolean;
      requestId?: string;
    } = {},
  ): Decision<F> => ({
    kind: 'state',
    state: {
      status: 'error',
      message,
      fieldErrors: extra.fieldErrors ?? ({} as Partial<Record<F, string>>),
      values,
      ...(extra.code ? { code: extra.code } : {}),
      ...(extra.signIn ? { signIn: true } : {}),
      ...(extra.requestId ? { requestId: extra.requestId } : {}),
    },
  });

  const fromProblem = (problem: ApiProblem, values: Partial<Record<F, string>>): Decision<F> => {
    if (spec.successCodes?.includes(problem.code)) {
      return { kind: 'outcome', outcome: { kind: 'refresh' } };
    }
    if (problem.code === 'USER_NOT_REGISTERED') {
      return { kind: 'outcome', outcome: { kind: 'redirect', to: '/register' } };
    }
    if (problem.status === 401) {
      return fail(GENERIC.SESSION_EXPIRED as string, values, {
        code: 'SESSION_EXPIRED',
        signIn: true,
      });
    }
    const extra = {
      code: problem.code,
      ...(problem.requestId ? { requestId: problem.requestId } : {}),
    };
    if (problem.code === 'VALIDATION_FAILED' && problem.fieldErrors.length > 0) {
      const fieldErrors: Partial<Record<F, string>> = {};
      const unmapped: string[] = [];
      for (const { field, description } of problem.fieldErrors) {
        const target =
          spec.fields?.[field] ?? (field in spec.input.shape ? (field as F) : undefined);
        if (target) fieldErrors[target] ??= description;
        else unmapped.push(`${field} ${description}`);
      }
      const summary =
        unmapped.length > 0
          ? `${GENERIC.VALIDATION_FAILED} ${unmapped.join('; ')}`
          : GENERIC.VALIDATION_FAILED;
      return fail(summary as string, values, { ...extra, fieldErrors });
    }
    const configured = spec.messages?.[problem.code];
    if (configured) {
      const bound = typeof configured === 'object' ? configured : undefined;
      const message = bound ? bound.message : (configured as Message);
      const text = typeof message === 'function' ? message(problem) : message;
      const fieldErrors: Partial<Record<F, string>> = {};
      if (bound) fieldErrors[bound.field] = text;
      return fail(text, values, { ...extra, fieldErrors });
    }
    const generic = GENERIC[problem.code];
    const detail = problem.status < 500 && problem.origin === 'api' ? problem.detail : undefined;
    return fail(generic ?? detail ?? familyMessage(problem.status), values, extra);
  };

  async function decide(form: FormData): Promise<Decision<F>> {
    const raw = formValues(form);
    const values = raw as Partial<Record<F, string>>;
    const session = await getSession();
    if (!session)
      return fail(GENERIC.SESSION_EXPIRED as string, values, {
        code: 'SESSION_EXPIRED',
        signIn: true,
      });
    if (isExpired(session, nowSeconds()))
      return fail(GENERIC.IDP_UNAVAILABLE as string, values, { code: 'IDP_UNAVAILABLE' });
    const caller = mintCaller(session);

    let me: Me | null = null;
    if (spec.access !== 'identity') {
      const result = await fetchMe(caller);
      if (!result.ok) return fromProblem(result.problem, values);
      me = result.value;
      if (spec.access === 'admin' && !me.roles.includes('admin')) {
        return fail(familyMessage(403), values, { code: 'ADMIN_ROLE_REQUIRED' });
      }
    }

    const parsed = spec.input.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<F, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') fieldErrors[field as F] ??= issue.message;
      }
      return fail(GENERIC.VALIDATION_FAILED as string, values, {
        code: 'VALIDATION_FAILED',
        fieldErrors,
      });
    }

    const id = await requestId();
    let result: ApiResult<ActionOutcome> | ActionOutcome;
    try {
      result = await spec.run({ caller, me, requestId: id }, parsed.data);
    } catch (error) {
      log.error('action failed', {
        requestId: id,
        reason: error instanceof Error ? error.name : 'unknown',
      });
      return fail(familyMessage(500), values, { requestId: id });
    }
    if ('ok' in result)
      return result.ok
        ? { kind: 'outcome', outcome: result.value }
        : fromProblem(result.problem, values);
    return { kind: 'outcome', outcome: result };
  }

  return async (_previous, form) => {
    const decision = await decide(form);
    if (decision.kind === 'state') return decision.state;
    // Interrupts and refreshes run here, outside every try block.
    const { outcome } = decision;
    // Layouts keep their render across navigations; the shell shows the user, so an
    // identity change re-renders from the root layout down.
    if ((outcome.kind === 'refresh' || outcome.kind === 'redirect') && outcome.shell === 'stale') {
      revalidatePath('/', 'layout');
    }
    switch (outcome.kind) {
      case 'done':
        return { status: 'success', ...(outcome.message ? { message: outcome.message } : {}) };
      case 'refresh':
        refresh();
        return { status: 'success', ...(outcome.message ? { message: outcome.message } : {}) };
      case 'redirect': {
        // Same-site paths only: an action never sends anyone elsewhere (logout has its own path).
        const path = localPath(outcome.to);
        if (path === undefined)
          throw new Error('defineAction: redirect outcomes take a same-site path');
        return redirect(path as Route);
      }
      case 'logout': {
        const session = await getSession();
        clearSession(await cookies());
        return redirect((await endSessionUrl(session)) as Route);
      }
    }
  };
}
