/**
 * Reads code for the guardrails (check-boundaries, check-access) with the TypeScript 7
 * parser through tsconfig projects, so they see exactly what the compiler sees.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  type CallExpression,
  type ExportDeclaration,
  type ImportDeclaration,
  type ImportSpecifier,
  type Node,
  type SourceFile,
  type StringLiteral,
  SyntaxKind,
} from 'typescript/unstable/ast';
import { API } from 'typescript/unstable/sync';
import { ROOT } from './lib.ts';

export type { Node, SourceFile };
export { SyntaxKind };

/** Repository-relative, forward slashes. */
export const repoPath = (path: string) => relative(ROOT, path).split(sep).join('/');

const SKIP = new Set(['node_modules', '.next', 'coverage', 'test-results', 'playwright-report']);

export function* files(dir: string, extensions = /\.(ts|tsx)$/): Generator<string> {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path, extensions);
    else if (extensions.test(entry.name)) yield path;
  }
}

/** Opens the given tsconfig projects and hands a reader for their files to `use`. */
export function withSources<T>(
  configs: readonly string[],
  run: (read: (path: string) => SourceFile | undefined) => T,
): T {
  const api = new API({ cwd: ROOT });
  try {
    const snapshot = api.updateSnapshot({
      openProjects: configs.map((c) => join(ROOT, c)).filter((c) => existsSync(c)),
    });
    return run((path) => snapshot.getDefaultProjectForFile(path)?.program.getSourceFile(path));
  } finally {
    api.close();
  }
}

export const lineOf = (source: SourceFile, node: Node) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

export const textOf = (node: Node | undefined): string | undefined =>
  node &&
  (node.kind === SyntaxKind.StringLiteral || node.kind === SyntaxKind.NoSubstitutionTemplateLiteral)
    ? (node as StringLiteral).text
    : undefined;

export interface ImportRef {
  readonly specifier: string;
  /** `import`, `export ... from`, or `import()`. */
  readonly kind: 'import' | 'export' | 'dynamic';
  /** Erased at compile time: `import type`, or only `type` specifiers. */
  readonly typeOnly: boolean;
  /** Imported names (`default`, `*`, or the exported name). */
  readonly names: readonly string[];
  readonly node: Node;
}

