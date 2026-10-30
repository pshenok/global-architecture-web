import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface SignInOptions {
  readonly email?: string;
  /** The dev IdP's access-token lifetime knob (seconds). */
  readonly accessTtl?: number;
  readonly returnTo?: string;
}

/** Signs in through the app and the dev IdP's form, like a person would. */
export async function signIn(page: Page, sub: string, options: SignInOptions = {}): Promise<void> {
  await page.goto(`/auth/login?returnTo=${encodeURIComponent(options.returnTo ?? '/houses')}`);
  await expect(page).toHaveURL(/127\.0\.0\.1:9090\/authorize/);
  await page.getByLabel('Subject (login id)').fill(sub);
  await page.getByLabel('Email', { exact: true }).fill(options.email ?? `${sub}@example.com`);
  if (options.accessTtl)
    await page.getByLabel('Access token lifetime (seconds)').fill(String(options.accessTtl));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/localhost:9301/);
}

/** Completes registration on /register. */
export async function register(page: Page, fullName: string): Promise<void> {
  await expect(page).toHaveURL(/\/register/);
  await page.getByLabel('Your name').fill(fullName);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).not.toHaveURL(/\/register/);
}
