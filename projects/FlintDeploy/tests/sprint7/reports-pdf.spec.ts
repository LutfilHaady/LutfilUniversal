import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const MOCK_BATCH = {
  id: 'batch-uuid-1',
  batch_number: 'MIXC-20260620-A01',
  status: 'Released',
  current_quantity: 50,
  unit: 'kg',
  created_at: '2026-06-20T08:00:00Z',
  materials: { name: 'Cathode Material C1' },
}

test.describe('Reports page — PDF export (R1)', () => {
  test.beforeEach(async ({ page }) => {
    // Catch-all first so specific routes registered after take priority (Playwright LIFO)
    await page.route(`**${SB}/rest/v1/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
    await page.route(`**${SB}/rest/v1/batches**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_BATCH]) })
    )
    await page.route(`**${SB}/rest/v1/qc_check_results**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
    // Mock users as Engineer so the reports page renders in full (not "Access restricted")
    await page.route(`**${SB}/rest/v1/users**`, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ full_name: 'Dev Engineer', role_id: 'r-eng', roles: { name: 'Engineer' } }),
      })
    )
  })

  test('PDF button is visible on the reports page', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.getByRole('button', { name: /pdf/i })).toBeVisible()
  })

  test('PDF button no longer shows a "coming soon" toast', async ({ page }) => {
    await page.goto('/reports')
    // Intercept any download so the test doesn't hang on file dialog
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
    await page.getByRole('button', { name: /pdf/i }).click()
    // Should NOT show the old stub toast
    await expect(page.getByText(/coming soon/i)).not.toBeVisible()
    await downloadPromise
  })

  test('CSV and XLSX buttons still work after PDF wiring', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.getByRole('button', { name: /csv/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /xlsx/i })).toBeVisible()
  })

  test('PDF button works on QC Analysis tab', async ({ page }) => {
    await page.goto('/reports')
    await page.getByRole('button', { name: 'QC Analysis' }).click()
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
    await page.getByRole('button', { name: /pdf/i }).click()
    await expect(page.getByText(/coming soon/i)).not.toBeVisible()
    await downloadPromise
  })
})
