import 'server-only';

export type { components, paths } from '@/platform/api/generated/schema';
export { type ApiResult, anonymous, settle, withCaller } from './call';
export { api } from './client';
