/**
 * Sprint 9 — Coating (CTGC) process form fields.
 * Migrated to the Phase 2 single-page model (Sprint 11).
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

async function setupMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**${SB}/rest/v1/users**`, r => r.continue())

  await page.route(`**${SB}/rest/v1/batches*`, async r => {
    if (r.request().method() === 'GET') {
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'b-1', batch_number: 'TEST-01', material_id: 'm-1' }),
      })
    }
    return r.continue()
  })

  await page.route(`**${SB}/rest/v1/rpc/get_process_route*`, async r =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        process_id: 'p-1',
        name: 'Coating & Oven Drying',
        code: 'CTGC',
        sequence_hint: 2,
        requires_calibration: false,
      }]),
    }),
  )

  await page.route(`**${SB}/rest/v1/equipment*`, async r => r.fulfill({ status: 200, body: '[]' }))
  await page.route(`**${SB}/rest/v1/recipes*`, async r => r.fulfill({ status: 200, body: '[]' }))
}

test('Coating process renders all spec fields with units', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/log')
  await page.getByPlaceholder(/e\.g\./i).first().fill('TEST-01')
  await page.getByRole('button', { name: /find batch/i }).click()
  const stepSelect = page.getByTestId('process-step-select')
  await expect(stepSelect).toBeVisible({ timeout: 5000 })
  const stepOptLocator = stepSelect.locator('option').filter({ hasText: /Coating & Oven Drying/ })
  const stepOptVal = await stepOptLocator.first().getAttribute('value')
  await stepSelect.selectOption(stepOptVal ?? '')

  await expect(page.getByText(/Upper Oven/i)).toBeVisible()
  await expect(page.getByText(/Fan Speed/i)).toBeVisible()
  await expect(page.getByText(/Substrate Feeding Speed/i)).toBeVisible()
})
