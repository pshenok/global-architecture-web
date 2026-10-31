/**
 * A path on this site, normalized, or undefined. One leading "/" (never "//" or a
 * backslash: protocol-relative), no control characters (URL parsers drop tabs and
 * newlines, so "/\t/evil.example" would become "//evil.example"), at most 2048
 * characters, and still on the same origin once a URL parser has resolved it. The
 * normalized result is checked again: dot segments collapse, so "/.//evil.example" and
 * "/a/..//evil.example" resolve to "//evil.example". Use it for every redirect target
 * that came from a request.
 */
const PROBE = 'https://app.invalid';

export function localPath(value: string | null | undefined): string | undefined {
  if (
    !value ||
    value.length > 2048 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return undefined;
  }
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return undefined;
  }
  try {
    const url = new URL(value, PROBE);
    const path = `${url.pathname}${url.search}${url.hash}`;
    return url.origin === PROBE && !path.startsWith('//') ? path : undefined;
  } catch {
    return undefined;
  }
}
