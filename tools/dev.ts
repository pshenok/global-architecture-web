/**
 * pnpm dev: next dev on the registry's dev port, against the monolith's local stack
 * (`pnpm stack:up` there). Writes .env.local when missing and trusts the stack's dev
 * certificate through NODE_EXTRA_CA_CERTS, which Node reads only at launch, so it is
 * set here and never in an env file.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ensureEnvFile } from './env-files.ts';
import { monolithDir, ROOT, readRegistry } from './lib.ts';

if (ensureEnvFile()) console.log('dev: wrote .env.local');
const ca = join(monolithDir(), '.certs/dev-ca.pem');
if (!existsSync(ca)) {
  console.error(`dev: ${ca} is missing; run \`pnpm stack:up\` in ${monolithDir()} first`);
  process.exit(1);
}
const child = spawn(
  join(ROOT, 'node_modules/.bin/next'),
  ['dev', '-p', String(readRegistry().app.devPort), ...process.argv.slice(2)],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NODE_EXTRA_CA_CERTS: ca } },
);
const stop = (signal: NodeJS.Signals) => child.kill(signal);
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
