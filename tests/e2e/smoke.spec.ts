import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// e2e-new has not onboarded; e2e-onboarded has (see supabase/seed.sql).
async function signInAsSeededUser(page: Page, who: 'new' | 'onboarded' = 'new', locale = 'th') {
  await page.goto(`/${locale}/login`);
  const form = page.getByTestId('e2e-login');
  await form.locator('input[name=email]').fill(`e2e-${who}@example.test`);
  await form.locator('input[name=password]').fill('e2e-password');
  await form.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
}

test('new user can onboard, add a job, see its score and move it to interview', async ({ page }) => {
  await signInAsSeededUser(page);
  await expect(page).toHaveURL(/onboarding/);
  await page.getByText('Backend', { exact: true }).click();
  await page.setInputFiles('input[type=file]', 'tests/fixtures/resume.pdf');
  await page.getByRole('button', { name: 'ไปต่อ' }).click();
  await page.waitForURL((u) => !u.pathname.includes('onboarding'));
  await page.goto('/th/jobs/new');
  await page.getByRole('textbox', { name: /ข้อความประกาศ/ }).fill(readFileSync('evals/postings/01.txt', 'utf8'));
  await page.getByRole('button', { name: /เพิ่มจากข้อความ/ }).click();
  await expect(page.locator('.ring').first()).toContainText(/\d+/);
  await page.getByRole('button', { name: 'สัมภาษณ์', exact: true }).click();
  await expect(page.locator('svg.g-celebrate').first()).toBeVisible();
  await page.goto('/th/jobs?tab=active');
  await expect(page.locator('.row')).toHaveCount(1);
});

test('english locale shows english labels', async ({ page }) => {
  await signInAsSeededUser(page, 'onboarded', 'en');
  await page.goto('/en/jobs');
  await expect(page.getByRole('heading', { name: 'Recommended' })).toBeVisible();
});

test('phone width has no horizontal scroll on the job list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signInAsSeededUser(page, 'onboarded');
  await page.goto('/th/jobs');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});
