import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': src } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.spec.ts', 'templates/feature/**/*.spec.ts', 'tools/**/*.spec.ts'],
          // Every module is server code here; the real package stays active in the browser project.
          alias: {
            'server-only': fileURLToPath(new URL('./tests/support/empty.ts', import.meta.url)),
          },
          setupFiles: ['tests/support/unit-setup.ts'],
          restoreMocks: true,
          unstubEnvs: true,
        },
      },
    ],
  },
});
