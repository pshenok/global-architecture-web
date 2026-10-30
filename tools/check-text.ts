/**
 * Text guardrail, run by `pnpm lint`:
 * - no emoji (Extended_Pictographic) anywhere people read: src, templates, tests,
 *   plugins, docs, README; product UI uses lucide vector icons (the copyright, registered
 *   and trademark signs are allowed);
 * - no raw Tailwind palette classes (bg-red-500) in features or the feature template:
 *   they use the design tokens (bg-destructive, text-muted-foreground) so both color
 *   schemes and every theme stay right.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.ts';
import { files, repoPath, report } from './source.ts';

const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const ALLOWED = new Set(['©', '®', '™']);
const PALETTE =
  /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|decoration|shadow|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b/;

export function textProblems(file: string, text: string): string[] {
  const problems: string[] = [];
  text.split('\n').forEach((line, index) => {
    for (const char of line) {
      if (PICTOGRAPHIC.test(char) && !ALLOWED.has(char)) {
        problems.push(
          `${file}:${index + 1}: no emoji (U+${char.codePointAt(0)?.toString(16).toUpperCase()}); use a lucide icon in UI, words in text`,
        );
        break;
      }
    }
    if (/^(src\/features|templates\/feature)\//.test(file) && PALETTE.test(line)) {
      problems.push(
        `${file}:${index + 1}: raw palette class ${PALETTE.exec(line)?.[0]}; use a design token (bg-destructive, text-muted-foreground, ...)`,
      );
    }
  });
  return problems;
}

if (import.meta.main) {
  const problems: string[] = [];
  const roots = ['src', 'templates', 'tests', 'plugins', 'docs', 'tools'];
  const paths = [
    ...roots.flatMap((root) => [...files(join(ROOT, root), /\.(ts|tsx|md|json|css)$/)]),
    join(ROOT, 'README.md'),
    join(ROOT, 'AGENTS.md'),
  ];
  for (const path of paths) {
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    problems.push(...textProblems(repoPath(path), text));
  }
  // Self-test: the rules still catch what they are for.
  if (textProblems('src/features/x/ui/a.tsx', 'className="bg-red-500"').length !== 1)
    problems.push('check-text self-test: a palette class is not caught');
  if (textProblems('docs/a.md', 'done \u{1F680}').length !== 1)
    problems.push('check-text self-test: an emoji is not caught');
  if (textProblems('docs/a.md', '© 2026').length !== 0)
    problems.push('check-text self-test: the copyright sign is refused');
  report(
    'check-text',
    problems,
    `${paths.length} file(s): no emoji, design tokens only in features`,
  );
}
