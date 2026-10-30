import type { NextConfig } from 'next';

/** Sent on every response; the per-request CSP is set by the proxy (src/platform/proxy). */
const securityHeaders = [
  // Ignored by browsers over http (local dev); applies once served over https.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
];

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  typedRoutes: true,
  // The same id for every instance of a release (skew protection for Server Actions).
  ...(process.env.GAW_DEPLOYMENT_ID ? { deploymentId: process.env.GAW_DEPLOYMENT_ID } : {}),
  // A size limit, not a feature: the proxy buffers request bodies, 10 MB by default.
  experimental: { proxyClientMaxBodySize: '1mb' },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    return [{ source: '/', destination: '/houses', permanent: false }];
  },
};

export default config;
