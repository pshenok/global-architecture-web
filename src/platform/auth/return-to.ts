import 'server-only';

export const DEFAULT_RETURN_TO = '/houses';

/**
 * A same-origin path to return to after sign-in, or the default: one leading "/", never
 * "//" or "/\" (protocol-relative), no control characters, at most 2048 characters, and
 * still on the app's origin once resolved.
 */
export function safeReturnTo(value: string | null | undefined, appOrigin: string): string {
  if (!value || value.length > 2048) return DEFAULT_RETURN_TO;
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((char) => (char.codePointAt(0) ?? 0) < 0x20 || char === '\u007f')
  ) {
    return DEFAULT_RETURN_TO;
  }
  try {
    const url = new URL(value, appOrigin);
    if (url.origin !== appOrigin) return DEFAULT_RETURN_TO;
    if (url.pathname.startsWith('/auth/')) return DEFAULT_RETURN_TO;
    return `${url.pathname}${url.search}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}
