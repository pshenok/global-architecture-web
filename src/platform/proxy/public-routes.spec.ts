import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classify, compileRoute, createClassifier } from './public-routes';

const UUID = '01890a5d-ac96-774b-bcce-b302099a8057';

/** Every page and route handler in src/app, as a URL with its dynamic segments filled in. */
function appRoutes(): string[] {
  const root = join(import.meta.dirname, '../../app');
  const found: string[] = [];
  for (const file of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    if (!/(^|\/)(page\.tsx|route\.ts)$/.test(file.split(sep).join('/'))) continue;
    const segments = relative(root, join(root, file)).split(sep).slice(0, -1);
    const url = segments
      .filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('_'))
      .map((s) => (s.startsWith('[') ? UUID : s))
      .join('/');
    found.push(`/${url}`);
  }
  return found;
}

describe('public routes', () => {
  it('lets only the listed routes through without a session', () => {
    expect(classify('/houses')).toBe('public');
    expect(classify(`/houses/${UUID}`)).toBe('public');
    expect(classify('/houses/new')).toBe('session');
    expect(classify(`/houses/${UUID}/edit`)).toBe('session');
    expect(classify('/bookings')).toBe('session');
    expect(classify('/admin/users')).toBe('session');
    expect(classify('/register')).toBe('session');
    expect(classify('/houses/%E0%A4%A')).toBe('session');
  });

  it('classifies every route in src/app, and only the listed ones are public', () => {
    const publicRoutes = appRoutes().filter((route) => classify(route) === 'public');
    expect(publicRoutes.sort()).toEqual(
      [
        '/auth/callback',
        '/auth/error',
        '/auth/login',
        '/auth/logout',
        '/healthz',
        '/houses',
        `/houses/${UUID}`,
      ].filter((route) => appRoutes().includes(route)),
    );
  });

  it('refuses catch-all and malformed patterns', () => {
    expect(() => compileRoute('/docs/[...slug]')).toThrow('catch-all');
    expect(() => compileRoute('houses')).toThrow();
    expect(() => compileRoute('/houses/[id:int]')).toThrow();
    expect(createClassifier([{ route: '/a/[x]', reason: 't' }])('/a/anything')).toBe('public');
  });
});
