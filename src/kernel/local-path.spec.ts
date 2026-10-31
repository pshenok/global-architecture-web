import { describe, expect, it } from 'vitest';
import { localPath } from './local-path';

describe('localPath', () => {
  it('keeps paths on this site, normalized', () => {
    expect(localPath('/bookings?as=host')).toBe('/bookings?as=host');
    expect(localPath('/houses/1#top')).toBe('/houses/1#top');
    expect(localPath('/a/../b')).toBe('/b');
    expect(localPath('/%5Cevil')).toBe('/%5Cevil');
  });

  it.each([
    undefined,
    null,
    '',
    'bookings',
    '//evil.test',
    '/\\evil.test',
    '/\t/evil.test',
    '/\n/evil.test',
    '/\r//evil.test',
    '/\u0000x',
    '/\u007fx',
    'https://evil.test/x',
    'javascript:alert(1)',
    `/${'a'.repeat(2048)}`,
  ])('refuses %j', (value) => {
    expect(localPath(value)).toBeUndefined();
  });
});
