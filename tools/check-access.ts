/**
 * Access and caching guardrail (ADR-0003, ADR-0006), run by `pnpm lint`. Reads the code
 * with the TypeScript 7 parser.
 *
 * S1  security/public-routes.json matches src/app: every listed route exists, patterns
 *     compile, and route handlers list exactly the methods they export.
 * S2  Route handlers exist only at auth/{login,callback} (GET), auth/logout (POST) and
 *     healthz (GET), each a thin wrapper of @/platform/auth or @/platform/health that
 *     exports nothing but its methods.
 * S3  src/proxy.ts exports `proxy` calling runProxy, with the pinned matcher literal.
 * S4  'use server' only opens a feature's actions.ts; every export there is
 *     `export const x = defineAction({ access: '<literal>', ... })` with defineAction
 *     imported by name from @/platform/actions; no inline 'use server' (anywhere in a
 *     directive prologue); actions.ts imports neither next/navigation, next/cache,
 *     next/headers nor @/platform/api (outcomes and gateways do that).
 * S5  No cross-request caching: no 'use cache', unstable_cache, cacheTag, cacheLife,
 *     revalidateTag, updateTag, fetch cache options or segment config exports;
 *     revalidatePath only in platform/actions/define-action.ts.
 * S6  No loading.tsx in or above a dynamic segment's page (a 404 must be a real 404).
 * S7  No NEXT_PUBLIC_ anything: nothing configuration-like reaches the browser bundle.
 * S8  Token fields (at, rt, idt, accessToken, refreshToken, idToken) are read only inside
 *     platform/{session,auth,api,proxy}: by property access, element access or
 *     destructuring.
 * S9  No forbidden(), unauthorized() or taint APIs; in features, notFound and redirect are
 *     imported only by views/ and server.ts.
 * S10 No @ts-ignore, @ts-expect-error or @ts-nocheck outside tests, and no suppression of
 *     the any-rules or the import rules.
 *
 * Every run first checks itself on tests/probes/access (see tools/source.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.ts';
import {
  directivesOf,
  exportedNames,
  files,
  importsOf,
  lineOf,
  type Node,
  repoPath,
  report,
  type SourceFile,
  SyntaxKind,
  selfTest,
  textOf,
  withSources,
} from './source.ts';

export const PINNED_MATCHER = '/((?!_next/|favicon\\.ico|icon\\.svg|robots\\.txt).*)';
const HANDLERS: Readonly<Record<string, { methods: readonly string[]; from: string }>> = {
  'src/app/auth/login/route.ts': { methods: ['GET'], from: '@/platform/auth' },
  'src/app/auth/callback/route.ts': { methods: ['GET'], from: '@/platform/auth' },
  'src/app/auth/logout/route.ts': { methods: ['POST'], from: '@/platform/auth' },
  'src/app/healthz/route.ts': { methods: ['GET'], from: '@/platform/health' },
};
const HTTP_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const CACHE_APIS = new Set([
  'unstable_cache',
  'cacheTag',
  'cacheLife',
  'revalidateTag',
  'updateTag',
  'unstable_cacheTag',
  'unstable_cacheLife',
]);
const SEGMENT_CONFIG = new Set([
  'dynamic',
  'revalidate',
  'fetchCache',
  'runtime',
  'dynamicParams',
  'preferredRegion',
  'maxDuration',
]);
const TOKEN_FIELDS = new Set(['at', 'rt', 'idt', 'accessToken', 'refreshToken', 'idToken']);
const TOKEN_OWNERS = /^src\/platform\/(session|auth|api|proxy)\//;
const isSpec = (file: string) => /\.spec\.tsx?$/.test(file) || file.startsWith('tests/');
const isActionsFile = (file: string) =>
  /^src\/features\/[^/]+\/actions\.ts$/.test(file) ||
  file === 'templates/feature/feature/actions.ts';
const isFeature = (file: string) =>
  file.startsWith('src/features/') || file.startsWith('templates/feature/feature/');

/**
 * `export const camelCase = defineAction({ access: '<identity|user|admin>', ... })`: one
 * const declarator, a direct call with one object literal whose `access` is a literal.
 */
