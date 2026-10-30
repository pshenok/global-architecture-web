import 'server-only';
import { z } from 'zod';

/**
 * The server's configuration, validated once, lazily (instrumentation.register calls
 * getEnv() at boot so a bad value stops the server). The only reader of process.env.
 * There are no NEXT_PUBLIC_ variables: nothing here ever reaches the browser.
 */

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const isLoopback = (url: URL) => LOOPBACK.has(url.hostname);
const DEV_CLIENT_SECRET = 'dev-insecure-gaw-web';
const RESERVED_AUTH_PARAMS = [
  'redirect_uri',
  'state',
  'nonce',
  'code_challenge',
  'code_challenge_method',
  'response_type',
  'client_id',
  'scope',
];

const origin = (rule: (url: URL) => boolean, message: string) =>
  z
    .url()
    .transform((value) => new URL(value))
    .refine(
      (url) => url.origin === url.href.replace(/\/$/, ''),
      'an origin only: no path, query or hash',
    )
    .refine(rule, message)
    .transform((url) => url.origin);

const SessionKey = z.object({
  kid: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
  key: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/, 'base64url of exactly 32 random bytes')
    .transform((value) => new Uint8Array(Buffer.from(value, 'base64url'))),
});

const Env = z
  .object({
    APP_ORIGIN: origin(
      (url) =>
        url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost'),
      'https://, or http://localhost:<port> in development',
    ),
    API_BASE_URL: origin(
      (url) => url.protocol === 'https:',
      'https:// only (the local stack serves https://localhost:9443)',
    ),
    OIDC_ISSUER: z.url().refine((value) => {
      const url = new URL(value);
      return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url));
    }, 'https://, or http:// on a loopback host'),
    OIDC_CLIENT_ID: z.string().min(1),
    OIDC_CLIENT_SECRET: z.string().min(1),
    OIDC_SCOPES: z
      .string()
      .default('openid email offline_access')
      .transform((value) => value.split(/\s+/).filter(Boolean))
      .refine((scopes) => scopes.includes('openid'), 'must include openid'),
    OIDC_AUTH_PARAMS: z
      .string()
      .default('{}')
      .transform((value, ctx) => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          ctx.addIssue({ code: 'custom', message: 'a JSON object' });
          return z.NEVER;
        }
      })
      .pipe(z.record(z.string(), z.string()))
      .refine(
        (params) => !Object.keys(params).some((key) => RESERVED_AUTH_PARAMS.includes(key)),
        `may not set ${RESERVED_AUTH_PARAMS.join(', ')}`,
      ),
    OIDC_EXTRA_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(z.array(origin((url) => url.protocol === 'https:', 'https:// origins only'))),
    SESSION_KEYS: z
      .string()
      .transform((value, ctx) => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          ctx.addIssue({ code: 'custom', message: 'a JSON array of { kid, key }' });
          return z.NEVER;
        }
      })
      .pipe(z.array(SessionKey).min(1))
      .refine(
        (keys) => new Set(keys.map((k) => k.kid)).size === keys.length,
        'kids must be unique',
      ),
    SESSION_MAX_AGE_S: z.coerce.number().int().min(300).max(604_800).default(28_800),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  })
  .refine(
    (env) =>
      env.OIDC_CLIENT_SECRET !== DEV_CLIENT_SECRET ||
      new URL(env.APP_ORIGIN).hostname === 'localhost',
    { path: ['OIDC_CLIENT_SECRET'], message: 'the committed dev secret works on localhost only' },
  );

export type Env = z.output<typeof Env>;

let cached: Env | undefined;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = Env.safeParse(source);
  if (!result.success) {
    // Names and messages only: values may be secrets.
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`invalid configuration:\n  ${issues.join('\n  ')}`);
  }
  return result.data;
}

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** True when the app runs on http://localhost (development and e2e). */
export const isLocalHttp = (env: Env) => env.APP_ORIGIN.startsWith('http://');
