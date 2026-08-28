import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:  'b1111111-1111-1111-1111-111111111111',
  batchNum: 'CALC-20260601-A01-01',
  runId:    'r2222222-2222-2222-2222-222222222222',
  procId:   'p3333333-3333-3333-3333-333333333333',
  matId:    'm4444444-4444-4444-4444-444444444444',
}

async function setupMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/batches**`, route => {
    if (route.request().method() !== 'GET')
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: M.batchId, batch_number: M.batchNum, material_id: M.matId, current_quantity: 100 }),
    })
  })
  await page.route(`**${SB}/rest/v1/process_run_inputs**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ process_run_id: M.runId }) })
  )
  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: M.runId, process_id: M.procId }) })
  })
  await page.route(`**${SB}/rest/v1/processes**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: M.procId, requires_calibration: false }) })
  )
  // Calendaring checks: Surface Finish is active, Substrate Penetration is inactive
  // The query filters is_active=true server-side, so we only return the active one
  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'def-sf',
          qc_item_name: 'Surface Finish',
          method: 'VisualManual',
          timing: 'Startup',
          acceptance_criteria_text: 'Smooth coating',
          acceptance_criteria_min: null,
          acceptance_criteria_max: null,
          is_active: true,
        },
      ]),
    })
  )
  await page.route(`**${SB}/rest/v1/qc_check_results**`, route =>
    route.fulfill({ status: 201, body: '' })
  )
}

test.describe('QC is_active filter', () => {
  test('Calendaring shows Surface Finish, not Substrate Penetration', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')

    await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
    await page.getByRole('button', { name: /find batch/i }).click()
    await expect(page.getByRole('heading', { name: 'QC Checks' })).toBeVisible()

    await expect(page.getByText(/surface finish/i)).toBeVisible()
    await expect(page.getByText(/substrate penetration/i)).not.toBeVisible()
  })
})
