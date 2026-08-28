/**
 * Sprint 4 — Task 2: Dashboard KPI expansion
 *
 * Verifies the three new KPI cards render correctly on the dashboard:
 *  - First-Pass Yield (7d): shows % when data exists, "Not yet available" when not
 *  - Top Defect (7d): shows item name when failures exist, "None" when not
 *  - Active Alerts: shows count when unresolved alerts exist, 0 / "all clear" when not
 *
 * All Supabase REST calls mocked; /rest/v1/users left real for auth.
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const RUN_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const RUN_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const DEF_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

// QC results: run A passes all, run B fails one
const QC_RESULTS_WITH_DATA = [
  { id: '1', process_run_id: RUN_A, passed: true,  created_at: new Date().toISOString(), result_value_numeric: null, result_value_boolean: true,  qc_check_definitions: { acceptance_criteria_text: null } },
  { id: '2', process_run_id: RUN_A, passed: true,  created_at: new Date().toISOString(), result_value_numeric: null, result_value_boolean: true,  qc_check_definitions: { acceptance_criteria_text: null } },
  { id: '3', process_run_id: RUN_B, passed: false, created_at: new Date().toISOString(), result_value_numeric: null, result_value_boolean: false, qc_check_definitions: { acceptance_criteria_text: null, qc_item_name: 'Viscosity' } },
]

// Failed QC results for top-defect
const QC_FAILURES = [
  { id: '3', passed: false, created_at: new Date().toISOString(), qc_check_definitions: [{ qc_item_name: 'Viscosity' }] },
  { id: '4', passed: false, created_at: new Date().toISOString(), qc_check_definitions: [{ qc_item_name: 'Viscosity' }] },
  { id: '5', passed: false, created_at: new Date().toISOString(), qc_check_definitions: [{ qc_item_name: 'Warpage' }] },
]

const ACTIVE_ALERTS = [
  { id: 'a1', severity: 'high', message: 'QC failed', batch_id: null, resolved_at: null, created_at: new Date().toISOString(), rule_key: 'qc_fail', dedup_key: 'qc_fail:batch1' },
  { id: 'a2', severity: 'medium', message: 'On hold', batch_id: null, resolved_at: null, created_at: new Date().toISOString(), rule_key: 'batch_held', dedup_key: 'batch_held:batch2' },
]

async function setupDashboardMocks(
  page: Page,
  opts: {
    qcResults?: unknown[]
    qcFailures?: unknown[]
    alerts?: unknown[]
  } = {}
) {
  const qcResults  = opts.qcResults  ?? []
  const qcFailures = opts.qcFailures ?? []
  const alerts     = opts.alerts     ?? []

  await page.route(`**${SB}/rest/v1/batches**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  await page.route(`**${SB}/rest/v1/alerts**`, async route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(alerts),
    })
  )

  await page.route(`**${SB}/rest/v1/qc_check_results**`, async route => {
    const url = route.request().url()
    if (url.includes('passed=eq.false')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(qcFailures),
      })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(qcResults),
    })
  })

  await page.route(`**${SB}/rest/v1/alert_rules**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
}

test('first-pass yield shows percentage when run data exists', async ({ page }) => {
  await setupDashboardMocks(page, {
    qcResults: QC_RESULTS_WITH_DATA,
    qcFailures: QC_FAILURES,
    alerts: ACTIVE_ALERTS,
  })
  await page.goto('/dashboard')
  await expect(page.getByText('First-Pass Yield (7d)')).toBeVisible({ timeout: 8000 })
  // 1 of 2 runs fully passed = 50%
  await expect(page.getByText('50%')).toBeVisible()
})

test('first-pass yield shows "Not yet available" when no QC data', async ({ page }) => {
  await setupDashboardMocks(page, { qcResults: [], qcFailures: [], alerts: [] })
  await page.goto('/dashboard')
  await expect(page.getByText('First-Pass Yield (7d)')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('Not yet available')).toBeVisible()
})

test('top defect shows most common QC failure item name', async ({ page }) => {
  await setupDashboardMocks(page, {
    qcResults: QC_RESULTS_WITH_DATA,
    qcFailures: QC_FAILURES,
    alerts: [],
  })
  await page.goto('/dashboard')
  await expect(page.getByText('Top Defect (7d)')).toBeVisible({ timeout: 8000 })
  // Viscosity appears twice vs Warpage once
  await expect(page.getByText('Viscosity')).toBeVisible()
})

test('top defect shows "None" when no failures', async ({ page }) => {
  await setupDashboardMocks(page, { qcResults: [], qcFailures: [], alerts: [] })
  await page.goto('/dashboard')
  await expect(page.getByText('Top Defect (7d)')).toBeVisible({ timeout: 8000 })
  // "None" appears in the value slot
  const topDefectCard = page.locator('[data-testid="kpi-top-defect"]')
    .or(page.locator('div').filter({ hasText: /^None$/ }))
  await expect(page.getByText(/^None$/)).toBeVisible()
})

test('active alerts card shows unresolved count', async ({ page }) => {
  await setupDashboardMocks(page, {
    qcResults: [],
    qcFailures: [],
    alerts: ACTIVE_ALERTS,
  })
  await page.goto('/dashboard')
  await expect(page.getByText('Active Alerts')).toBeVisible({ timeout: 8000 })
  // 'unresolved alerts' sub-text is unique to the Active Alerts card when count > 0
  await expect(page.getByText('unresolved alerts')).toBeVisible()
})

test('active alerts shows 0 when all resolved', async ({ page }) => {
  await setupDashboardMocks(page, { qcResults: [], qcFailures: [], alerts: [] })
  await page.goto('/dashboard')
  await expect(page.getByText('Active Alerts')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('all clear')).toBeVisible()
})
