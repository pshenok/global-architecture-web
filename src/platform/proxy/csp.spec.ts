import { describe, expect, it } from 'vitest';
import { buildCsp, newNonce } from './csp';

describe('CSP', () => {
  it('is strict in production: nonce plus strict-dynamic, no unsafe-*, no third parties', () => {
    const csp = buildCsp({
      nonce: 'abc',
      issuerOrigin: 'https://login.example.com',
      https: true,
      dev: false,
    });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc'");
    expect(csp).toContain("form-action 'self' https://login.example.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp.replace("style-src-attr 'unsafe-inline'", '')).not.toMatch(/unsafe-(inline|eval)/);
  });

  it('relaxes only what next dev needs', () => {
    const csp = buildCsp({
      nonce: 'abc',
      issuerOrigin: 'http://127.0.0.1:9090',
      https: false,
      dev: true,
    });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws:");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('draws a new 128-bit nonce each time', () => {
    const a = newNonce();
    expect(Buffer.from(a, 'base64')).toHaveLength(16);
    expect(newNonce()).not.toBe(a);
  });
});
