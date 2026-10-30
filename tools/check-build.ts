/**
 * Runs after `next build` (pnpm build), on what will be deployed:
 * 1. The proxy shipped, with the pinned matcher: Next silently drops a misplaced proxy
 *    file, and with it CSRF, CSP, refresh and the route gate (G18).
 * 2. No app route was prerendered: every route renders per request, so every page gets
 *    a nonce and nothing user-specific is ever cached at build (G7).
 * 3. The static assets the browser downloads contain no secret: neither the names of the
 *    server's secret variables nor the values the build ran with (G11).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PINNED_MATCHER } from './check-access.ts';
import { ROOT } from './lib.ts';
import { files, repoPath, report } from './source.ts';

const NEXT = join(ROOT, '.next');
/** Next's own framework pages, prerendered whatever the app does. */
const PRERENDER_ALLOWED = new Set(['/_global-error', '/_not-found']);
const SECRET_NAMES = ['SESSION_KEYS', 'OIDC_CLIENT_SECRET', '-----BEGIN'];

function checkBuild(): string[] {
  const problems: string[] = [];
  if (!existsSync(NEXT)) return ['.next is missing: run next build first'];

  const functions = JSON.parse(
    readFileSync(join(NEXT, 'server/functions-config-manifest.json'), 'utf8'),
  ) as {
    functions: Record<string, { matchers?: { originalSource?: string }[] }>;
  };
  const proxy = functions.functions['/_middleware'];
  if (!proxy)
    problems.push(
      'the build has no proxy (functions-config-manifest.json /_middleware): is src/proxy.ts in place?',
    );
  else {
    const sources = (proxy.matchers ?? []).map((m) => m.originalSource);
    if (JSON.stringify(sources) !== JSON.stringify([PINNED_MATCHER]))
      problems.push(
        `the proxy's matcher is ${JSON.stringify(sources)}, expected [${JSON.stringify(PINNED_MATCHER)}]`,
      );
  }

  const prerender = JSON.parse(readFileSync(join(NEXT, 'prerender-manifest.json'), 'utf8')) as {
    routes: Record<string, unknown>;
  };
  for (const route of Object.keys(prerender.routes)) {
    if (!PRERENDER_ALLOWED.has(route))
      problems.push(
        `${route} was prerendered at build; every route renders per request (root layout connection())`,
      );
  }

  const values = SECRET_NAMES.map((name) => process.env[name]).filter(
    (v): v is string => typeof v === 'string' && v.length >= 8,
  );
  for (const path of files(join(NEXT, 'static'), /\.(js|css|json|html|txt|map)$/)) {
    const text = readFileSync(path, 'utf8');
    for (const needle of [...SECRET_NAMES, ...values]) {
      if (text.includes(needle))
        problems.push(
          `${repoPath(path)}: contains ${SECRET_NAMES.includes(needle) ? needle : 'a secret value from the build environment'}`,
        );
    }
  }
  return problems;
}

if (import.meta.main)
  report(
    'check-build',
    checkBuild(),
    'the proxy shipped with its matcher, nothing prerendered, no secrets in static assets',
  );
