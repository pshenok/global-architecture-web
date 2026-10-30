/**
 * What a Server Action returns to its form (useActionState). Field names are the form's
 * own (`F`), never the API's dotted paths.
 */
export type FormState<F extends string = string> =
  | { readonly status: 'idle' }
  | {
      readonly status: 'success';
      readonly message?: string;
    }
  | {
      readonly status: 'error';
      /** The summary for the form's single alert. */
      readonly message: string;
      readonly code?: string;
      readonly fieldErrors: Readonly<Partial<Record<F, string>>>;
      /** The submitted values, echoed so uncontrolled inputs keep them after the reset. */
      readonly values: Readonly<Partial<Record<F, string>>>;
      /** Offer a sign-in link (the session ended). */
      readonly signIn?: boolean;
      readonly requestId?: string;
    };

export const IDLE: FormState<never> = { status: 'idle' };
