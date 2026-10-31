import { describe, expect, it } from 'vitest';
import { DEFAULT_RETURN_TO, safeReturnTo } from './return-to';

describe('safeReturnTo', () => {
  it('keeps same-origin paths with their query', () => {
    expect(safeReturnTo('/bookings?as=host')).toBe('/bookings?as=host');
    expect(safeReturnTo('/houses/1')).toBe('/houses/1');
    // An encoded backslash stays a path on this origin.
    expect(safeReturnTo('/%5Cevil')).toBe('/%5Cevil');
  });

  it.each([
    null,
    '',
    'bookings',
    '//evil.test',
    '/\\evil.test',
    '/\tevil',
    'https://evil.test/x',
    'javascript:alert(1)',
    `/${'a'.repeat(2048)}`,
    '/auth/logout',
    '/\t/evil.test',
  ])('falls back to the catalogue for %s', (value) => {
    expect(safeReturnTo(value)).toBe(DEFAULT_RETURN_TO);
  });
});
