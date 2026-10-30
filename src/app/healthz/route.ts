import { healthz } from '@/platform/health';

export function GET() {
  return healthz();
}
