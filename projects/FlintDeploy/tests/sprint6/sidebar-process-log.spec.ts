import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

test('Process Log nav item appears in the sidebar', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.goto('/dashboard')
  const link = page.getByRole('link', { name: 'Process Log' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', '/log')
})
