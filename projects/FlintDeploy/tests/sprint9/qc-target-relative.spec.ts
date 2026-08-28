import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:  'b1111111-1111-1111-1111-111111111111',
  batchNum: 'MIXC-20260601-A01-01',
  runId:    'r2222222-2222-2222-2222-222222222222',
  procId:   'p3333333-3333-3333-3333-333333333333',
  matId:    'm4444444-4444-4444-4444-444444444444',
}

function makeDef(id: string, name: string, criteria: string) {
  return {
    id,
    qc_item_name: name,
    method: 'ToolEquipment' as const,
    timing: 'EndOfRun' as const,
    acceptance_criteria_text: criteria,
    acceptance_criteria_min: null,
    acceptance_criteria_max: null,
    is_active: true,
  }
}

async function setupMocks(page: Page, defs: any[]) {
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
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(defs) })
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

test.describe('QC Branch 3 — Target-relative tolerance', () => {
  test('Viscosity outside 2% tolerance fails', async ({ page }) => {
    const defs = [makeDef('def-visc', 'Viscosity', 'Within ± 2%')]
    await setupMocks(page, defs)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByPlaceholder('Target').fill('8200')
    await page.getByPlaceholder('Measured').fill('8400') // 2.4% deviation → fail
    await expect(page.getByText(/fail/i).first()).toBeVisible()
  })

  test('Viscosity within 2% tolerance passes', async ({ page }) => {
    const defs = [makeDef('def-visc', 'Viscosity', 'Within ± 2%')]
    await setupMocks(page, defs)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByPlaceholder('Target').fill('8200')
    await page.getByPlaceholder('Measured').fill('8300') // 1.2% deviation → pass
    await expect(page.getByText(/pass/i).first()).toBeVisible()
  })

  test('Dry Thickness outside 5% tolerance fails', async ({ page }) => {
    const defs = [makeDef('def-thick', 'Dry Thickness', 'Within ± 5%')]
    await setupMocks(page, defs)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByPlaceholder('Target').fill('100')
    await page.getByPlaceholder('Measured').fill('106') // 6% deviation → fail
    await expect(page.getByText(/fail/i).first()).toBeVisible()
  })

  test('Dry Thickness within 5% tolerance passes', async ({ page }) => {
    const defs = [makeDef('def-thick', 'Dry Thickness', 'Within ± 5%')]
    await setupMocks(page, defs)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByPlaceholder('Target').fill('100')
    await page.getByPlaceholder('Measured').fill('104') // 4% deviation → pass
    await expect(page.getByText(/pass/i).first()).toBeVisible()
  })

  test('Accurate Width outside 0.1mm absolute tolerance fails', async ({ page }) => {
    const defs = [makeDef('def-width', 'Accurate Width', 'Within ± 0.1 mm')]
    await setupMocks(page, defs)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByPlaceholder('Target').fill('50.0')
    await page.getByPlaceholder('Measured').fill('50.2') // 0.2 mm deviation → fail
    await expect(page.getByText(/fail/i).first()).toBeVisible()
  })

  test('Accurate Width within 0.1mm absolute tolerance passes', async ({ page }) => {
    const defs = [makeDef('def-width', 'Accurate Width', 'Within ± 0.1 mm')]
    await setupMocks(page, defs)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByPlaceholder('Target').fill('50.0')
    await page.getByPlaceholder('Measured').fill('50.05') // 0.05 mm deviation → pass
    await expect(page.getByText(/pass/i).first()).toBeVisible()
  })

  test('Shows deviation in feedback', async ({ page }) => {
    const defs = [makeDef('def-visc', 'Viscosity', 'Within ± 2%')]
    await setupMocks(page, defs)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByPlaceholder('Target').fill('8200')
    await page.getByPlaceholder('Measured').fill('8400')
    await expect(page.getByText(/2\.4%/)).toBeVisible()
  })
})
