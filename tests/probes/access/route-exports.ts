// as: src/app/auth/logout/route.ts
import { handleLogout } from '@/platform/auth';

export function POST(request: Request) {
  return handleLogout(request);
}
export const PUT = (r: Request) => handleLogout(r), GET = (r: Request) => handleLogout(r); // refused
export { POST as DELETE }; // refused
