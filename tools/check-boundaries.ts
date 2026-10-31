/**
 * Slice and layer guardrail (ADR-0002), run by `pnpm lint`. Reads every .ts/.tsx file
 * under src/ (and templates/feature, read as the feature `sample-items` and its routes)
 * with the TypeScript 7 parser; every import, export ... from and import() counts. Type-
 * only imports are erased at build time and always allowed.
 *
 * R1  A relative import never leaves its slice (one feature, kernel, ui, platform, app);
 *     an alias import names its target directly (no empty, . or .. segments, no /index).
 * R2  src holds only kernel, ui, platform, features, app, proxy.ts and instrumentation.ts.
 *     Slices: kernel imports nothing outside itself; ui imports kernel, ui and its UI
 *     packages; platform never imports features, app or ui; features import kernel, ui and
 *     platform entries; app composes features through their public entries. Outside
 *     platform, only `@/platform/<entry>` roots are imported, each by the files it serves.
 * R3  Another feature is imported only as `@/features/<g>` or `@/features/<g>/server`,
 *     and only when features.json lists g in dependsOn (acyclic).
 * R4  Inside a feature: model <- data <- views; ui only model; actions.ts model and data;
 *     server.ts model, data, views, actions; index.ts model and ui.
 * R5  ui/ (a feature's and src/ui) exports no async component.
 * R6  A 'use client' file imports nothing server-side: server-only, next/headers,
 *     next/cache, platform, data, views, server.ts, actions.ts (actions arrive as props).
 * R7  Server code starts with `import 'server-only'`: platform (except its client-free
 *     testing helpers), and every feature's data/, views/ and server.ts.
 * R8  A feature's gateways call the API only on its own apiPaths, with literal paths, as
 *     api().<METHOD>('<path>', ...) with `api` imported by name from @/platform/api; no
 *     feature re-exports the client or imports it with import().
 * R9  Single owners: openapi-fetch (platform/api/client.ts), openid-client
 *     (platform/auth/oidc.ts), jose (platform/session/codec.ts), the global fetch
 *     (platform/net/outbound.ts), next/headers (platform/{session,auth,http,actions}); no undici.
 * R10 authorizationHeader is imported only by platform/api/call.ts.
 * R11 Test helpers (testing.ts, tests/, tools/) never reach production code.
 * R12 features.json lists exactly the folders in src/features; each has index.ts and
 *     server.ts, and the app shell imports its nav.
 *
 * Every run first checks itself on tests/probes/boundaries (see tools/source.ts).
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { ROOT, readRegistry } from './lib.ts';
import {
  directivesOf,
  files,
  type ImportRef,
  importsOf,
  lineOf,
  type Node,
  repoPath,
  report,
  type SourceFile,
  SyntaxKind,
  selfTest,
  startsServerOnly,
  textOf,
  withSources,
} from './source.ts';

type Layer = 'model' | 'data' | 'views' | 'ui' | 'actions' | 'server' | 'index' | 'other';

type Where =
  | { readonly slice: 'kernel' | 'ui' | 'app' | 'tests' | 'tools' | 'external' | 'other' }
  | { readonly slice: 'platform'; readonly entry: string; readonly deep: boolean }
  | {
      readonly slice: 'feature';
      readonly feature: string;
      readonly layer: Layer;
      readonly entry: 'index' | 'server' | 'deep';
    }
  | { readonly slice: 'root'; readonly file: 'proxy' | 'instrumentation' };

const registry = readRegistry();
const TEMPLATE_FEATURE = {
  name: 'sample-items',
  dir: 'templates/feature/feature',
  apiPaths: ['/v1/sample-items'],
  dependsOn: [] as string[],
};
const features = [...registry.features, TEMPLATE_FEATURE];
const byName = new Map(features.map((f) => [f.name, f]));

/** Where a repository path (with or without extension) sits. */
export function locate(path: string): Where {
  const p = path.replace(/\.(tsx?|json)$/, '');
  if (p.startsWith('tests/') || /(^|\/)testing$/.test(p)) return { slice: 'tests' };
  if (p.startsWith('tools/')) return { slice: 'tools' };
  if (p === 'src/proxy') return { slice: 'root', file: 'proxy' };
  if (p === 'src/instrumentation') return { slice: 'root', file: 'instrumentation' };
  if (p.startsWith('src/kernel/')) return { slice: 'kernel' };
  if (p.startsWith('src/ui/') || p === 'src/ui') return { slice: 'ui' };
  if (p.startsWith('src/app/') || p.startsWith('templates/feature/routes/'))
    return { slice: 'app' };
  const platform = /^src\/platform\/([^/]+)(\/.+)?$/.exec(p);
  if (platform)
    return {
      slice: 'platform',
      entry: platform[1] as string,
      deep: platform[2] !== undefined && platform[2] !== '/index',
    };
  for (const feature of features) {
    if (p === feature.dir || p.startsWith(`${feature.dir}/`)) {
      const rest = p.slice(feature.dir.length + 1);
      const top = rest.split('/')[0] ?? '';
      const layer: Layer =
        rest === '' || rest === 'index'
          ? 'index'
          : rest === 'server'
            ? 'server'
            : rest === 'actions'
              ? 'actions'
              : ((['model', 'data', 'views', 'ui'] as const).find((l) => l === top) ?? 'other');
      return {
        slice: 'feature',
        feature: feature.name,
        layer,
        entry: rest === '' || rest === 'index' ? 'index' : rest === 'server' ? 'server' : 'deep',
      };
    }
  }
  if (p.startsWith('src/features/'))
    return { slice: 'feature', feature: p.split('/')[2] ?? '', layer: 'other', entry: 'deep' };
  return { slice: 'other' };
}

