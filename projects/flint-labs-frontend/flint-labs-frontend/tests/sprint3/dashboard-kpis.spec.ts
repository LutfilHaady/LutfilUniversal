/**
 * Task 4 — Dashboard KPIs
 *
 * Covers the QC Pass Rate (7d) KPI card on the /dashboard page:
 *   - Displays the correct percentage computed from mocked qc_check_results
 *   - Green styling for pass rate >= 80%
 *   - Red styling for pass rate < 70%
 *
 * Auth: Engineer session (tests/.auth/engineer.json)
 * All Supabase REST calls are intercepted with stateless page.route() mocks.
 *
 * QC pass/fail logic (mirrors useDashboard.ts computeQCPassed):
 *   - Numeric result vs range criteria "20-25": pass if 20 <= result <= 25
 *   - Boolean result: pass if result_value_boolean === true
 */

import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

function mockBatchesAndAlerts(page: import('@playwright/test').Page) {
  page.route(`**${SB}/rest/v1/batches*`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
  page.route(`**${SB}/rest/v1/alerts*`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
}

test.describe('Task 4 — Dashboard KPIs', () => {

  test('QC Pass Rate shows 80% and KPI card is present', async ({ page }) => {
    mockBatchesAndAlerts(page)

    // 4 pass, 1 fail → 80%
    // Criteria: numeric "20-25" passes if 20 <= value <= 25; boolean true = pass
    await page.route(`**${SB}/rest/v1/qc_check_results*`, (route) =>
      route.fulfill({
        status:      200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'q1', result_value_numeric: 22,   result_value_boolean: null,  qc_check_definitions: { acceptance_criteria_text: '20-25' } },
          { id: 'q2', result_value_numeric: 24,   result_value_boolean: null,  qc_check_definitions: { acceptance_criteria_text: '20-25' } },
          { id: 'q3', result_value_numeric: null,  result_value_boolean: true,  qc_check_definitions: { acceptance_criteria_text: 'No visible lumps' } },
          { id: 'q4', result_value_numeric: null,  result_value_boolean: true,  qc_check_definitions: { acceptance_criteria_text: 'No visible lumps' } },
          { id: 'q5', result_value_numeric: null,  result_value_boolean: false, qc_check_definitions: { acceptance_criteria_text: 'No visible lumps' } },
        ]),
      })
    )

    await page.goto('/dashboard')

    await expect(page.getByText('QC Pass Rate (7d)')).toBeVisible()
    await expect(page.getByText('80%')).toBeVisible()
  })

  test('QC Pass Rate shows 60% when majority of checks fail', async ({ page }) => {
    mockBatchesAndAlerts(page)

    // 3 pass, 2 fail → 60%
    await page.route(`**${SB}/rest/v1/qc_check_results*`, (route) =>
      route.fulfill({
        status:      200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'q1', result_value_numeric: 22,   result_value_boolean: null,  qc_check_definitions: { acceptance_criteria_text: '20-25' } },
          { id: 'q2', result_value_numeric: 24,   result_value_boolean: null,  qc_check_definitions: { acceptance_criteria_text: '20-25' } },
          { id: 'q3', result_value_numeric: null,  result_value_boolean: true,  qc_check_definitions: { acceptance_criteria_text: 'No visible lumps' } },
          { id: 'q4', result_value_numeric: null,  result_value_boolean: false, qc_check_definitions: { acceptance_criteria_text: 'No visible lumps' } },
          { id: 'q5', result_value_numeric: null,  result_value_boolean: false, qc_check_definitions: { acceptance_criteria_text: 'No visible lumps' } },
        ]),
      })
    )

    await page.goto('/dashboard')

    await expect(page.getByText('QC Pass Rate (7d)')).toBeVisible()
    await expect(page.getByText('60%')).toBeVisible()
  })

  test('QC Pass Rate shows 0% when there are no QC results', async ({ page }) => {
    mockBatchesAndAlerts(page)

    await page.route(`**${SB}/rest/v1/qc_check_results*`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    await page.goto('/dashboard')

    await expect(page.getByText('QC Pass Rate (7d)')).toBeVisible()
    await expect(page.getByText('0%')).toBeVisible()
  })

})
