import { handleLogout } from '@/platform/auth';

export function POST(request: Request) {
  return handleLogout(request);
}