function isActionExport(statement: Node, source: SourceFile): boolean {
  if (statement.kind !== SyntaxKind.VariableStatement) return false;
  const list = (
    statement as unknown as { declarationList: Node & { declarations: readonly Node[] } }
  ).declarationList;
  if (!/^const\b/.test(list.getText(source)) || list.declarations.length !== 1) return false;
  const declaration = list.declarations[0] as unknown as {
    name: Node;
    initializer?: Node & { expression?: Node; arguments?: readonly Node[] };
  };
  if (!/^[a-z][A-Za-z0-9]*$/.test(declaration.name.getText(source))) return false;
  const call = declaration.initializer;
  if (
    call?.kind !== SyntaxKind.CallExpression ||
    call.expression?.getText(source) !== 'defineAction' ||
    call.arguments?.length !== 1
  ) {
    return false;
  }
  const spec = call.arguments[0] as Node & {
    properties?: readonly (Node & { name?: Node; initializer?: Node })[];
  };
  if (spec.kind !== SyntaxKind.ObjectLiteralExpression) return false;
  const access = spec.properties?.find(
    (p) => p.kind === SyntaxKind.PropertyAssignment && p.name?.getText(source) === 'access',
  );
  return (
    access?.initializer?.kind === SyntaxKind.StringLiteral &&
    ['identity', 'user', 'admin'].includes(textOf(access.initializer) ?? '')
  );
}

