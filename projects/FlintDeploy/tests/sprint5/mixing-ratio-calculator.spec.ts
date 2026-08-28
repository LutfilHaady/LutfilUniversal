/**
 * Sprint 5 (Lutfil) — Mixing Ratio Calculator (L-4)
 *
 * Tests cover:
 *  - Calculator renders on /log/mixing/[batchId] and is collapsed by default
 *  - Expanding it shows the active recipe's material ratios
 *  - Entering a total batch size computes per-material quantities from the ratios
 *
 * Supabase REST calls are mocked at the network layer — no test data written.
 * /rest/v1/users is left real so auth context resolves the Engineer role.
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchUuid: '11111111-1111-1111-1111-111111111111',
  batchNum:  'MIXC-20260601-A01',
  procId:    '33333333-3333-3333-3333-333333333333',
  recipeId:  '55555555-5555-5555-5555-555555555555',
}

const RECIPE_ROWS = [
  { material: 'Cathode Material C1', amount_kg: 1, mixing_time_hr: 1, temperature_c: 1, internal_pressure_bar: 1, dispersion_rpm: 1, propeller_rpm: 1, target_viscosity_mpas: 1 },
  { material: 'DI Water',            amount_kg: 2, mixing_time_hr: 1, temperature_c: 1, internal_pressure_bar: 1, dispersion_rpm: 1, propeller_rpm: 1, target_viscosity_mpas: 1 },
  { material: 'Material E1',         amount_kg: 3, mixing_time_hr: 1, temperature_c: 1, internal_pressure_bar: 1, dispersion_rpm: 1, propeller_rpm: 1, target_viscosity_mpas: 1 },
]

async function setupMocks(page: Page) {
  // Catch-all for any unmocked Supabase REST call — prevents stray requests
  // from hitting the real network and stalling (e.g. qc_check_results, materials).
  await page.route(`**${SB}/rest/v1/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // Leave /users real so auth context resolves the Engineer role.
  await page.route(`**${SB}/rest/v1/users**`, route => route.continue())

  // Batch lookup by batch_number (single object for .single())
  await page.route(`**${SB}/rest/v1/batches**`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: M.batchUuid, batch_number: M.batchNum }),
    })
  )

  // Mixing steps — none yet
  await page.route(`**${SB}/rest/v1/mixing_steps**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // Process lookup by code (MIXC)
  await page.route(`**${SB}/rest/v1/processes**`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: M.procId }),
    })
  )

  // Active recipe for this process, with mixing_steps ratios
  await page.route(`**${SB}/rest/v1/recipes**`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: M.recipeId, recipe_number: 'RCP-020', version: '1.0', params: { mixing_steps: RECIPE_ROWS } },
      ]),
    })
  )
}

test('ratio calculator computes per-material quantities from recipe ratios', async ({ page }) => {
  await setupMocks(page)

  await page.goto(`/log/mixing/${M.batchNum}`)

  const header = page.getByRole('button', { name: /Mixing Ratio Calculator/i })
  await expect(header).toBeVisible()

  // Table not visible until expanded
  await expect(page.getByText('Total Batch Size (kg)')).not.toBeVisible()

  await header.click()
  await expect(page.getByText('Total Batch Size (kg)')).toBeVisible()

  await page.getByPlaceholder('0.0').fill('6')

  const rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('Cathode Material C1')
  await expect(rows.nth(0)).toContainText('1.00')
  await expect(rows.nth(1)).toContainText('DI Water')
  await expect(rows.nth(1)).toContainText('2.00')
  await expect(rows.nth(2)).toContainText('Material E1')
  await expect(rows.nth(2)).toContainText('3.00')
})
