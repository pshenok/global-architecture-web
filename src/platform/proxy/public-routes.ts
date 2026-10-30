import 'server-only';
import registry from '../../../security/public-routes.json';

/**
 * The proxy's allowlist, compiled from security/public-routes.json: a path is public when
 * it matches a listed route segment for segment; everything else needs a session.
 */
export interface PublicRoute {
  readonly route: string;
  readonly methods?: readonly string[];
  readonly reason: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Segment = { kind: 'literal'; value: string } | { kind: 'uuid' } | { kind: 'any' };

export function compileRoute(route: string): readonly Segment[] {
  if (!route.startsWith('/')) throw new Error(`route ${route} must start with /`);
  return route
    .split('/')
    .slice(1)
    .map((part): Segment => {
      if (/^\[\.\.\./.test(part))
        throw new Error(`route ${route}: catch-all segments cannot be public`);
      const dynamic = /^\[([a-zA-Z][a-zA-Z0-9]*)(?::(uuid))?\]$/.exec(part);
      if (dynamic) return dynamic[2] === 'uuid' ? { kind: 'uuid' } : { kind: 'any' };
      if (part.includes('[')) throw new Error(`route ${route}: bad segment ${part}`);
      return { kind: 'literal', value: part };
    });
}

const matches = (pattern: readonly Segment[], parts: readonly string[]) =>
  pattern.length === parts.length &&
  pattern.every((segment, i) => {
    const part = parts[i] as string;
    if (segment.kind === 'literal') return segment.value === part;
    if (segment.kind === 'uuid') return UUID.test(part);
    return part.length > 0;
  });

export function createClassifier(
  routes: readonly PublicRoute[],
): (pathname: string) => 'public' | 'session' {
  const compiled = routes.map((r) => compileRoute(r.route));
  return (pathname) => {
    const parts = pathname.replace(/\/+$/, '').split('/').slice(1);
    let decoded: string[];
    try {
      decoded = parts.map((p) => decodeURIComponent(p));
    } catch {
      return 'session';
    }
    return compiled.some((pattern) => matches(pattern, decoded)) ? 'public' : 'session';
  };
}

export const classify = createClassifier(registry.routes);
