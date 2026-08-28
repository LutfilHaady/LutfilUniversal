/**
 * Sprint 3 — QC Log (/log/qc)
 *
 * Tests cover:
 *  - QC pass path: output batch created, shown on success screen
 *  - QC fail path: input batch held, "Failed" shown on success screen
 *  - Batch not found error handling
 *  - Find batch button disabled states
 *
 * Supabase REST calls are mocked at the network layer so no test data is
 * written to the live database.
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:   '11111111-1111-1111-1111-111111111111',
  batchNum:  'MIXC-20260601-A01-01',
  runId:     '22222222-2222-2222-2222-222222222222',
  procId:    '33333333-3333-3333-3333-333333333333',
  matId:     '44444444-4444-4444-4444-444444444444',
  def1Id:    '55555555-5555-5555-5555-555555555555',
  def2Id:    '66666666-6666-6666-6666-666666666666',
  outBatchId:  '77777777-7777-7777-7777-777777777777',
  outBatchNum: 'MIXC-20260602-A01-02',
}

async function setupQCMocks(page: Page) {
  // batches — GET (scan lookup), POST (insert output batch on pass),
  //           PATCH (set OnHold on fail)
  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const method = route.request().method()
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: M.batchId,
          batch_number: M.batchNum,
          material_id: M.matId,
          current_quantity: 100,
        }),
      })
    }
    if (method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: M.outBatchId, batch_number: M.outBatchNum }),
      })
    }
    // PATCH (OnHold update on fail)
    return route.fulfill({ status: 204, body: '' })
  })

  // process_run_inputs — GET returns the run id for the scanned batch
  await page.route(`**${SB}/rest/v1/process_run_inputs**`, async route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ process_run_id: M.runId }),
    })
  })

  // process_runs — GET returns process id; PATCH updates status / output_batch_id
  await page.route(`**${SB}/rest/v1/process_runs**`, async route => {
    if (route.request().method() !== 'GET') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: M.runId, process_id: M.procId }),
    })
  })

  // processes — GET returns calibration flag
  await page.route(`**${SB}/rest/v1/processes**`, async route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: M.procId, requires_calibration: false }),
    })
  })

  // qc_check_definitions — GET returns two checks: one visual, one numeric
  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, async route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: M.def1Id,
          qc_item_name: 'Homogeneity',
          method: 'VisualManual',
          timing: 'EndOfRun',
          acceptance_criteria_text: 'No visible lumps',
          acceptance_criteria_min: null,
          acceptance_criteria_max: null,
          is_active: true,
        },
        {
          id: M.def2Id,
          qc_item_name: 'Particle Size',
          method: 'ToolEquipment',
          timing: 'EndOfRun',
          acceptance_criteria_text: '< 50',
          acceptance_criteria_min: null,
          acceptance_criteria_max: 50,
          is_active: true,
        },
      ]),
    })
  })

  // qc_check_results — POST (insert results on submit)
  await page.route(`**${SB}/rest/v1/qc_check_results**`, async route => {
    return route.fulfill({ status: 201, body: '' })
  })

  // batch_status_changes — POST (audit row on every status transition)
  await page.route(`**${SB}/rest/v1/batch_status_changes**`, async route => {
    return route.fulfill({ status: 201, body: '' })
  })
}

test.describe('QC Log — /log/qc', () => {
  test('renders scan batch section and Find batch button is disabled when input is empty', async ({ page }) => {
    await page.goto('/log/qc')
    await expect(page.getByRole('heading', { name: 'Scan Batch' })).toBeVisible()
    await expect(page.getByRole('button', { name: /find batch/i })).toBeDisabled()
  })

  test('shows error when batch number is not found', async ({ page }) => {
    // Override just the batches route to simulate not found (PGRST116 = 0 rows)
    await page.route(`**${SB}/rest/v1/batches**`, async route => {
      return route.fulfill({
        status: 406,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
        }),
      })
    })

    await page.goto('/log/qc')
    await page.getByPlaceholder(/e\.g\./i).fill('NOTREAL-20260601-Z99-99')
    await page.getByRole('button', { name: /find batch/i }).click()

    await expect(page.getByText(/batch not found/i)).toBeVisible()
    // Should remain on section 1
    await expect(page.getByRole('heading', { name: 'Scan Batch' })).toBeVisible()
  })

  test('QC pass path — output batch number displayed on success screen', async ({ page }) => {
    await setupQCMocks(page)
    await page.goto('/log/qc')

    // Section 1 — scan batch
    await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
    await page.getByRole('button', { name: /find batch/i }).click()

    // Section 3 — QC checks appear (no calibration since requires_calibration = false)
    await expect(page.getByRole('heading', { name: 'QC Checks' })).toBeVisible()

    // Homogeneity (VisualManual) → Pass
    await page.getByRole('button', { name: 'Pass' }).click()

    // Particle Size (ToolEquipment) → 30, auto-computes pass (30 < 50)
    await page.getByPlaceholder('Enter measured value').fill('30')
    await expect(page.getByText('✓ Pass').first()).toBeVisible()

    // Section 4 — Submit Results appears automatically once all checks are answered
    await expect(page.getByText(/all checks passed/i)).toBeVisible()

    // Submit
    await page.getByRole('button', { name: /submit qc record/i }).click()

    // Success screen: output batch shown
    await expect(page.getByText('QC Record Submitted')).toBeVisible()
    await expect(page.getByText('Output Batch')).toBeVisible()
    await expect(page.getByText(M.outBatchNum)).toBeVisible()
  })

  test('QC fail path — Failed status shown, no output batch on success screen', async ({ page }) => {
    await setupQCMocks(page)
    await page.goto('/log/qc')

    // Section 1 — scan batch
    await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
    await page.getByRole('button', { name: /find batch/i }).click()

    // Section 3 — QC checks
    await expect(page.getByRole('heading', { name: 'QC Checks' })).toBeVisible()

    // Homogeneity → Fail
    await page.getByRole('button', { name: 'Fail' }).click()

    // Particle Size → 80, auto-computes fail (80 is not < 50)
    await page.getByPlaceholder('Enter measured value').fill('80')
    await expect(page.getByText('✗ Fail').first()).toBeVisible()

    // Section 4 — Submit Results appears automatically
    await expect(page.getByText(/one or more checks failed/i)).toBeVisible()

    // Submit
    await page.getByRole('button', { name: /submit qc record/i }).click()

    // Success screen: "Failed" status, output batch section NOT shown
    await expect(page.getByText('QC Record Submitted')).toBeVisible()
    await expect(page.getByText('Failed')).toBeVisible()
    await expect(page.getByText('Output Batch')).not.toBeVisible()
  })
})
