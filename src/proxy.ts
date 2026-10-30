import type { NextRequest } from 'next/server';
import { runProxy } from '@/platform/proxy';

export function proxy(request: NextRequest) {
  return runProxy(request);
}

// Page paths stay matched: Server Actions POST to them. Pinned by check-access S3.
export const config = { matcher: ['/((?!_next/|favicon\\.ico|icon\\.svg|robots\\.txt).*)'] };
