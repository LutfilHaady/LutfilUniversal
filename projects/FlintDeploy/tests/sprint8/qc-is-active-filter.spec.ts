/**
 * Sprint 8 — J3 · QC check definitions is_active filter
 *
 * Verifies that the QC wizard requests only active check definitions.
 * Sprint 8 J3 added is_active to qc_check_definitions and deactivated
 * Substrate Penetration (CALC). The QC wizard query must include
 * is_active=eq.true so inactive checks never reach the operator.
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:   '11111111-1111-1111-1111-111111111111',
  batchNum:  'CTGC-20260601-A01',
  runId:     '22222222-2222-2222-2222-222222222222',
  procId:    '33333333-3333-3333-3333-333333333333',
  matId:     '44444444-4444-4444-4444-444444444444',
  defActive: '55555555-5555-5555-5555-555555555555',
}

async function setupBaseMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/batches**`, route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: M.batchId, batch_number: M.batchNum, material_id: M.matId, current_quantity: 100 }) })
  })
  await page.route(`**${SB}/rest/v1/process_run_inputs**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ process_run_id: M.runId }) }))
  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: M.runId, process_id: M.procId }) })
  })
  await page.route(`**${SB}/rest/v1/processes**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: M.procId, requires_calibration: false }) }))
  await page.route(`**${SB}/rest/v1/qc_check_results**`, r =>
    r.fulfill({ status: 201, body: '' }))
  await page.route(`**${SB}/rest/v1/batch_status_changes**`, r =>
    r.fulfill({ status: 201, body: '' }))
}

async function scanBatch(page: Page) {
  await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
  await page.getByRole('button', { name: /find batch/i }).click()
  await expect(page.getByRole('heading', { name: 'QC Checks' })).toBeVisible()
}

test('qc_check_definitions request includes is_active=eq.true', async ({ page }) => {
  let requestUrl: string | null = null

  await setupBaseMocks(page)
  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, async route => {
    requestUrl = route.request().url()
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: M.defActive, qc_item_name: 'Surface Finish', method: 'VisualManual',
          timing: 'Startup', acceptance_criteria_text: 'Uniform Surface',
          acceptance_criteria_min: null, acceptance_criteria_max: null },
      ]),
    })
  })

  await page.goto('/log/qc')
  await scanBatch(page)

  await expect.poll(() => requestUrl, { timeout: 5000 }).not.toBeNull()
  expect(requestUrl).toContain('is_active=eq.true')
})

test('active check renders; inactive Substrate Penetration absent from form', async ({ page }) => {
  await setupBaseMocks(page)
  // Mock returns only active definitions — simulates what the DB returns with is_active=true filter.
  // Substrate Penetration (deactivated in J3) is intentionally absent.
  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, r =>
    r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: M.defActive, qc_item_name: 'Surface Finish', method: 'VisualManual',
          timing: 'Startup', acceptance_criteria_text: 'Uniform Surface',
          acceptance_criteria_min: null, acceptance_criteria_max: null },
      ]),
    }))

  await page.goto('/log/qc')
  await scanBatch(page)

  await expect(page.getByText('Surface Finish')).toBeVisible()
  await expect(page.getByText('Substrate Penetration')).not.toBeVisible()
})
