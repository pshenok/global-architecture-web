import { handleLogin } from '@/platform/auth';

export function GET(request: Request) {
  return handleLogin(request);
}
