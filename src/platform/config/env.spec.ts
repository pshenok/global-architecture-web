import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const KEY = Buffer.alloc(32, 1).toString('base64url');
const valid = {
  APP_ORIGIN: 'http://localhost:9300',
  API_BASE_URL: 'https://localhost:9443',
  OIDC_ISSUER: 'http://127.0.0.1:9090',
  OIDC_CLIENT_ID: 'gaw-web',
  OIDC_CLIENT_SECRET: 'dev-insecure-gaw-web',
  SESSION_KEYS: JSON.stringify([{ kid: 'a', key: KEY }]),
};

describe('configuration', () => {
  it('parses the local development values with defaults', () => {
    const env = parseEnv(valid);
    expect(env.OIDC_SCOPES).toEqual(['openid', 'email', 'offline_access']);
    expect(env.SESSION_MAX_AGE_S).toBe(28_800);
    expect(env.SESSION_KEYS[0]?.key).toHaveLength(32);
  });

  it.each([
    ['APP_ORIGIN', 'http://example.com'],
    ['APP_ORIGIN', 'https://example.com/app'],
    ['API_BASE_URL', 'http://localhost:9443'],
    ['OIDC_ISSUER', 'http://idp.example.com'],
    ['OIDC_SCOPES', 'email profile'],
    ['OIDC_AUTH_PARAMS', '{"redirect_uri":"https://evil.test"}'],
    ['OIDC_EXTRA_ORIGINS', 'http://tokens.example.com'],
    ['SESSION_KEYS', '[]'],
    ['SESSION_KEYS', JSON.stringify([{ kid: 'a', key: 'short' }])],
    [
      'SESSION_KEYS',
      JSON.stringify([
        { kid: 'a', key: KEY },
        { kid: 'a', key: KEY },
      ]),
    ],
    ['SESSION_MAX_AGE_S', '10'],
  ])('refuses %s=%s', (name, value) => {
    expect(() => parseEnv({ ...valid, [name]: value })).toThrow(name);
  });

  it('refuses the committed dev client secret away from localhost', () => {
    expect(() => parseEnv({ ...valid, APP_ORIGIN: 'https://web.example.com' })).toThrow(
      'OIDC_CLIENT_SECRET',
    );
  });

  it('never prints a value in its error', () => {
    const secret = Buffer.alloc(32, 9).toString('base64url');
    try {
      parseEnv({ ...valid, SESSION_KEYS: JSON.stringify([{ kid: 'a b', key: secret }]) });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