export function checkFile(file: string, source: SourceFile, as = file): string[] {
  const problems: string[] = [];
  const at = (node: Node) => `${file}:${lineOf(source, node)}`;
  const spec = isSpec(as);
  const imports = importsOf(source);

  // S10: compiler and linter suppressions.
  source.text.split('\n').forEach((text, index) => {
    if (!spec && /@ts-(ignore|expect-error|nocheck)\b/.test(text))
      problems.push(
        `${file}:${index + 1}: no @ts-ignore/@ts-expect-error/@ts-nocheck in production code (S10)`,
      );
    if (
      /biome-ignore[^:]*:?.*\b(noExplicitAny|noRestrictedImports|noImportCycles|noProcessEnv|noDangerouslySetInnerHtml)\b/.test(
        text,
      )
    ) {
      problems.push(`${file}:${index + 1}: this rule is not suppressed; change the code (S10)`);
    }
    if (/oxlint-disable[^\n]*no-unsafe-|eslint-disable[^\n]*no-unsafe-/.test(text))
      problems.push(`${file}:${index + 1}: the any-rules are not suppressed (S10)`);
  });

  // S4: 'use server' placement and shape.
  const directives = directivesOf(source.statements);
  const useServer = directives.find((d) => d.text === 'use server');
  if (useServer && !isActionsFile(as))
    problems.push(`${at(useServer.node)}: 'use server' only opens a feature's actions.ts (S4)`);
  for (const cache of directives.filter((d) => d.text.startsWith('use cache')))
    problems.push(`${at(cache.node)}: no 'use cache' (S5)`);
  if (isActionsFile(as)) {
    if (directives[0]?.text !== 'use server')
      problems.push(
        `${source.statements[0] ? at(source.statements[0]) : `${file}:1`}: actions.ts starts with 'use server' (S4)`,
      );
    for (const ref of imports) {
      if (
        ['next/navigation', 'next/cache', 'next/headers', '@/platform/api'].includes(ref.specifier)
      ) {
        problems.push(
          `${at(ref.node)}: actions.ts does not import ${ref.specifier}; return an outcome, call a gateway (S4)`,
        );
      }
    }
    for (const statement of source.statements) {
      if (!/^export\b/.test(statement.getText(source))) continue;
      if (!isActionExport(statement, source)) {
        problems.push(
          `${at(statement)}: actions.ts exports only \`export const x = defineAction({ access: '<identity|user|admin>', ... })\`, one per statement (S4)`,
        );
      }
    }
    // The name is the platform's defineAction: imported by name, never declared or renamed.
    const checkName = (node: Node): void => {
      if (node.kind === SyntaxKind.Identifier && node.getText(source) === 'defineAction') {
        const parent = (
          node as unknown as { parent: Node & { expression?: Node; propertyName?: Node } }
        ).parent;
        const called = parent.kind === SyntaxKind.CallExpression && parent.expression === node;
        const declaration = (
          parent as unknown as {
            parent?: { parent?: { parent?: Node & { moduleSpecifier?: Node } } };
          }
        ).parent?.parent?.parent;
        const imported =
          parent.kind === SyntaxKind.ImportSpecifier &&
          parent.propertyName === undefined &&
          declaration?.kind === SyntaxKind.ImportDeclaration &&
          textOf(declaration.moduleSpecifier) === '@/platform/actions';
        if (!called && !imported)
          problems.push(
            `${at(node)}: defineAction is imported by name from @/platform/actions, never declared or renamed (S4)`,
          );
      }
      node.forEachChild(checkName);
    };
    source.forEachChild(checkName);
  }

  const visit = (node: Node): void => {
    // S4: no inline 'use server' (closures would round-trip through the client).
    if (node.kind === SyntaxKind.Block) {
      for (const d of directivesOf(
        (node as unknown as { statements: readonly Node[] }).statements,
      )) {
        if (d.text === 'use server')
          problems.push(`${at(d.node)}: no inline 'use server'; actions live in actions.ts (S4)`);
        if (d.text.startsWith('use cache')) problems.push(`${at(d.node)}: no 'use cache' (S5)`);
      }
    }
    // S7: nothing NEXT_PUBLIC_, as a name or a string.
    if (
      (node.kind === SyntaxKind.Identifier || node.kind === SyntaxKind.StringLiteral) &&
      !spec &&
      node.getText(source).includes('NEXT_PUBLIC_')
    ) {
      problems.push(
        `${at(node)}: no NEXT_PUBLIC_ variables: configuration stays on the server (S7)`,
      );
    }
    // S5: cache APIs (by name, however imported) and fetch cache options.
    if (node.kind === SyntaxKind.Identifier && !spec) {
      const name = node.getText(source);
      if (CACHE_APIS.has(name))
        problems.push(`${at(node)}: no ${name}: nothing is cached across requests (S5)`);
      if (name === 'revalidatePath' && as !== 'src/platform/actions/define-action.ts')
        problems.push(
          `${at(node)}: revalidatePath only in defineAction (an outcome's shell: 'stale') (S5)`,
        );
    }
    if (node.kind === SyntaxKind.PropertyAssignment && !spec) {
      const key = (node as unknown as { name: Node }).name.getText(source);
      if (key === 'next') problems.push(`${at(node)}: no fetch cache options (S5)`);
    }
    // S8: token fields.
    if (node.kind === SyntaxKind.PropertyAccessExpression && !spec && !TOKEN_OWNERS.test(as)) {
      const access = node as unknown as { name: Node; parent: Node };
      const name = access.name.getText(source);
      const called =
        access.parent.kind === SyntaxKind.CallExpression &&
        (access.parent as unknown as { expression: Node }).expression === node;
      if (TOKEN_FIELDS.has(name) && !called)
        problems.push(
          `${at(node)}: tokens are read only inside platform/{session,auth,api,proxy} (S8)`,
        );
    }
    if (!spec && !TOKEN_OWNERS.test(as)) {
      let key: string | undefined;
      if (node.kind === SyntaxKind.ElementAccessExpression)
        key = textOf((node as unknown as { argumentExpression: Node }).argumentExpression);
      if (node.kind === SyntaxKind.BindingElement) {
        const element = node as unknown as { parent: Node; propertyName?: Node; name: Node };
        if (element.parent.kind === SyntaxKind.ObjectBindingPattern)
          key = (element.propertyName ?? element.name).getText(source);
      }
      if (key !== undefined && TOKEN_FIELDS.has(key))
        problems.push(
          `${at(node)}: tokens are read only inside platform/{session,auth,api,proxy} (S8)`,
        );
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);

  // S2: a route handler exports its methods and nothing else.
  const handler = HANDLERS[as];
  if (handler) {
    for (const { name, node } of exportedNames(source)) {
      if (!handler.methods.includes(name))
        problems.push(`${at(node)}: ${as} exports only ${handler.methods.join(', ')} (S2)`);
    }
  }

  // S5: segment config exports.
  for (const statement of source.statements) {
    const text = statement.getText(source);
    const exported = /^export\s+(?:const|let|var)\s+(\w+)/.exec(text)?.[1];
    if (
      exported &&
      SEGMENT_CONFIG.has(exported) &&
      /^(src\/app|templates\/feature\/routes)\//.test(as)
    ) {
      problems.push(
        `${at(statement)}: no segment config export (${exported}); every route renders per request (S5)`,
      );
    }
  }

  // S9
  for (const ref of imports) {
    if (
      ref.specifier === 'next/navigation' &&
      ref.names.some((n) => n === 'forbidden' || n === 'unauthorized')
    ) {
      problems.push(
        `${at(ref.node)}: no forbidden()/unauthorized(): a 403 is shown as not found (S9)`,
      );
    }
    if (ref.names.some((n) => n.startsWith('experimental_taint')))
      problems.push(`${at(ref.node)}: no taint APIs (S9)`);
    if (
      isFeature(as) &&
      !spec &&
      ref.specifier === 'next/navigation' &&
      ref.names.some((n) => n === 'notFound' || n === 'redirect')
    ) {
      const layer = /\/(views)\//.test(as) || /\/server\.ts$/.test(as);
      if (!layer)
        problems.push(
          `${at(ref.node)}: in features, only views/ and server.ts interrupt (notFound, redirect) (S9)`,
        );
    }
  }
  return problems;
}

interface ListedRoute {
  readonly route: string;
  readonly methods?: readonly string[];
  readonly reason: string;
}

/** The URL pattern of an app file: src/app/houses/[id]/page.tsx -> /houses/[id]. */
function routeOf(file: string): string {
  const segments = file
    .replace(/^src\/app\//, '')
    .split('/')
    .slice(0, -1)
    .filter((s) => !/^\(.*\)$/.test(s));
  return `/${segments.join('/')}`;
}

function checkRoutes(read: (path: string) => SourceFile | undefined): string[] {
  const problems: string[] = [];
  const app = join(ROOT, 'src/app');
  const all = [...files(app, /\.(ts|tsx|js|jsx|mjs|cjs)$/)].map(repoPath);
  const pages = all.filter((f) => /\/page\.[jt]sx?$/.test(f));
  const handlers = all.filter((f) => /\/route\.[jt]sx?$/.test(f));
  const listed = (
    JSON.parse(readFileSync(join(ROOT, 'security/public-routes.json'), 'utf8')) as {
      routes: ListedRoute[];
    }
  ).routes;

  // Every file Next bundles must be readable by the guardrails: TypeScript only.
  for (const root of ['src', 'templates/feature']) {
    for (const path of files(join(ROOT, root), /\.(js|jsx|mjs|cjs)$/)) {
      problems.push(
        `${repoPath(path)}: TypeScript only under ${root}; the guardrails do not read JavaScript (S2)`,
      );
    }
  }

  // S1
  const known = new Map([...pages, ...handlers].map((f) => [routeOf(f), f]));
  for (const entry of listed) {
    const plain = entry.route.replace(/\[(\w+):uuid\]/g, '[$1]');
    const file = known.get(plain);
    if (!entry.reason?.trim())
      problems.push(`security/public-routes.json: ${entry.route} needs a reason (S1)`);
    if (!file) {
      problems.push(
        `security/public-routes.json: ${entry.route} is not a page or route handler in src/app (S1)`,
      );
      continue;
    }
    if (/\/route\.[jt]sx?$/.test(file)) {
      const exported = exportedMethods(read(join(ROOT, file)));
      if (JSON.stringify([...(entry.methods ?? [])].sort()) !== JSON.stringify(exported.sort())) {
        problems.push(
          `security/public-routes.json: ${entry.route} lists ${entry.methods?.join(', ') ?? 'no methods'}, ${file} exports ${exported.join(', ') || 'none'} (S1)`,
        );
      }
    }
  }

  // S2
  for (const handler of handlers) {
    const expected = HANDLERS[handler];
    if (!expected) {
      problems.push(
        `${handler}: route handlers exist only for auth and healthz; a page or a Server Action does the rest (S2)`,
      );
      continue;
    }
    const source = read(join(ROOT, handler));
    const exported = exportedMethods(source);
    if (JSON.stringify(exported.sort()) !== JSON.stringify([...expected.methods].sort()))
      problems.push(
        `${handler}: exports ${exported.join(', ')}; expected ${expected.methods.join(', ')} (S2)`,
      );
    const imported = source ? importsOf(source).map((i) => i.specifier) : [];
    if (imported.some((s) => s !== expected.from))
      problems.push(`${handler}: a thin wrapper imports only ${expected.from} (S2)`);
  }

  // S6
  for (const loading of all.filter((f) => /\/loading\.[jt]sx?$/.test(f))) {
    const dir = loading.replace(/\/loading\.[jt]sx?$/, '');
    if (
      pages.some((page) => page.startsWith(`${dir}/`) && /\[[^\]]+\]/.test(page.slice(dir.length)))
    ) {
      problems.push(
        `${loading}: a loading.tsx above a dynamic page streams before its lookup, so a 404 answers 200 (S6)`,
      );
    }
    if (/\[[^\]]+\]/.test(dir))
      problems.push(`${loading}: no loading.tsx in a dynamic segment (S6)`);
  }
  return problems;
}

