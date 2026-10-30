import 'server-only';
import { getEnv } from '@/platform/config/env';

/**
 * JSON lines shaped like pino's (`level`, `time`, `msg`), so they sit next to the
 * monolith's logs. Fields come from an allowlist of primitives: no objects, headers,
 * bodies or sessions can be logged, so no token can be either.
 */

export interface LogFields {
  readonly requestId?: string;
  readonly op?: string;
  readonly status?: number;
  readonly code?: string;
  readonly digest?: string;
  readonly path?: string;
  readonly method?: string;
  readonly routeType?: string;
  readonly reason?: string;
  readonly durationMs?: number;
}

const LEVELS = { debug: 20, info: 30, warn: 40, error: 50 } as const;
type Level = keyof typeof LEVELS;
const FIELDS = new Set<keyof LogFields>([
  'requestId',
  'op',
  'status',
  'code',
  'digest',
  'path',
  'method',
  'routeType',
  'reason',
  'durationMs',
]);

function write(level: Level, msg: string, fields: LogFields = {}): void {
  if (LEVELS[level] < LEVELS[getEnv().LOG_LEVEL]) return;
  const line: Record<string, string | number> = { level: LEVELS[level], time: Date.now(), msg };
  for (const [key, value] of Object.entries(fields)) {
    if (
      FIELDS.has(key as keyof LogFields) &&
      (typeof value === 'string' || typeof value === 'number')
    ) {
      line[key] = typeof value === 'string' ? value.slice(0, 500) : value;
    }
  }
  const text = JSON.stringify(line);
  if (LEVELS[level] >= LEVELS.warn) console.error(text);
  else console.log(text);
}

export const log = {
  debug: (msg: string, fields?: LogFields) => write('debug', msg, fields),
  info: (msg: string, fields?: LogFields) => write('info', msg, fields),
  warn: (msg: string, fields?: LogFields) => write('warn', msg, fields),
  error: (msg: string, fields?: LogFields) => write('error', msg, fields),
};
