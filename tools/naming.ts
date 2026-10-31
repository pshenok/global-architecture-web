/**
 * Names of a noun in every form the templates use, the same way as
 * global-architecture-monolith's tools/new-module.ts, so a module and its feature match
 * (`pnpm new:module review` there, `pnpm new:feature review` here).
 */
export const KEBAB = /^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/;

export function pluralize(word: string): string {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export interface Forms {
  readonly kebab: string;
  readonly snake: string;
  readonly camel: string;
  readonly pascal: string;
  readonly upper: string;
  readonly spaced: string;
  /** "Sample items": sentence case for UI text. */
  readonly sentence: string;
}

export const forms = (words: readonly string[]): Forms => ({
  kebab: words.join('-'),
  snake: words.join('_'),
  camel: (words[0] as string) + words.slice(1).map(capitalize).join(''),
  pascal: words.map(capitalize).join(''),
  upper: words.join('_').toUpperCase(),
  spaced: words.join(' '),
  sentence: capitalize(words.join(' ')),
});

/** Words the template's identifiers (`const sampleItem`, `sampleItems`) cannot take. */
export const RESERVED = new Set(
  (
    'arguments await break case catch class const continue debugger default delete do else ' +
    'enum eval export extends false finally for function if implements import in instanceof ' +
    'interface let new null package private protected public return static super switch this ' +
    'throw true try typeof var void while with yield'
  ).split(' '),
);

export const TEMPLATE = { singular: forms(['sample', 'item']), plural: forms(['sample', 'items']) };

/** sample-items -> the given noun, every form; plural forms first (they contain the singular). */
export function substitution(singular: Forms, plural: Forms): (text: string) => string {
  const keys = ['kebab', 'snake', 'camel', 'pascal', 'upper', 'sentence', 'spaced'] as const;
  const pairs: [string, string][] = [
    ...keys.map((key): [string, string] => [TEMPLATE.plural[key], plural[key]]),
    ...keys.map((key): [string, string] => [TEMPLATE.singular[key], singular[key]]),
  ];
  return (text) => pairs.reduce((out, [from, to]) => out.split(from).join(to), text);
}

export function nounForms(
  noun: string,
  pluralOverride?: string,
): { singular: Forms; plural: Forms } {
  if (!KEBAB.test(noun)) throw new Error('the noun is kebab-case, e.g. review or payment-method');
  if (pluralOverride !== undefined && !KEBAB.test(pluralOverride))
    throw new Error('--plural is kebab-case');
  const words = noun.split('-');
  const pluralWords = pluralOverride
    ? pluralOverride.split('-')
    : [...words.slice(0, -1), pluralize(words.at(-1) as string)];
  const singular = forms(words);
  const plural = forms(pluralWords);
  if (plural.kebab === singular.kebab)
    throw new Error('the plural must differ from the noun: pass --plural');
  for (const word of [singular.camel, plural.camel]) {
    if (RESERVED.has(word))
      throw new Error(`"${word}" is a reserved word in JavaScript: pick another noun`);
  }
  return { singular, plural };
}