function exportedMethods(source: SourceFile | undefined): string[] {
  if (!source) return [];
  return exportedNames(source)
    .map(({ name }) => name)
    .filter((name) => HTTP_METHODS.has(name));
}

/** S3: the proxy file and its matcher. */
function checkProxy(read: (path: string) => SourceFile | undefined): string[] {
  const problems: string[] = [];
  const source = read(join(ROOT, 'src/proxy.ts'));
  if (!source)
    return ['src/proxy.ts: missing; Next silently runs without a proxy when it is misplaced (S3)'];
  const text = source.text;
  if (
    !/export\s+function\s+proxy\s*\(\s*request:\s*NextRequest\s*\)\s*\{\s*return\s+runProxy\(request\);\s*\}/.test(
      text,
    )
  ) {
    problems.push(
      'src/proxy.ts: exports `function proxy(request: NextRequest) { return runProxy(request); }` only (S3)',
    );
  }
  const matcher = /matcher:\s*\[\s*'([^']*)'\s*\]/.exec(text)?.[1]?.replace(/\\\\/g, '\\');
  if (matcher !== PINNED_MATCHER)
    problems.push(`src/proxy.ts: the matcher is pinned to ['${PINNED_MATCHER}'] (S3)`);
  return problems;
}

if (import.meta.main) {
  const problems = withSources(
    ['tsconfig.json', 'templates/feature/tsconfig.json', 'tests/probes/tsconfig.json'],
    (read) => {
      const found: string[] = [...checkRoutes(read), ...checkProxy(read)];
      for (const root of ['src', 'templates/feature/feature', 'templates/feature/routes']) {
        for (const path of files(join(ROOT, root))) {
          const file = repoPath(path);
          if (file.startsWith('src/platform/api/generated/')) continue;
          const source = read(path);
          if (!source) {
            found.push(`${file}: not part of a tsconfig project, so check-access cannot read it`);
            continue;
          }
          found.push(...checkFile(file, source));
        }
      }
      found.push(
        ...selfTest('check-access', 'tests/probes/access', read, (shown, source, as) =>
          checkFile(shown, source, as),
        ),
      );
      return found;
    },
  );
  report(
    'check-access',
    problems,
    'public routes, route handlers, the proxy, Server Actions, caching and tokens are as declared',
  );
}
