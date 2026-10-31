/**
 * CI guard against template rot, the twin of the monolith's: merges the template's
 * contract (renamed) into the API snapshot, generates a throwaway multi-word feature from
 * templates/feature with `pnpm new:feature`, then lints it (Biome, the guardrails),
 * typechecks, tests and builds the app with it, and removes it, restoring every file it
 * touched from a snapshot taken first (local edits included) and building the app again,
 * so .next matches the restored sources.
 *   pnpm template:verify   (offline: no monolith needed)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APP_TARGET,
  mergeContract,
  type OpenApiDocument,
  regenerate,
  SNAPSHOT,
} from './api-sync.ts';
import { ROOT } from './lib.ts';
import { nounForms, substitution } from './naming.ts';
import { newFeature } from './new-feature.ts';

const NOUN = 'zz-template-check';
const PLURAL = 'zz-template-checks';
const TOUCHED = [
  'features.json',
  'src/app/_shell/nav.ts',
  'contracts/monolith/openapi.json',
  'src/platform/api/generated/schema.d.ts',
  'src/platform/api/generated/operations.ts',
];
const GENERATED = [
  `src/features/${PLURAL}`,
  `src/app/${PLURAL}`,
  `tests/e2e/features/${PLURAL}.spec.ts`,
];

const run = (args: string[]) => {
  console.log(`\n$ ${args.join(' ')}`);
  execFileSync(args[0] as string, args.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
};
const status = () =>
  execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((line) => line && !line.includes(PLURAL))
    .sort()
    .join('\n');

const before = status();
const snapshot = new Map(TOUCHED.map((file) => [file, readFileSync(join(ROOT, file), 'utf8')]));

let failed = false;
try {
  const { singular, plural } = nounForms(NOUN);
  const document = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as OpenApiDocument;
  const merged = mergeContract(document, substitution(singular, plural));
  writeFileSync(SNAPSHOT, `${JSON.stringify(merged, null, 2)}\n`);
  regenerate(merged, APP_TARGET);

  await newFeature(NOUN, { contractCheck: true });
  run(['pnpm', 'exec', 'biome', 'ci', ...GENERATED, 'features.json', 'src/app/_shell/nav.ts']);
  run([process.execPath, 'tools/check-access.ts']);
  run([process.execPath, 'tools/check-boundaries.ts']);
  run([process.execPath, 'tools/check-text.ts']);
  run(['pnpm', 'exec', 'next', 'typegen']);
  run(['pnpm', 'exec', 'tsc', '-p', 'tsconfig.json']);
  run([
    'pnpm',
    'exec',
    'vitest',
    'run',
    '--project',
    'unit',
    '--project',
    'browser',
    `src/features/${PLURAL}`,
  ]);
  run(['pnpm', 'exec', 'next', 'build']);
  run([process.execPath, 'tools/check-build.ts']);
  console.log('\ntemplate:verify OK');
} catch (error) {
  failed = true;
  console.error(
    `\ntemplate:verify FAILED: ${error instanceof Error ? error.message : String(error)}`,
  );
} finally {
  for (const path of GENERATED) rmSync(join(ROOT, path), { recursive: true, force: true });
  for (const [file, text] of snapshot) writeFileSync(join(ROOT, file), text);
  // The build had the throwaway feature: build again from the restored sources, or the
  // standalone server (git-ignored, invisible to the status check) would serve it.
  try {
    run(['pnpm', 'exec', 'next', 'build']);
  } catch {
    console.error('\nthe rebuild after template:verify failed: run pnpm build yourself');
    failed = true;
  }
}
const after = status();
if (after !== before) {
  console.error(`\ntemplate:verify left changes behind:\n${after}\n(before:\n${before})`);
  failed = true;
}
process.exit(failed ? 1 : 0);