/** The repository path an import points at, or undefined for a package. */
function resolveSpecifier(specifier: string, from: string): string | undefined {
  // The template compiles in place: its alias points at templates/feature/feature.
  const template = /^@\/features\/sample-items(\/.*)?$/.exec(specifier);
  if (template) return `${TEMPLATE_FEATURE.dir}${template[1] ?? ''}`;
  if (specifier.startsWith('@/'))
    return normalize(join('src', specifier.slice(2)))
      .split('\\')
      .join('/');
  if (specifier.startsWith('.'))
    return normalize(join(dirname(from), specifier))
      .split('\\')
      .join('/');
  return undefined;
}

const packageOf = (specifier: string) =>
  specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : (specifier.split('/')[0] as string);

/** UI packages src/ui may use. */
const UI_PACKAGES = new Set([
  'react',
  'react-dom',
  '@base-ui/react',
  'lucide-react',
  'cn',
  'class-variance-authority',
  'next',
]);
const UI_NEXT = new Set(['next/link', 'next/form', 'next/navigation']);

/** Platform entries, and which files outside platform may import each (R2). */
const ENTRY_USERS: Readonly<Record<string, (where: Where, file: string) => boolean>> = {
  api: (w) => w.slice === 'feature' && w.layer === 'data',
  session: (w, file) =>
    (w.slice === 'feature' && ['views', 'server', 'actions'].includes(w.layer)) ||
    file.startsWith('src/app/_shell/'),
  actions: (w) => w.slice === 'feature' && w.layer === 'actions',
  errors: (w) => w.slice === 'feature' && (w.layer === 'views' || w.layer === 'server'),
  observability: (w) =>
    (w.slice === 'feature' && w.layer !== 'model' && w.layer !== 'ui') ||
    (w.slice === 'root' && w.file === 'instrumentation'),
  auth: (_w, file) => file.startsWith('src/app/auth/'),
  health: (_w, file) => file === 'src/app/healthz/route.ts',
  proxy: (w) => w.slice === 'root' && w.file === 'proxy',
};

/** Deep platform paths allowed outside platform (none but the boot-time config check). */
const DEEP_PLATFORM_ALLOWED: Readonly<Record<string, string>> = {
  'src/instrumentation.ts': 'src/platform/config/env',
};

const LAYERS: Readonly<Record<Layer, readonly Layer[]>> = {
  model: ['model'],
  data: ['model', 'data'],
  views: ['model', 'data', 'views', 'ui', 'actions'],
  ui: ['model', 'ui'],
  actions: ['model', 'data'],
  server: ['model', 'data', 'views', 'actions'],
  index: ['model', 'ui'],
  other: [],
};

