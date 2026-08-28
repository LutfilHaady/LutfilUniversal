import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:  'b1111111-1111-1111-1111-111111111111',
  batchNum: 'DICC-20260601-A01-01',
  runId:    'r2222222-2222-2222-2222-222222222222',
  procId:   'p3333333-3333-3333-3333-333333333333',
  matId:    'm4444444-4444-4444-4444-444444444444',
  defWarp:  'd5555555-5555-5555-5555-555555555555',
}

const SCRAP_DEF = {
  id: M.defWarp,
  qc_item_name: 'Warpage',
  method: 'VisualManual',
  timing: 'EndOfRun',
  acceptance_criteria_text: 'Scrap',
  acceptance_criteria_min: null,
  acceptance_criteria_max: 5.0,
  is_active: true,
}

async function setupMocks(page: Page, opts: { throughput?: number } = {}) {
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
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SCRAP_DEF]) })
  )

  // Throughput from process_run_parameters
  await page.route(`**${SB}/rest/v1/process_run_parameters**`, route => {
    if (opts.throughput != null) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ parameter_key: 'pcs_cut', value: String(opts.throughput) }]),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

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

test.describe('QC Branch 4 — Scrap defect-rate checks', () => {
  test('seeded failure-path: 124 defects on 1000 pcs → 12.4%, fails 5% threshold', async ({ page }) => {
    await setupMocks(page, { throughput: 1000 })
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByPlaceholder('Defect count').fill('124')
    await expect(page.getByText(/12\.4%/).first()).toBeVisible()
    await expect(page.getByText(/fail/i).first()).toBeVisible()
  })

  test('10 defects on 1000 pcs → 1.0%, passes 5% threshold', async ({ page }) => {
    await setupMocks(page, { throughput: 1000 })
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByPlaceholder('Defect count').fill('10')
    await expect(page.getByText(/1\.0%/).first()).toBeVisible()
    await expect(page.getByText(/pass/i).first()).toBeVisible()
  })

  test('50 defects on 1000 pcs → 5.0%, passes (exactly at threshold)', async ({ page }) => {
    await setupMocks(page, { throughput: 1000 })
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByPlaceholder('Defect count').fill('50')
    await expect(page.getByText(/5\.0%/).first()).toBeVisible()
    await expect(page.getByText(/pass/i).first()).toBeVisible()
  })

  test('shows throughput readback', async ({ page }) => {
    await setupMocks(page, { throughput: 1000 })
    await page.goto('/log/qc')
    await scanBatch(page)

    await expect(page.getByText(/1000 pcs/)).toBeVisible()
  })

  test('shows threshold in spec label', async ({ page }) => {
    await setupMocks(page, { throughput: 1000 })
    await page.goto('/log/qc')
    await scanBatch(page)

    await expect(page.getByText(/scrap.*5%/i)).toBeVisible()
  })
})
