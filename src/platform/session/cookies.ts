import 'server-only';

/**
 * One cookie policy everywhere, development and e2e included: `__Host-Http-` names
 * (host-only, Secure, set over HTTP only, never by script), HttpOnly, SameSite=Lax,
 * Path=/. Chromium keeps Secure cookies on http://localhost, so local runs exercise the
 * production path. Lax, not Strict: the IdP's redirect back to the callback is a
 * cross-site navigation (ADR-0003); the proxy's exact Origin check is the CSRF control.
 */
export const SESSION_COOKIE = '__Host-Http-gaw-session';
export const TXN_COOKIE = '__Host-Http-gaw-txn';
export const TXN_MAX_AGE_S = 600;

export interface CookieOptions {
  readonly httpOnly: true;
  readonly secure: true;
  readonly sameSite: 'lax';
  readonly path: '/';
  readonly maxAge: number;
}

/** What both NextResponse.cookies (proxy) and cookies() (route handlers, actions) offer. */
export interface CookieWriter {
  set(name: string, value: string, options: CookieOptions): unknown;
}

export const cookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge,
});

/**
 * Removes a cookie. Never cookies.delete(): Next sends that without Secure, and browsers
 * ignore a __Host- cookie's removal unless it carries Secure and Path=/ like its setting.
 */
export function expireCookie(jar: CookieWriter, name: string): void {
  jar.set(name, '', cookieOptions(0));
}

/** A cookie's value from a raw request (route handlers and the proxy's tests). */
export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}
