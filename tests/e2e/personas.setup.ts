import { test as setup } from '@playwright/test';
import { register, signIn } from './support/sign-in.ts';
import { apiCall, devToken, grantAdmin, runId } from './support/stack.ts';

/**
 * Signs each persona in through the real dev IdP form once and saves the browser state:
 * host (owns houses), guest (books them), stranger (neither), admin, and unregistered
 * (signed in, no user). storageState stays in tests/e2e/.auth (git-ignored, never uploaded).
 */
const PERSONAS = ['host', 'guest', 'stranger', 'admin'] as const;

for (const persona of PERSONAS) {
  setup(`sign in ${persona}`, async ({ page }) => {
    const sub = `e2e-${runId()}-${persona}`;
    await signIn(page, sub);
    await page.goto('/register?returnTo=%2Fhouses');
    await register(page, `${persona[0]?.toUpperCase()}${persona.slice(1)} ${runId()}`);
    if (persona === 'admin') {
      const me = await apiCall('GET', '/v1/users/me', await devToken(sub, `${sub}@example.com`));
      grantAdmin((me.body as { id: string }).id);
    }
    await page.context().storageState({ path: `tests/e2e/.auth/${persona}.json` });
  });
}

setup('sign in unregistered', async ({ page }) => {
  await signIn(page, `e2e-${runId()}-unregistered`);
  await page.context().storageState({ path: 'tests/e2e/.auth/unregistered.json' });
});
