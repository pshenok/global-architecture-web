import { describe, expect, it, vi } from 'vitest';
import type { ApiProblem } from '@/kernel/problem-codes';
import { classifyReadProblem, orInterrupt, UpstreamError } from './interrupts';

vi.mock('@/platform/http/request-context', () => ({
  requestId: async () => 'req',
  currentPath: async () => '/bookings/1',
}));

const problem = (status: number, code: string): ApiProblem => ({
  status,
  code,
  title: 't',
  fieldErrors: [],
  metadata: {},
  origin: 'api',
});

async function digestOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    return String((error as { digest?: string }).digest ?? (error as Error).name);
  }
}

describe('read problems', () => {
  it.each([
    [404, 'BOOKING_NOT_FOUND', 'not-found'],
    [403, 'HOUSE_PERMISSION_DENIED', 'not-found'],
    [403, 'ADMIN_ROLE_REQUIRED', 'not-found'],
    [403, 'USER_NOT_REGISTERED', 'register'],
    [401, 'AUTH_TOKEN_EXPIRED', 'login'],
    [400, 'INVALID_PAGE_TOKEN', 'first-page'],
    [400, 'VALIDATION_FAILED', 'error'],
    [503, 'IDENTITY_PROVIDER_UNAVAILABLE', 'error'],
    [504, 'UPSTREAM_TIMEOUT', 'error'],
  ])('%i %s -> %s', (status, code, outcome) => {
    expect(classifyReadProblem(problem(status, code))).toBe(outcome);
  });

  it('interrupts a page the way the problem calls for', async () => {
    expect(await orInterrupt({ ok: true, value: 7 })).toBe(7);
    expect(await digestOf(orInterrupt({ ok: false, problem: problem(404, 'NOT_FOUND') }))).toMatch(
      /^NEXT_HTTP_ERROR_FALLBACK;404/,
    );
    expect(
      await digestOf(orInterrupt({ ok: false, problem: problem(401, 'AUTH_TOKEN_EXPIRED') })),
    ).toContain('/auth/login?returnTo=%2Fbookings%2F1');
    expect(
      await digestOf(orInterrupt({ ok: false, problem: problem(403, 'USER_NOT_REGISTERED') })),
    ).toContain('/register?returnTo=%2Fbookings%2F1');
    expect(
      await digestOf(
        orInterrupt(
          { ok: false, problem: problem(400, 'INVALID_PAGE_TOKEN') },
          { firstPage: '/houses' },
        ),
      ),
    ).toContain(';/houses;');
    await expect(
      orInterrupt({ ok: false, problem: problem(503, 'UPSTREAM_UNAVAILABLE') }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});
