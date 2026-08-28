import { test, expect } from '@playwright/test';

test('batch with no genealogy shows empty state, not mock', async ({ page }) => {
  await page.goto('/recall');
  await page.getByPlaceholder(/e.g./i).fill('MTC2-20260608-A71'); 
  await page.getByRole('button', { name: /investigate/i }).click();
  await expect(page.getByText(/no genealogy found/i)).toBeVisible();
});
