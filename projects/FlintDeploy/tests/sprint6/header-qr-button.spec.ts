import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

// The QR button exposes a manual-entry input so the resolver path is testable
// without a camera. Exact match -> navigate; no match -> palette opens pre-filled.
test('QR button manual entry navigates to an exact batch match', async ({ page }) => {
  // Catch-all FIRST (Playwright matches routes in reverse registration order,
  // so last-registered wins — specific mocks must come after the catch-all).
  await page.route(`**${SB}/rest/v1/**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  // Specific batch mock LAST so it takes priority over the catch-all.
  await page.route(`**${SB}/rest/v1/batches**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 'batch-uuid-1', batch_number: 'CTGC-20260601-A01', parent_batch_id: null, status: 'InProgress' }]),
  }))

  await page.goto('/dashboard')
  await page.getByRole('button', { name: /scan|qr/i }).first().click()
  const dialog = page.getByRole('dialog', { name: /scan qr/i })
  await dialog.getByPlaceholder(/enter code/i).fill('CTGC-20260601-A01')
  await dialog.getByRole('button', { name: /go/i }).click()

  await expect(page).toHaveURL(/\/batches\/batch-uuid-1/)
})

test('QR button with no exact match opens the search palette pre-filled', async ({ page }) => {
  // No batch/lot/recipe/equipment match
  await page.route(`**${SB}/rest/v1/**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  await page.goto('/dashboard')
  await page.getByRole('button', { name: /scan|qr/i }).first().click()
  const dialog = page.getByRole('dialog', { name: /scan qr/i })
  await dialog.getByPlaceholder(/enter code/i).fill('UNKNOWN-XYZ')
  await dialog.getByRole('button', { name: /go/i }).click()

  // Palette input shows the pre-filled query
  await expect(page.getByPlaceholder(/Search batches, lots, recipes, machines/i)).toHaveValue('UNKNOWN-XYZ')
})
