/**
 * Scaffolds a feature from templates/feature and registers it.
 *
 *   pnpm new:feature <noun> [--plural <noun>] [--no-contract-check]
 *
 * <noun> is the kebab-case domain noun of the monolith module it pairs with, e.g. `review`
 * (`pnpm new:module review` there): src/features/<plural>, routes /<plural>, its e2e
 * spec, an entry in features.json (owning /v1/<plural>) and its nav in the app shell.
 * Unless --no-contract-check, the API snapshot must already have /v1/<plural> (run the
 * monolith's new:module, stack:up there, then pnpm api:sync --allow-dirty here).
 * Public pages are never added: listing a route in security/public-routes.json is a
 * reviewed step of its own.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, readRegistry, writeRegistry } from './lib.ts';
import { nounForms, substitution } from './naming.ts';

const NAV = 'src/app/_shell/nav.ts';
const NAV_MARKER = '// pnpm new:feature adds nav entries';

export async function newFeature(
  noun: string,
  options: { plural?: string; contractCheck: boolean },
): Promise<string[]> {
  const { singular, plural } = nounForms(noun, options.plural);
  const rename = substitution(singular, plural);
  const registry = readRegistry();
  if (registry.features.some((f) => f.name === plural.kebab) || plural.kebab === 'sample-items') {
    throw new Error(`a feature named ${plural.kebab} exists (or is the template's own name)`);
  }
  const targets = {
    feature: `src/features/${plural.kebab}`,
    routes: `src/app/${plural.kebab}`,
    e2e: `tests/e2e/features/${plural.kebab}.spec.ts`,
  };
  for (const path of Object.values(targets)) {
    if (existsSync(join(ROOT, path))) throw new Error(`${path} already exists`);
  }
  if (options.contractCheck) {
    const paths = Object.keys(
      (
        JSON.parse(readFileSync(join(ROOT, 'contracts/monolith/openapi.json'), 'utf8')) as {
          paths: object;
        }
      ).paths,
    );
    for (const path of [`/v1/${plural.kebab}`, `/v1/${plural.kebab}/{id}`]) {
      if (!paths.includes(path)) {
        throw new Error(
          `the API has no ${path}: run \`pnpm new:module ${noun}\` and \`pnpm stack:up\` in the monolith, then \`pnpm api:sync --allow-dirty\` here (or pass --no-contract-check)`,
        );
      }
    }
  }
  const navText = await readFile(join(ROOT, NAV), 'utf8');
  if (!navText.includes(NAV_MARKER))
    throw new Error(`${NAV} lost its marker "${NAV_MARKER}": put it back first`);

  const snapshot = new Map([
    ['features.json', await readFile(join(ROOT, 'features.json'), 'utf8')],
    [NAV, navText],
  ]);
  const written: string[] = [];
  try {
    const copyTree = async (from: string, to: string) => {
      const base = join(ROOT, 'templates/feature', from);
      for (const entry of await readdir(base, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const file = relative(base, join(entry.parentPath, entry.name));
        const target = join(ROOT, to, rename(file));
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, rename(await readFile(join(base, file), 'utf8')));
        written.push(relative(ROOT, target));
      }
    };
    await copyTree('feature', targets.feature);
    await copyTree('routes', targets.routes);
    await mkdir(dirname(join(ROOT, targets.e2e)), { recursive: true });
    await writeFile(
      join(ROOT, targets.e2e),
      rename(await readFile(join(ROOT, 'templates/feature/e2e/sample-items.spec.ts'), 'utf8')),
    );
    written.push(targets.e2e);

    registry.features.push({
      name: plural.kebab,
      dir: targets.feature,
      apiPaths: [`/v1/${plural.kebab}`],
      dependsOn: [],
    });
    writeRegistry(registry);
    const index = navText.indexOf(NAV_MARKER);
    const lineStart = navText.lastIndexOf('\n', index) + 1;
    const withEntry = `${navText.slice(0, lineStart)}  ...${plural.camel},\n${navText.slice(lineStart)}`;
    await writeFile(
      join(ROOT, NAV),
      `import { nav as ${plural.camel} } from '@/features/${plural.kebab}';\n${withEntry}`,
    );

    // Renames change line lengths and import order: let Biome restore the canonical format.
    execFileSync(
      'pnpm',
      [
        'exec',
        'biome',
        'check',
        '--write',
        targets.feature,
        targets.routes,
        targets.e2e,
        NAV,
        'features.json',
      ],
      {
        cwd: ROOT,
        stdio: 'inherit',
      },
    );
  } catch (error) {
    // Leave nothing half-made.
    for (const path of [targets.feature, targets.routes, targets.e2e])
      await rm(join(ROOT, path), { recursive: true, force: true });
    for (const [file, text] of snapshot) await writeFile(join(ROOT, file), text);
    throw error;
  }
  return written;
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      plural: { type: 'string' },
      'no-contract-check': { type: 'boolean', default: false },
    },
  });
  const noun = positionals[0];
  if (!noun) {
    console.error(
      'usage: pnpm new:feature <kebab-case-noun> [--plural <noun>] [--no-contract-check]',
    );
    process.exit(1);
  }
  try {
    const { plural } = nounForms(noun, values.plural);
    await newFeature(noun, {
      ...(values.plural ? { plural: values.plural } : {}),
      contractCheck: !values['no-contract-check'],
    });
    console.log(`
Created the ${plural.kebab} feature
  feature   src/features/${plural.kebab} (owns /v1/${plural.kebab} in features.json)
  routes    /${plural.kebab}, /${plural.kebab}/new, /${plural.kebab}/[id], /${plural.kebab}/[id]/edit
  e2e       tests/e2e/features/${plural.kebab}.spec.ts (the five access tests)
  nav       src/app/_shell/nav.ts

Next (the gaw-new-feature skill has the details):
  1. Reshape model/ to the module's resource, data/ to its API, ui/ and views/ to its screens
  2. Keep the five problem tests (actions.spec.ts) and the five access tests (e2e)
  3. pnpm check, then pnpm build && pnpm test:e2e with the monolith's stack up
`);
  } catch (error) {
    console.error(`new:feature: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
