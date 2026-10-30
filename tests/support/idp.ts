import { createHash } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { HttpResponse, http } from 'msw/http';
import { IDP, mswServer } from './msw';

/**
 * An OIDC provider at https://idp.test for unit tests: discovery, JWKS, the code and
 * refresh grants (PKCE checked), end-session. Each test configures what /token answers.
 */
const { privateKey, publicKey } = await generateKeyPair('ES256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256', use: 'sig' };

export interface IdpState {
  /** The challenge the last authorization request sent (read from the login redirect). */
  challenge?: string;
  nonce?: string;
  tokenResponse?: (form: URLSearchParams) => Response | Promise<Response>;
}

export const idpState: IdpState = {};

export const idToken = (claims: Record<string, unknown>) =>
  new SignJWT({
    iss: IDP,
    aud: 'gaw-web',
    sub: 'alice',
    sid: 'sid-1',
    email: 'alice@example.com',
    ...claims,
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(privateKey);

export function useIdp(): void {
  mswServer.use(
    http.get(`${IDP}/.well-known/openid-configuration`, () =>
      HttpResponse.json({
        issuer: IDP,
        authorization_endpoint: `${IDP}/authorize`,
        token_endpoint: `${IDP}/token`,
        jwks_uri: `${IDP}/jwks.json`,
        end_session_endpoint: `${IDP}/end-session`,
        code_challenge_methods_supported: ['S256'],
        id_token_signing_alg_values_supported: ['ES256'],
        authorization_response_iss_parameter_supported: true,
      }),
    ),
    http.get(`${IDP}/jwks.json`, () => HttpResponse.json({ keys: [jwk] })),
    http.post(`${IDP}/token`, async ({ request }) => {
      const form = new URLSearchParams(await request.text());
      // RFC 6749 2.3.1: client_secret_basic credentials are form-urlencoded first.
      const basic = Buffer.from(
        (request.headers.get('authorization') ?? '').replace(/^Basic /, ''),
        'base64',
      ).toString();
      const [id, secret] = basic.split(':').map((part) => decodeURIComponent(part));
      if (id !== 'gaw-web' || secret !== 'unit-test-secret') {
        return HttpResponse.json({ error: 'invalid_client' }, { status: 401 });
      }
      if (form.get('grant_type') === 'authorization_code') {
        const verifier = form.get('code_verifier') ?? '';
        const challenge = createHash('sha256').update(verifier).digest('base64url');
        if (challenge !== idpState.challenge)
          return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 });
      }
      if (idpState.tokenResponse) return idpState.tokenResponse(form);
      return HttpResponse.json({
        access_token: 'access-token-1',
        token_type: 'Bearer',
        expires_in: 300,
        refresh_token: 'refresh-token-1',
        id_token: await idToken({ nonce: idpState.nonce }),
        scope: 'openid email offline_access',
      });
    }),
  );
}

/** Forgets the memoized discovery (the OIDC config is cached per process). */
export function resetOidc(): void {
  (globalThis as Record<symbol, unknown>)[Symbol.for('gaw.oidc.config')] = undefined;
  for (const key of Object.keys(idpState)) delete idpState[key as keyof IdpState];
}