/** Every module a file names: import, export ... from, and import(). */
export function importsOf(source: SourceFile): ImportRef[] {
  const found: ImportRef[] = [];
  const visit = (node: Node): void => {
    if (node.kind === SyntaxKind.ImportDeclaration) {
      const declaration = node as ImportDeclaration;
      const specifier = textOf(declaration.moduleSpecifier);
      const clause = declaration.importClause;
      if (specifier !== undefined) {
        const names: string[] = [];
        let typeOnly = clause?.phaseModifier === SyntaxKind.TypeKeyword;
        if (clause && !typeOnly) {
          const bindings = clause.namedBindings as unknown as
            | { kind: SyntaxKind; elements?: readonly ImportSpecifier[] }
            | undefined;
          const hasDefault = clause.name !== undefined;
          if (hasDefault) names.push('default');
          if (bindings?.kind === SyntaxKind.NamespaceImport) names.push('*');
          const elements =
            bindings?.kind === SyntaxKind.NamedImports ? (bindings.elements ?? []) : [];
          for (const element of elements)
            names.push((element.propertyName ?? element.name).getText(source));
          typeOnly =
            !hasDefault &&
            bindings?.kind !== SyntaxKind.NamespaceImport &&
            elements.length > 0 &&
            elements.every((e) => e.isTypeOnly);
        }
        found.push({
          specifier,
          kind: 'import',
          typeOnly,
          names,
          node: declaration.moduleSpecifier,
        });
      }
    } else if (node.kind === SyntaxKind.ExportDeclaration) {
      const declaration = node as ExportDeclaration;
      const specifier = textOf(declaration.moduleSpecifier);
      if (specifier !== undefined) {
        found.push({
          specifier,
          kind: 'export',
          typeOnly: declaration.isTypeOnly,
          names: ['*'],
          node: declaration.moduleSpecifier as Node,
        });
      }
    } else if (node.kind === SyntaxKind.CallExpression) {
      const call = node as CallExpression;
      if (call.expression.kind === SyntaxKind.ImportKeyword) {
        const specifier = textOf(call.arguments[0]);
        found.push({
          specifier: specifier ?? '<computed>',
          kind: 'dynamic',
          typeOnly: false,
          names: ['*'],
          node: call,
        });
      }
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return found;
}

/**
 * The directive prologue of a file or function body: every leading string statement
 * ('use client', 'use server', 'use no memo', ...). Next reads the whole prologue, so a
 * directive counts wherever it sits in it, not only first.
 */
export function directivesOf(statements: readonly Node[]): { text: string; node: Node }[] {
  const found: { text: string; node: Node }[] = [];
  for (const statement of statements) {
    if (statement.kind !== SyntaxKind.ExpressionStatement) break;
    const text = textOf((statement as unknown as { expression: Node }).expression);
    if (text === undefined) break;
    found.push({ text, node: statement });
  }
  return found;
}

/** A named export (`export const`, `export function`), not `export default`. */
const isExported = (node: Node) => {
  const modifiers = (node as unknown as { modifiers?: readonly Node[] }).modifiers ?? [];
  return (
    modifiers.some((m) => m.kind === SyntaxKind.ExportKeyword) &&
    !modifiers.some((m) => m.kind === SyntaxKind.DefaultKeyword)
  );
};

/**
 * Every name a module exports, with its statement: each declarator of an exported
 * variable statement, exported functions and classes, and the names of export lists
 * (`*` for `export * from`). `export default` is left out.
 */
export function exportedNames(source: SourceFile): { name: string; node: Node }[] {
  const found: { name: string; node: Node }[] = [];
  for (const statement of source.statements) {
    const node = statement as unknown as {
      declarationList?: { declarations: readonly { name: Node }[] };
      name?: Node;
      exportClause?: Node & { elements?: readonly { name: Node }[] };
    };
    if (statement.kind === SyntaxKind.ExportDeclaration) {
      const elements = node.exportClause?.elements;
      if (elements)
        for (const e of elements) found.push({ name: e.name.getText(source), node: statement });
      else found.push({ name: '*', node: statement });
    } else if (isExported(statement)) {
      if (node.declarationList)
        for (const d of node.declarationList.declarations)
          found.push({ name: d.name.getText(source), node: statement });
      else if (node.name) found.push({ name: node.name.getText(source), node: statement });
    }
  }
  return found;
}

/** True when the first import of the file is `import 'server-only'`. */
export function startsServerOnly(source: SourceFile): boolean {
  const first = source.statements.find((s) => s.kind === SyntaxKind.ImportDeclaration) as
    | ImportDeclaration
    | undefined;
  return (
    first !== undefined &&
    first.importClause === undefined &&
    textOf(first.moduleSpecifier) === 'server-only' &&
    source.statements[0] === first
  );
}

/**
 * Runs a guardrail over its probes: each probe file says `// as: <virtual path>` on its
 * first line; a line marked `// refused` must be refused, and no other line may be.
 */
export function selfTest(
  name: string,
  probeDir: string,
  read: (path: string) => SourceFile | undefined,
  check: (shown: string, source: SourceFile, as: string) => string[],
): string[] {
  const problems: string[] = [];
  for (const path of files(join(ROOT, probeDir))) {
    const shown = repoPath(path);
    const source = read(path);
    if (!source) {
      problems.push(`${shown}: ${name} self-test probe is not part of tests/probes/tsconfig.json`);
      continue;
    }
    const as = /^\/\/ as: (\S+)/.exec(source.text)?.[1];
    if (!as) {
      problems.push(`${shown}: a probe starts with // as: <virtual path>`);
      continue;
    }
    const refused = new Map<number, string>();
    for (const problem of check(shown, source, as)) {
      const line = Number(/^[^:]+:(\d+):/.exec(problem)?.[1]);
      if (line) refused.set(line, problem);
      else problems.push(`${name} self-test: a probe problem has no line: ${problem}`);
    }
    source.text.split('\n').forEach((text, index) => {
      const line = index + 1;
      const marked = /\/\/ refused\b/.test(text);
      if (marked && !refused.has(line))
        problems.push(`${shown}:${line}: ${name} self-test: this probe is no longer refused`);
      else if (!marked && refused.has(line))
        problems.push(`${name} self-test: refuses a probe marked as fine: ${refused.get(line)}`);
    });
  }
  return problems;
}

export function report(name: string, problems: readonly string[], summary: string): void {
  if (problems.length > 0) {
    console.error(
      `${name}: ${problems.length} problem(s)\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
    process.exit(1);
  }
  console.log(`${name}: ${summary}`);
}