const SERVER_ONLY_PLATFORM =
  /^src\/platform\/(config|net|session|auth|proxy|api|actions|errors|http|observability|health)\//;
const SINGLE_OWNERS: readonly [string, (file: string) => boolean][] = [
  ['openapi-fetch', (f) => f === 'src/platform/api/client.ts'],
  ['openid-client', (f) => f === 'src/platform/auth/oidc.ts'],
  ['jose', (f) => f === 'src/platform/session/codec.ts'],
  ['next/headers', (f) => /^src\/platform\/(session|auth|http|actions)\//.test(f)],
  ['undici', () => false],
];

const isSpec = (file: string) => /\.spec\.tsx?$/.test(file);
const API_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export function checkFile(file: string, source: SourceFile, as = file): string[] {
  const problems: string[] = [];
  const at = (node: Node) => `${file}:${lineOf(source, node)}`;
  const here = locate(as);
  const spec = isSpec(as);
  const client = directivesOf(source.statements).some((d) => d.text === 'use client');
  const imports = importsOf(source);

  // R7: server-only first.
  const mustBeServerOnly =
    !spec &&
    ((SERVER_ONLY_PLATFORM.test(as) && !/\/testing\.ts$/.test(as)) ||
      (here.slice === 'feature' &&
        (here.layer === 'data' || here.layer === 'views' || here.layer === 'server')));
  if (mustBeServerOnly && !startsServerOnly(source)) {
    problems.push(`${file}:1: server code starts with import 'server-only' (R7)`);
  }
  if (as.startsWith('src/') && here.slice === 'other') {
    problems.push(
      `${file}:1: src holds only kernel, ui, platform, features, app, proxy.ts and instrumentation.ts (R2)`,
    );
  }

  for (const ref of imports) {
    problems.push(
      ...checkImport(ref, as, here, { client, spec }).map(
        (message) => `${at(ref.node)}: ${message}`,
      ),
    );
  }

  // R5: no async component exported from ui/.
  if ((here.slice === 'ui' || (here.slice === 'feature' && here.layer === 'ui')) && !spec) {
    for (const statement of source.statements) {
      const text = statement.getText(source);
      if (
        /^export\s+(default\s+)?async\s+function\b/.test(text) ||
        /^export\s+const\s+\w+\s*=\s*async\b/.test(text)
      ) {
        problems.push(
          `${at(statement)}: ui/ components are synchronous; fetch in views/ and pass data down (R5)`,
        );
      }
    }
  }

  // R8: in a feature, the client is imported by name and used only as
  // api().<METHOD>('<literal path>', ...): no aliases, no stored clients, no other methods.
  const featureCode = here.slice === 'feature' && !spec;
  if (featureCode) {
    for (const statement of source.statements) {
      if (statement.kind !== SyntaxKind.ImportDeclaration) continue;
      const declaration = statement as unknown as {
        moduleSpecifier: Node;
        importClause?: { namedBindings?: Node & { elements?: readonly { propertyName?: Node }[] } };
      };
      if (textOf(declaration.moduleSpecifier) !== '@/platform/api') continue;
      const bindings = declaration.importClause?.namedBindings;
      if (
        bindings?.kind === SyntaxKind.NamespaceImport ||
        bindings?.elements?.some((e) => e.propertyName !== undefined)
      ) {
        problems.push(
          `${at(statement)}: import from @/platform/api by name, without renaming (R8)`,
        );
      }
    }
    for (const ref of imports) {
      const target = resolveSpecifier(ref.specifier, as);
      const where = target === undefined ? undefined : locate(target);
      if (where?.slice === 'platform' && where.entry === 'api' && ref.kind !== 'import')
        problems.push(
          `${at(ref.node)}: features import the API client statically and never re-export it (R8)`,
        );
    }
  }

  // R8 (API ownership) and R9 (the global fetch).
  const visit = (node: Node): void => {
    if (featureCode && node.kind === SyntaxKind.Identifier && node.getText(source) === 'api') {
      const parent = (
        node as unknown as {
          parent: Node & { name?: Node; expression?: Node; arguments?: readonly Node[] };
        }
      ).parent;
      const isPropertyName =
        ((parent.kind === SyntaxKind.PropertyAccessExpression ||
          parent.kind === SyntaxKind.PropertyAssignment) &&
          parent.name === node) ||
        parent.kind === SyntaxKind.ImportSpecifier;
      if (!isPropertyName) {
        const member = (parent as unknown as { parent: Node & { name?: Node; expression?: Node } })
          .parent;
        const outer = (
          member as unknown as { parent: Node & { expression?: Node; arguments?: readonly Node[] } }
        ).parent;
        const method = member.name?.getText(source) ?? '';
        // The text check refuses what the tree allows: optional chaining, comments.
        const direct =
          parent.kind === SyntaxKind.CallExpression &&
          parent.expression === node &&
          (parent.arguments?.length ?? 0) === 0 &&
          member.kind === SyntaxKind.PropertyAccessExpression &&
          member.expression === parent &&
          API_METHODS.has(method) &&
          outer.kind === SyntaxKind.CallExpression &&
          outer.expression === member &&
          outer.getText(source).startsWith(`api().${method}(`);
        if (!direct) {
          problems.push(
            `${at(node)}: call the API only as api().<GET|POST|PUT|PATCH|DELETE>('<literal path>', ...) (R8)`,
          );
        } else {
          const path = textOf(outer.arguments?.[0]);
          const owned = byName.get(here.feature)?.apiPaths ?? [];
          if (path === undefined) problems.push(`${at(node)}: API paths are string literals (R8)`);
          else if (!owned.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
            problems.push(
              `${at(node)}: ${path} belongs to another feature; ${here.feature} owns ${owned.join(', ') || 'no API paths'} (R8)`,
            );
          }
        }
      }
    }
    if (node.kind === SyntaxKind.CallExpression) {
      const callee = (node as unknown as { expression: Node }).expression.getText(source);
      if (
        (callee === 'fetch' || callee === 'globalThis.fetch') &&
        as !== 'src/platform/net/outbound.ts' &&
        !spec
      ) {
        problems.push(`${at(node)}: only platform/net/outbound.ts calls fetch (R9)`);
      }
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return problems;
}

function checkImport(
  ref: ImportRef,
  as: string,
  here: Where,
  flags: { client: boolean; spec: boolean },
): string[] {
  const problems: string[] = [];
  const { specifier } = ref;
  if (specifier === '<computed>') return ['import() takes a literal specifier'];
  if (specifier.startsWith('@/')) {
    const segments = specifier.slice(2).split('/');
    if (
      segments.some((segment) => segment === '' || segment === '.' || segment === '..') ||
      segments.at(-1) === 'index'
    ) {
      return [
        `alias imports name their target directly (no empty, . or .. segments, no /index): ${specifier} (R1)`,
      ];
    }
  }
  const targetPath = resolveSpecifier(specifier, as);
  const target = targetPath === undefined ? ({ slice: 'external' } as Where) : locate(targetPath);
  const pkg = targetPath === undefined ? packageOf(specifier) : undefined;

  // R9: single owners (value and type imports alike: the dependency is the point).
  for (const [name, allowed] of SINGLE_OWNERS) {
    if ((specifier === name || specifier.startsWith(`${name}/`)) && !allowed(as) && !flags.spec) {
      problems.push(`${name} is imported only by its owner module (R9)`);
    }
  }
  // R10
  if (
    ref.names.includes('authorizationHeader') &&
    as !== 'src/platform/api/call.ts' &&
    !as.startsWith('src/platform/session/')
  ) {
    problems.push('authorizationHeader is used only by platform/api/call.ts (R10)');
  }
  // R11
  if (target.slice === 'tests' || target.slice === 'tools') {
    if (
      !flags.spec &&
      here.slice !== 'tests' &&
      here.slice !== 'tools' &&
      !(here.slice === 'platform' && /\/testing\.ts$/.test(as))
    ) {
      problems.push(`${specifier}: test helpers never reach production code (R11)`);
    }
    return problems;
  }
  if (flags.spec || here.slice === 'tests' || here.slice === 'tools') return problems;

  // R6: the client boundary (value imports only).
  if (flags.client && !ref.typeOnly) {
    const serverPackage =
      specifier === 'server-only' || specifier === 'next/headers' || specifier === 'next/cache';
    const serverTarget =
      target.slice === 'platform' ||
      (target.slice === 'feature' &&
        (target.layer === 'data' ||
          target.layer === 'views' ||
          target.layer === 'server' ||
          target.layer === 'actions'));
    if (serverPackage || serverTarget)
      problems.push(`'use client' files import no server code: ${specifier} (R6)`);
  }
  if (ref.typeOnly) return problems;

  // R1: relative imports stay in their slice.
  if (specifier.startsWith('.')) {
    const sameSlice =
      (here.slice === target.slice && here.slice !== 'feature' && here.slice !== 'platform') ||
      (here.slice === 'platform' && target.slice === 'platform') ||
      (here.slice === 'feature' && target.slice === 'feature' && here.feature === target.feature);
    const securityList =
      as === 'src/platform/proxy/public-routes.ts' && targetPath === 'security/public-routes.json';
    if (!sameSlice && !securityList)
      problems.push(`a relative import leaves its slice (${specifier}); use the @/ alias (R1)`);
  }

  // R2: slice matrix.
  switch (here.slice) {
    case 'kernel':
      if (target.slice !== 'kernel')
        problems.push(`kernel imports nothing outside itself: ${specifier} (R2)`);
      break;
    case 'ui':
      if (pkg !== undefined && !UI_PACKAGES.has(pkg))
        problems.push(
          `src/ui uses ${pkg}; it may use React, Base UI, lucide and its own helpers (R2)`,
        );
      if (pkg === 'next' && !UI_NEXT.has(specifier))
        problems.push(
          `src/ui may use next/link, next/form and next/navigation only: ${specifier} (R2)`,
        );
      if (target.slice !== 'external' && target.slice !== 'ui' && target.slice !== 'kernel')
        problems.push(`src/ui imports only kernel and ui: ${specifier} (R2)`);
      break;
    case 'platform':
      if (target.slice === 'feature' || target.slice === 'app' || target.slice === 'ui')
        problems.push(`platform never imports features, app or ui: ${specifier} (R2)`);
      break;
    case 'feature':
    case 'app':
    case 'root':
      problems.push(...checkConsumer(specifier, as, here, target, targetPath));
      break;
    case 'external':
    case 'other':
      break;
  }

  // R4: inside one feature.
  if (here.slice === 'feature' && target.slice === 'feature' && here.feature === target.feature) {
    const allowed = LAYERS[here.layer];
    if (!allowed.includes(target.layer))
      problems.push(`${here.layer} may not import ${target.layer} (${specifier}) (R4)`);
  }
  return problems;
}

/** Features, app routes and src/proxy.ts / instrumentation.ts importing platform and features. */
function checkConsumer(
  specifier: string,
  as: string,
  here: Where,
  target: Where,
  targetPath: string | undefined,
): string[] {
  const problems: string[] = [];
  if (target.slice === 'platform') {
    const deepAllowed = targetPath !== undefined && DEEP_PLATFORM_ALLOWED[as] === targetPath;
    if (target.deep && !deepAllowed)
      problems.push(`import the platform entry @/platform/${target.entry}, not ${specifier} (R2)`);
    const users = ENTRY_USERS[target.entry];
    if (!deepAllowed && !users?.(here, as))
      problems.push(`@/platform/${target.entry} is not for this file (R2)`);
  }
  if (target.slice === 'feature') {
    const sameFeature = here.slice === 'feature' && here.feature === target.feature;
    if (!sameFeature) {
      if (target.entry === 'deep')
        problems.push(
          `reach another feature through @/features/${target.feature} or @/features/${target.feature}/server only (R3)`,
        );
      if (here.slice === 'feature') {
        const dependsOn = byName.get(here.feature)?.dependsOn ?? [];
        if (!dependsOn.includes(target.feature))
          problems.push(
            `${here.feature} does not list ${target.feature} in dependsOn (features.json) (R3)`,
          );
      }
    }
  }
  if (here.slice === 'root' && target.slice !== 'platform' && target.slice !== 'external')
    problems.push(`src/${here.file}.ts only wires the platform (R2)`);
  return problems;
}

/** A cycle in features.json dependsOn, as the path that closes it. */
export function dependencyCycle(
  graph: ReadonlyMap<string, readonly string[]>,
): string[] | undefined {
  const state = new Map<string, 'open' | 'done'>();
  const path: string[] = [];
  const visit = (node: string): string[] | undefined => {
    if (state.get(node) === 'done') return undefined;
    if (state.get(node) === 'open') return [...path.slice(path.indexOf(node)), node];
    state.set(node, 'open');
    path.push(node);
    for (const next of graph.get(node) ?? []) {
      const found = visit(next);
      if (found) return found;
    }
    path.pop();
    state.set(node, 'done');
    return undefined;
  };
  for (const node of graph.keys()) {
    const found = visit(node);
    if (found) return found;
  }
  return undefined;
}

function checkRegistry(read: (path: string) => SourceFile | undefined): string[] {
  const problems: string[] = [];
  const featuresDir = join(ROOT, 'src/features');
  const folders = existsSync(featuresDir)
    ? readdirSync(featuresDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];
  for (const folder of folders) {
    if (!registry.features.some((f) => f.dir === `src/features/${folder}`))
      problems.push(
        `src/features/${folder}: not listed in features.json (pnpm new:feature registers features) (R12)`,
      );
  }
  const nav = read(join(ROOT, 'src/app/_shell/nav.ts'));
  const navImports = new Set(nav ? importsOf(nav).map((i) => i.specifier) : []);
  for (const feature of registry.features) {
    for (const file of ['index.ts', 'server.ts']) {
      if (!existsSync(join(ROOT, feature.dir, file)))
        problems.push(`${feature.dir}/${file}: every feature has a public ${file} (R12)`);
    }
    if (!navImports.has(`@/features/${feature.name}`))
      problems.push(`src/app/_shell/nav.ts: does not import ${feature.name}'s nav (R12)`);
    for (const dependency of feature.dependsOn) {
      if (!byName.has(dependency))
        problems.push(
          `features.json: ${feature.name} depends on unknown feature ${dependency} (R12)`,
        );
    }
  }
  const cycle = dependencyCycle(new Map(registry.features.map((f) => [f.name, f.dependsOn])));
  if (cycle) problems.push(`features.json: dependsOn forms a cycle: ${cycle.join(' -> ')} (R3)`);
  return problems;
}

if (import.meta.main) {
  const problems = withProjects((read) => {
    const found: string[] = [...checkRegistry(read)];
    for (const root of ['src', 'templates/feature/feature', 'templates/feature/routes']) {
      for (const path of files(join(ROOT, root))) {
        const file = repoPath(path);
        if (file.startsWith('src/platform/api/generated/')) continue;
        const source = read(path);
        if (!source) {
          found.push(`${file}: not part of a tsconfig project, so check-boundaries cannot read it`);
          continue;
        }
        found.push(...checkFile(file, source));
      }
    }
    if (
      dependencyCycle(
        new Map([
          ['a', ['b']],
          ['b', ['a']],
        ]),
      )?.join(' ') !== 'a b a'
    )
      found.push('check-boundaries self-test: a cycle is not found');
    found.push(
      ...selfTest('check-boundaries', 'tests/probes/boundaries', read, (shown, source, as) =>
        checkFile(shown, source, as),
      ),
    );
    return found;
  });
  report(
    'check-boundaries',
    problems,
    `${registry.features.length} feature(s); slices, layers, the client boundary and API ownership hold`,
  );
}

function withProjects<T>(use: (read: (path: string) => SourceFile | undefined) => T): T {
  return withSources(
    ['tsconfig.json', 'templates/feature/tsconfig.json', 'tests/probes/tsconfig.json'],
    use,
  );
}
