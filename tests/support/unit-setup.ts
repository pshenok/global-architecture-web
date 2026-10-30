import { afterAll, afterEach, beforeAll } from 'vitest';
import { mswServer } from './msw';

/**
 * A valid configuration for every unit test (getEnv() reads it once). The API and the
 * IdP live at .test hosts that only MSW answers; anything unhandled fails the test.
 */
Object.assign(process.env, {
  APP_ORIGIN: 'http://localhost:9300',
  API_BASE_URL: 'https://api.test',
  OIDC_ISSUER: 'https://idp.test',
  OIDC_CLIENT_ID: 'gaw-web',
  OIDC_CLIENT_SECRET: 'unit-test-secret',
  SESSION_KEYS: JSON.stringify([{ kid: 'k1', key: Buffer.alloc(32, 7).toString('base64url') }]),
  LOG_LEVEL: 'error',
});

beforeAll(() => mswServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
