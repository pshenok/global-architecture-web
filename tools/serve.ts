/**
 * pnpm start: serves the standalone build (what the Docker image runs) on the e2e port,
 * against the monolith's local stack. Run `pnpm build` first. Copies the static assets
 * next to server.js as Next's standalone output expects, reads .env.local (the standalone
 * server does not), and trusts the stack's dev CA through NODE_EXTRA_CA_CERTS.
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureEnvFile } from './env-files.ts';
import { monolithDir, ROOT, readRegistry } from './lib.ts';

const standalone = join(ROOT, '.next/standalone');
if (!existsSync(join(standalone, 'server.js'))) {
  console.error('serve: no standalone build; run `pnpm build` first');
  process.exit(1);
}
cpSync(join(ROOT, '.next/static'), join(standalone, '.next/static'), { recursive: true });
if (existsSync(join(ROOT, 'public')))
  cpSync(join(ROOT, 'public'), join(standalone, 'public'), { recursive: true });

ensureEnvFile();
const fileEnv = Object.fromEntries(
  readFileSync(join(ROOT, '.env.local'), 'utf8')
    .split('\n')
    .filter((line) => /^[A-Z_][A-Z0-9_]*=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
);
const port = readRegistry().app.e2ePort;
const child = spawn(process.execPath, ['server.js'], {
  cwd: standalone,
  stdio: 'inherit',
  env: {
    ...fileEnv,
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    HOSTNAME: 'localhost',
    APP_ORIGIN: `http://localhost:${port}`,
    NODE_EXTRA_CA_CERTS: join(monolithDir(), '.certs/dev-ca.pem'),
  },
});
const stop = (signal: NodeJS.Signals) => child.kill(signal);
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
