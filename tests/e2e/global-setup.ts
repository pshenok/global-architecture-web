import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { ROOT, readMonolithRegistry } from '../../tools/lib.ts';
import { API, apiCall, IDP } from './support/stack.ts';

/** Refuses to run against a stack that is not the one this app was built for. */
export default async function globalSetup(): Promise<void> {
  const fail = (message: string): never => {
    throw new Error(`e2e preflight: ${message}`);
  };
  const ready = await apiCall('GET', '/readyz').catch(() =>
    fail(`${API} is not reachable: run \`pnpm stack:up\` in the monolith checkout`),
  );
  if (ready.status !== 200 || (ready.body as { status?: string }).status !== 'ok')
    fail(`${API}/readyz is not ok: ${JSON.stringify(ready.body)}`);

  const discovery = (await (
    await fetch(`${IDP}/.well-known/openid-configuration`)
  ).json()) as Record<string, unknown>;
  if (!discovery.authorization_endpoint)
    fail(
      'the dev IdP has no authorization_endpoint: update the monolith checkout (dev IdP code flow)',
    );
  const client = readMonolithRegistry().devIdp.clients?.find((c) => c.clientId === 'gaw-web');
  if (!client?.redirectUris.includes('http://localhost:9301/auth/callback'))
    fail(
      'the monolith registers no gaw-web client with the 9301 callback (modules.json devIdp.clients)',
    );

  const live = (await apiCall('GET', '/openapi.json')).body;
  const snapshot = JSON.parse(
    readFileSync(join(ROOT, 'contracts/monolith/openapi.json'), 'utf8'),
  ) as unknown;
  if (!isDeepStrictEqual(live, snapshot))
    fail(
      'the running API differs from contracts/monolith/openapi.json: run `pnpm api:sync` (or check out the commit in source.json)',
    );

  mkdirSync(join(ROOT, 'tests/e2e/.auth'), { recursive: true });
  writeFileSync(join(ROOT, 'tests/e2e/.auth/run-id'), Date.now().toString(36));
}
