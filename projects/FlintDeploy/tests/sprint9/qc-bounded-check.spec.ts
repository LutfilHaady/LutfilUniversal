import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:  'b1111111-1111-1111-1111-111111111111',
  batchNum: 'MIXC-20260601-A01-01',
  runId:    'r2222222-2222-2222-2222-222222222222',
  procId:   'p3333333-3333-3333-3333-333333333333',
  matId:    'm4444444-4444-4444-4444-444444444444',
  defParticleSize: 'd5555555-5555-5555-5555-555555555555',
  defVoltage:      'd6666666-6666-6666-6666-666666666666',
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
  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        {
          id: M.defParticleSize,
          qc_item_name: 'Particle Size',
          method: 'ToolEquipment',
          timing: 'EndOfRun',
          acceptance_criteria_text: '< 50 µm',
          acceptance_criteria_min: null,
          acceptance_criteria_max: 50,
          is_active: true,
        },
        {
          id: M.defVoltage,
          qc_item_name: 'Voltage',
          method: 'ToolEquipment',
          timing: 'EndOfRun',
          acceptance_criteria_text: '> 1.6 V',
          acceptance_criteria_min: 1.6,
          acceptance_criteria_max: null,
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

test.describe('QC Branch 2 — Bounded numeric checks', () => {
  test('Particle Size rejects out-of-window value (60 > max 50)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.first().fill('60')
    await expect(page.getByText('✗ Fail').first()).toBeVisible()
  })

  test('Particle Size accepts in-window value (30 ≤ 50)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.first().fill('30')
    await expect(page.getByText('✓ Pass').first()).toBeVisible()
  })

  test('Voltage rejects below-min value (1.2 < min 1.6)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.nth(1).fill('1.2')
    await expect(page.getByText('✗ Fail')).toBeVisible()
  })

  test('Voltage accepts above-min value (2.0 ≥ 1.6)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.nth(1).fill('2.0')
    await expect(page.getByText('✓ Pass')).toBeVisible()
  })

  test('Spec label shows numeric range inline', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    await expect(page.getByText('≤ 50')).toBeVisible()
    await expect(page.getByText('≥ 1.6')).toBeVisible()
  })
})
