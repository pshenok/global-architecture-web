import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));
const browser = (colorScheme: 'light' | 'dark') => ({
  browser: 'chromium' as const,
  name: `chromium-${colorScheme}`,
  provider: playwright({ contextOptions: { colorScheme, reducedMotion: 'reduce' } }),
});

export default defineConfig({
  // One React for the app code and the UI packages (Base UI, lucide) in the browser project.
  resolve: { alias: { '@': src }, dedupe: ['react', 'react-dom'] },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'vitest-browser-react',
      'axe-core',
      'lucide-react',
      'cn',
      'class-variance-authority',
      '@base-ui/react/button',
      '@base-ui/react/input',
      '@base-ui/react/alert-dialog',
      '@base-ui/react/menu',
      '@base-ui/react/separator',
      '@base-ui/react/merge-props',
      '@base-ui/react/use-render',
    ],
  },
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
      {
        extends: true,
        test: {
          name: 'browser',
          // Synchronous ui/ components in real Chromium with the real CSS (axe checks contrast),
          // in both color schemes. server-only stays real: a component that pulls in server
          // code fails here.
          include: ['src/**/*.spec.tsx', 'templates/feature/**/*.spec.tsx'],
          setupFiles: ['tests/support/browser-setup.ts'],
          browser: {
            enabled: true,
            headless: true,
            screenshotFailures: false,
            instances: [browser('light'), browser('dark')],
          },
        },
      },
    ],
  },
});
