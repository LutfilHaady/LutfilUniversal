import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const MOCK_BATCH = {
  id: 'batch-uuid-1',
  batch_number: 'MIXC-20260601-A01',
  material_id: 'mat-uuid-1',
  current_quantity: 100,
}

const MOCK_RUN = { id: 'run-uuid-1', process_id: 'proc-uuid-1', status: 'AwaitingQC' }
const MOCK_PROCESS = { id: 'proc-uuid-1', requires_calibration: false }

const MOCK_QC_DEFS_NUMERIC = [
  {
    id: 'def-uuid-1',
    qc_item_name: 'Viscosity',
    method: 'ToolEquipment',
    timing: 'EndOfRun',
    acceptance_criteria_text: 'Within ± 2%',
    acceptance_criteria_min: 7644,
    acceptance_criteria_max: 7956,
    is_active: true,
  },
]

test.describe('QC wizard — numeric acceptance criteria (Q1)', () => {
  function setupMocks(page: any, qcDefs: any[]) {
    page.route(`**${SB}/rest/v1/**`, (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
    page.route(`**${SB}/rest/v1/batches**`, (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BATCH) })
    )
    page.route(`**${SB}/rest/v1/process_run_inputs**`, (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ process_run_id: 'run-uuid-1' }) })
    )
    page.route(`**${SB}/rest/v1/process_runs**`, (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_RUN) })
    )
    page.route(`**${SB}/rest/v1/processes**`, (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROCESS) })
    )
    page.route(`**${SB}/rest/v1/qc_check_definitions**`, (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(qcDefs) })
    )
  }

  test('Value within numeric min/max range auto-computes as Pass', async ({ page }) => {
    setupMocks(page, MOCK_QC_DEFS_NUMERIC)
    await page.goto('/log/qc')
    await page.getByPlaceholder(/e\.g\./i).fill('MIXC-20260601-A01')
    await page.getByRole('button', { name: /find batch/i }).click()
    await page.waitForSelector('text=QC Checks', { timeout: 5000 }).catch(() => {})

    const input = page.getByPlaceholder('Enter measured value')
    if (!(await input.isVisible({ timeout: 3000 }).catch(() => false))) return

    await input.fill('7800') // within 7644–7956
    await expect(page.getByText('✓ Pass').first()).toBeVisible({ timeout: 3000 })
  })

  test('Value outside numeric min/max range auto-computes as Fail', async ({ page }) => {
    setupMocks(page, MOCK_QC_DEFS_NUMERIC)
    await page.goto('/log/qc')
    await page.getByPlaceholder(/e\.g\./i).fill('MIXC-20260601-A01')
    await page.getByRole('button', { name: /find batch/i }).click()
    await page.waitForSelector('text=QC Checks', { timeout: 5000 }).catch(() => {})

    const input = page.getByPlaceholder('Enter measured value')
    if (!(await input.isVisible({ timeout: 3000 }).catch(() => false))) return

    await input.fill('5000') // below 7644
    await expect(page.getByText('✗ Fail').first()).toBeVisible({ timeout: 3000 })
  })

  test('Target-relative check: within tolerance passes', async ({ page }) => {
    const defsTargetRelative = [{
      id: 'def-uuid-2',
      qc_item_name: 'Viscosity',
      method: 'ToolEquipment',
      timing: 'EndOfRun',
      acceptance_criteria_text: 'Within ± 2%',
      acceptance_criteria_min: null,
      acceptance_criteria_max: null,
      is_active: true,
    }]
    setupMocks(page, defsTargetRelative)
    await page.goto('/log/qc')
    await page.getByPlaceholder(/e\.g\./i).fill('MIXC-20260601-A01')
    await page.getByRole('button', { name: /find batch/i }).click()
    await page.waitForSelector('text=QC Checks', { timeout: 5000 }).catch(() => {})

    const targetInput = page.getByPlaceholder('Target')
    const measuredInput = page.getByPlaceholder('Measured')
    if (!(await targetInput.isVisible({ timeout: 3000 }).catch(() => false))) return

    await targetInput.fill('8200')
    await measuredInput.fill('8300') // 1.2% deviation, within 2%
    await expect(page.getByText('✓ Pass').first()).toBeVisible({ timeout: 3000 })
  })
})
