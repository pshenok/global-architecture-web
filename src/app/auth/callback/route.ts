import { handleCallback } from '@/platform/auth';

export function GET(request: Request) {
  return handleCallback(request);
}
