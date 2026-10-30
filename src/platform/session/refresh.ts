import 'server-only';
import { createHash } from 'node:crypto';
import type { Session } from './schema';

/**
 * Renews an access token with the refresh token. Runs only in the proxy: Server
 * Components cannot set cookies, so a refresh during render would consume a rotated
 * refresh token that is then lost, the next request would replay it, and reuse detection
 * would revoke the whole login.
 *
 * Single flight: concurrent requests carrying the same refresh token (parallel RSC
 * fetches, prefetches, a burst of tabs) share one grant, and its settled outcome is kept
 * for a minute so requests still carrying the pre-rotation cookie get the same new pair.
 * The dedupe is per process: run one replica, sticky sessions, or an IdP with a refresh
 * reuse grace window of at least 60 s (ADR-0003).
 */

export type RefreshOutcome =
  | { readonly kind: 'refreshed'; readonly session: Session }
  | {
      readonly kind: 'ended';
      readonly reason: 'invalid_grant' | 'no_refresh_token' | 'subject_mismatch';
    }
  | {
      readonly kind: 'unavailable';
      readonly reason: 'network' | 'timeout' | 'idp_5xx' | 'misconfigured';
    };

/** What a refresh grant returns (openid-client's response, narrowed to what we read). */
export interface GrantResult {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly id_token?: string;
  readonly expires_in?: number;
  claims(): { readonly iss: string; readonly sub: string } | undefined;
}

/** A failed grant, classified by the caller's grant function. */
export class RefreshGrantError extends Error {
  override readonly name = 'RefreshGrantError';
  constructor(
    readonly outcome: Extract<RefreshOutcome, { kind: 'ended' | 'unavailable' }>,
    options?: ErrorOptions,
  ) {
    super(`refresh ${outcome.kind}: ${outcome.reason}`, options);
  }
}

interface Entry {
  readonly promise: Promise<RefreshOutcome>;
  settledAt?: number;
}

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 10_000;
/** Proxy and route bundles are separate module instances in one process: share by symbol. */
const STORE = Symbol.for('gaw.refresh.inflight');

function store(): Map<string, Entry> {
  const holder = globalThis as unknown as Record<symbol, Map<string, Entry> | undefined>;
  holder[STORE] ??= new Map();
  return holder[STORE];
}

const DEFAULT_LIFETIME_S = 300;

export function createRefresher(deps: {
  grant: (refreshToken: string) => Promise<GrantResult>;
  now: () => number;
  settledTtlMs?: number;
  maxEntries?: number;
  entries?: Map<string, Entry>;
}): (session: Session) => Promise<RefreshOutcome> {
  const ttl = deps.settledTtlMs ?? DEFAULT_TTL_MS;
  const max = deps.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const entries = deps.entries ?? store();

  const sweep = (nowMs: number) => {
    for (const [key, entry] of entries) {
      if (entry.settledAt !== undefined && nowMs - entry.settledAt >= ttl) entries.delete(key);
    }
    while (entries.size >= max) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  };

  const run = async (session: Session, refreshToken: string): Promise<RefreshOutcome> => {
    let result: GrantResult;
    try {
      result = await deps.grant(refreshToken);
    } catch (error) {
      if (error instanceof RefreshGrantError) return error.outcome;
      return { kind: 'unavailable', reason: 'network' };
    }
    const claims = result.id_token ? result.claims() : undefined;
    if (claims && (claims.iss !== session.iss || claims.sub !== session.sub)) {
      return { kind: 'ended', reason: 'subject_mismatch' };
    }
    const nowS = Math.floor(deps.now() / 1_000);
    const life =
      result.expires_in && result.expires_in > 0 ? result.expires_in : DEFAULT_LIFETIME_S;
    const refreshed: Session = {
      ...session,
      at: result.access_token,
      atExp: nowS + life,
      atLife: life,
      // RFC 6749 section 6: keep the old refresh token when the IdP does not rotate.
      ...(result.refresh_token ? { rt: result.refresh_token } : {}),
      ...(result.id_token ? { idt: result.id_token } : {}),
    };
    return { kind: 'refreshed', session: refreshed };
  };

  return (session) => {
    if (!session.rt) return Promise.resolve({ kind: 'ended', reason: 'no_refresh_token' });
    const nowMs = deps.now();
    const key = createHash('sha256').update(session.rt).digest('hex');
    const existing = entries.get(key);
    if (existing && (existing.settledAt === undefined || nowMs - existing.settledAt < ttl)) {
      return existing.promise;
    }
    sweep(nowMs);
    const entry: Entry = {
      promise: run(session, session.rt).then((outcome) => {
        entry.settledAt = deps.now();
        // A failed attempt is not remembered: the next request may try again.
        if (outcome.kind === 'unavailable') entries.delete(key);
        return outcome;
      }),
    };
    entries.set(key, entry);
    return entry.promise;
  };
}
