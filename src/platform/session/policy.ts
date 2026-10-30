import 'server-only';
import type { Session } from './schema';

/** The session is within its absolute lifetime (counted from login, not from refresh). */
export const isAlive = (session: Session, nowS: number, maxAgeS: number) =>
  nowS - session.createdAt < maxAgeS;

export const isExpired = (session: Session, nowS: number) => session.atExp <= nowS;

/**
 * Refresh when less than a minute (or half the token's lifetime, for short tokens) is
 * left, so a token never expires between the proxy and the API call it authorizes.
 */
export const refreshDue = (session: Session, nowS: number) =>
  session.atExp - nowS <= Math.min(60, Math.floor(session.atLife / 2));

export const nowSeconds = () => Math.floor(Date.now() / 1_000);
