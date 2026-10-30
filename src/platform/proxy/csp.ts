import 'server-only';

/**
 * The Content-Security-Policy of one response, with its own nonce. Next reads the nonce
 * from the request's CSP header and puts it on every script and style it renders, so
 * the request and the response must carry the very same value (vercel/next.js#99360).
 * There are no inline scripts of our own and no third-party origins.
 */
export function buildCsp(options: {
  nonce: string;
  issuerOrigin: string;
  https: boolean;
  dev: boolean;
}): string {
  const { nonce, issuerOrigin, https, dev } = options;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // Style attributes React and Base UI set (positions, transitions); no selectors possible.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    // The logout form's 303 to the provider's end-session endpoint counts as a form action.
    `form-action 'self' ${issuerOrigin}`,
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function newNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
}
