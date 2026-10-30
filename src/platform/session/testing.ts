import { type Caller, mintCaller } from './caller';

/** A Caller with a fixed token, for gateway and view tests (tests only, R11). */
export function testCaller(token = 'test-access-token', subject = 'test-subject'): Caller {
  return mintCaller({ at: token, sub: subject });
}
