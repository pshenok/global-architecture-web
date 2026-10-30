import 'server-only';
import { z } from 'zod';

/**
 * What the sealed session cookie holds. Tokens live only here and on the server; the
 * platform user id and roles are never stored (GET /v1/users/me answers them per request).
 */
export const SessionV1 = z
  .object({
    v: z.literal(1),
    /** The issuer and subject of the login (OIDC `iss`, `sub`). */
    iss: z.string().min(1),
    sub: z.string().min(1).max(255),
    sid: z.string().max(255).optional(),
    /** Access token, its expiry (receipt time + expires_in, epoch s) and its lifetime. */
    at: z.string().min(1).max(8192),
    atExp: z.number().int(),
    atLife: z.number().int().positive(),
    rt: z.string().min(1).max(4096).optional(),
    /** ID token, kept for id_token_hint at logout. */
    idt: z.string().max(4096).optional(),
    email: z.string().max(320).optional(),
    /** Login time (epoch s), kept across refreshes: the absolute lifetime counts from it. */
    createdAt: z.number().int(),
  })
  .strict();

export type Session = z.output<typeof SessionV1>;

/** The short-lived login transaction (state, nonce, PKCE verifier) between login and callback. */
export const LoginTransaction = z
  .object({
    state: z.string().min(1),
    nonce: z.string().min(1),
    verifier: z.string().min(43).max(128),
    returnTo: z.string().startsWith('/'),
    createdAt: z.number().int(),
  })
  .strict();

export type LoginTransaction = z.output<typeof LoginTransaction>;
