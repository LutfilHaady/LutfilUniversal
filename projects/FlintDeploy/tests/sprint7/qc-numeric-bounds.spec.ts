import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:   '11111111-1111-1111-1111-111111111111',
  batchNum:  'MIXC-20260601-A01-01',
  runId:     '22222222-2222-2222-2222-222222222222',
  procId:    '33333333-3333-3333-3333-333333333333',
  matId:     '44444444-4444-4444-4444-444444444444',
  defVisual: '55555555-5555-5555-5555-555555555555',
  defMinMax: '66666666-6666-6666-6666-666666666666',
  defMaxOnly:'77777777-7777-7777-7777-777777777777',
  outBatchId:  '88888888-8888-8888-8888-888888888888',
  outBatchNum: 'MIXC-20260602-A01-02',
}

async function setupMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/batches**`, route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: M.outBatchId, batch_number: M.outBatchNum }),
      })
    }
    if (route.request().method() === 'PATCH') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: M.batchId, batch_number: M.batchNum,
        material_id: M.matId, current_quantity: 100,
      }),
    })
  })

  await page.route(`**${SB}/rest/v1/process_run_inputs**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ process_run_id: M.runId }),
    })
  )

  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    if (route.request().method() !== 'GET')
      return route.fulfill({ status: 204, body: '' })
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: M.runId, process_id: M.procId }),
    })
  })

  await page.route(`**${SB}/rest/v1/processes**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: M.procId, requires_calibration: false }),
    })
  )

  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        {
          id: M.defVisual,
          qc_item_name: 'Homogeneity',
          method: 'VisualManual',
          timing: 'EndOfRun',
          acceptance_criteria_text: 'No visible lumps',
          acceptance_criteria_min: null,
          acceptance_criteria_max: null,
          is_active: true,
        },
        {
          id: M.defMinMax,
          qc_item_name: 'Viscosity',
          method: 'ToolEquipment',
          timing: 'EndOfRun',
          acceptance_criteria_text: 'Within ± 2%',
          acceptance_criteria_min: 10,
          acceptance_criteria_max: 20,
          is_active: true,
        },
        {
          id: M.defMaxOnly,
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
  )

  await page.route(`**${SB}/rest/v1/qc_check_results**`, route =>
    route.fulfill({ status: 201, body: '' })
  )

  await page.route(`**${SB}/rest/v1/batch_status_changes**`, route =>
    route.fulfill({ status: 201, body: '' })
  )
}

async function scanBatch(page: Page) {
  await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
  await page.getByRole('button', { name: /find batch/i }).click()
  await expect(page.getByRole('heading', { name: 'QC Checks' })).toBeVisible()
}

test.describe('QC Numeric Bounds', () => {
  test('ToolEquipment check with min/max: 15 passes (10–20 range)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    // Spec display shows numeric range instead of text
    await expect(page.getByText('10 – 20')).toBeVisible()

    // Homogeneity (Visual) → Pass
    await page.getByRole('button', { name: 'Pass' }).click()

    // Viscosity → 15 (within 10–20) → auto-pass
    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.first().fill('15')
    await expect(page.getByText('✓ Pass').first()).toBeVisible()

    // Particle Size → 30 (≤ 50) → auto-pass
    await inputs.nth(1).fill('30')
  })

  test('ToolEquipment check: 9 fails (below min=10)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByRole('button', { name: 'Pass' }).click()
    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.first().fill('9')
    await expect(page.getByText('✗ Fail').first()).toBeVisible()
  })

  test('ToolEquipment check: 21 fails (above max=20)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByRole('button', { name: 'Pass' }).click()
    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.first().fill('21')
    await expect(page.getByText('✗ Fail').first()).toBeVisible()
  })

  test('ToolEquipment check: boundary value at min=10 passes', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByRole('button', { name: 'Pass' }).click()
    const inputs = page.getByPlaceholder('Enter measured value')
    // Boundary case: exactly at min value should pass
    await inputs.first().fill('10')
    await expect(page.getByText('✓ Pass').first()).toBeVisible()
  })

  test('max-only check: 50 passes (≤ 50)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByRole('button', { name: 'Pass' }).click()
    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.first().fill('15')   // Viscosity → pass
    await inputs.nth(1).fill('50')    // Particle Size → 50 ≤ 50 → pass
    await expect(page.getByText('✓ Pass').nth(1)).toBeVisible()
  })

  test('Non-numeric entry on numeric check fails gracefully', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByRole('button', { name: 'Pass' }).click()
    const inputs = page.getByPlaceholder('Enter measured value')
    // Input field is type="number", so browser ignores 'abc'
    // Attempting non-numeric entry should not cause crash; input stays empty
    await inputs.first().type('abc')
    // Verify input is empty (browser constraint) — application handles gracefully
    const viscosityInput = inputs.first()
    const value = await viscosityInput.inputValue()
    expect(value).toBe('')
  })

  test('VisualManual checks still work as before', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    // Homogeneity is VisualManual — shows Pass/Fail buttons, not numeric input
    await expect(page.getByRole('button', { name: 'Pass' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fail' })).toBeVisible()
  })
})
