import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const REGISTRY_PATH = join(ROOT, 'features.json');

export interface FeatureEntry {
  /** e.g. `houses` (the plural noun, like the monolith module it pairs with). */
  name: string;
  /** e.g. `src/features/houses` */
  dir: string;
  /** API path prefixes this feature's gateways may call, e.g. `/v1/houses`. */
  apiPaths: string[];
  /** Features it may import (through their index.ts / server.ts); acyclic. */
  dependsOn: string[];
}

export interface Registry {
  $comment: string;
  app: { devPort: number; e2ePort: number; clientId: string };
  monolith: { repo: string; dir: string };
  features: FeatureEntry[];
}

export function readRegistry(): Registry {
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as Registry;
}

export function writeRegistry(registry: Registry): void {
  writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
}

/** The monolith checkout: GAM_MONOLITH_DIR, else features.json monolith.dir (next to this repo). */
export function monolithDir(): string {
  const dir = process.env.GAM_MONOLITH_DIR ?? readRegistry().monolith.dir;
  return isAbsolute(dir) ? dir : resolve(ROOT, dir);
}

/** The monolith's registry (its modules.json): ports and the dev IdP's clients. */
export interface MonolithRegistry {
  api: { httpsPort: number };
  devIdp: {
    port: number;
    clients?: {
      clientId: string;
      clientSecret: string;
      redirectUris: string[];
      postLogoutRedirectUris: string[];
    }[];
  };
}

export function readMonolithRegistry(): MonolithRegistry {
  const path = join(monolithDir(), 'modules.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as MonolithRegistry;
  } catch {
    throw new Error(
      `cannot read ${path}: check out global-architecture-monolith next to this repo or set GAM_MONOLITH_DIR`,
    );
  }
}

export function run(command: string, args: string[], cwd = ROOT): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}
