import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { join } from 'node:path';
import { monolithDir, ROOT, readMonolithRegistry } from '../../../tools/lib.ts';

export const APP = 'http://localhost:9301';
const monolith = readMonolithRegistry();
export const IDP = `http://127.0.0.1:${monolith.devIdp.port}`;
export const API = `https://localhost:${monolith.api.httpsPort}`;
const CA = readFileSync(join(monolithDir(), '.certs/dev-ca.pem'));

/** A request to the monolith API over its dev certificate (seeding and checks only). */
export function apiCall(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      `${API}${path}`,
      {
        method,
        ca: CA,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
      },
      (response) => {
        let text = '';
        response.on('data', (chunk: Buffer) => {
          text += chunk.toString();
        });
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, body: text ? JSON.parse(text) : undefined }),
        );
      },
    );
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

/** An access token from the dev IdP's JSON mint (seeding only; never enters the web app). */
export async function devToken(sub: string, email?: string): Promise<string> {
  const response = await fetch(`${IDP}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sub, ...(email ? { email, emailVerified: true } : {}), ttlS: 600 }),
  });
  return ((await response.json()) as { access_token: string }).access_token;
}

/** Grants the platform admin role through the monolith's own role CLI. */
export function grantAdmin(userId: string): void {
  execFileSync('pnpm', ['-s', 'users:grant-role', userId, 'admin'], {
    cwd: monolithDir(),
    stdio: 'pipe',
  });
}

/** This run's id: personas and data are named after it, so runs never collide. */
export function runId(): string {
  return readFileSync(join(ROOT, 'tests/e2e/.auth/run-id'), 'utf8').trim();
}

/** The session keys the app runs with (.env.local), to open its cookie in tests. */
export function sessionKeys(): { kid: string; key: string }[] {
  const line = readFileSync(join(ROOT, '.env.local'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith('SESSION_KEYS='));
  return JSON.parse(line?.slice('SESSION_KEYS='.length) ?? '[]') as { kid: string; key: string }[];
}
