import axe from 'axe-core';
import { expect } from 'vitest';

/** WCAG 2.2 AA checks (contrast included: the browser project loads the real CSS). */
export async function expectAccessible(element: Element = document.body): Promise<void> {
  // Measure the settled page: a dialog fading in has not reached its final contrast yet.
  await Promise.all(
    document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
  );
  const result = await axe.run(element, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  });
  expect(
    result.violations.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
    ),
  ).toEqual([]);
}
