import { describe, expect, it } from 'vitest';
import { authorizationHeader, type Caller, mintCaller } from './caller';

describe('Caller', () => {
  it('carries the token without exposing it', () => {
    const caller = mintCaller({ at: 'secret-token', sub: 'alice' });
    expect(authorizationHeader(caller)).toBe('Bearer secret-token');
    expect(JSON.stringify(caller)).toBe('{"subject":"alice"}');
    expect(Object.values(caller)).not.toContain('secret-token');
    expect(Object.isFrozen(caller)).toBe(true);
  });

  it('refuses a look-alike that the platform did not mint', () => {
    const forged = { subject: 'alice' } as unknown as Caller;
    expect(() => authorizationHeader(forged)).toThrow('not a Caller');
  });
});
