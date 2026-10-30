import axe from 'axe-core';
import { expect } from 'vitest';

/** WCAG 2.2 AA checks (contrast included: the browser project loads the real CSS). */
export async function expectAccessible(element: Element = document.body): Promise<void> {
  const result = await axe.run(element, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  });
  expect(
    result.violations.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
    ),
  ).toEqual([]);
}
