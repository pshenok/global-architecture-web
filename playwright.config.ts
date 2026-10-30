import { defineConfig, devices } from '@playwright/test';

const PORT = 9301;

/**
 * End to end against the real stack: the monolith (`pnpm stack:up` in its checkout: API,
 * dev IdP, Postgres) and this app's standalone build (`pnpm build`), served on 9301 by
 * tools/serve.ts. No login bypass and no mocked backend: personas sign in through the
 * dev IdP's form like a person would.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  // The monolith's rate limit is per client address, and every test comes from here.
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [
    { name: 'personas', testMatch: /personas\.setup\.ts$/ },
    { name: 'e2e', dependencies: ['personas'], testIgnore: /personas\.setup\.ts$/ },
  ],
  webServer: {
    command: 'node tools/serve.ts',
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
