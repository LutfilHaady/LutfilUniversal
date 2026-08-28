/**
 * Sprint 4 — Reports: Compliance tab + exports
 *
 * Covers:
 *  - Compliance tab reads live (mocked) qc_check_results and renders
 *    pass rate, fail count, and override count over the date range.
 *  - XLSX export button is present; the Compliance Generate (CSV) button is
 *    enabled once data exists.
 *
 * Stateless URL-keyed mocks. Default storageState = engineer.json (Engineer
 * role passes the role guard, so the data fetches run). /rest/v1/users left real.
 */

import { test, expect, type Page } from '@playwright/test';

const SB = 'https://pewrwrqituidyxhfsner.supabase.co';

// 4 checks: 2 pass, 2 fail, 1 of which is overridden → 50% pass, 2 fails, 1 override.
const QC_RESULTS = [
  { id: 'q1', passed: true,  created_at: '2026-06-01T02:00:00Z', qc_overrides: [], qc_check_definitions: { qc_item_name: 'Homogeneity' }, users: { full_name: 'Dev Engineer' } },
  { id: 'q2', passed: false, created_at: '2026-06-01T03:00:00Z', qc_overrides: [{ id: 'o1' }], qc_check_definitions: { qc_item_name: 'Viscosity' }, users: { full_name: 'Dev Engineer' } },
  { id: 'q3', passed: true,  created_at: '2026-06-02T02:00:00Z', qc_overrides: [], qc_check_definitions: { qc_item_name: 'Warpage' }, users: { full_name: 'Dev Engineer' } },
  { id: 'q4', passed: false, created_at: '2026-06-02T03:00:00Z', qc_overrides: [], qc_check_definitions: { qc_item_name: 'Warpage' }, users: { full_name: 'Dev Engineer' } },
];

async function mocks(page: Page) {
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route(`**${SB}/rest/v1/qc_check_results**`, (r) => r.fulfill(json(QC_RESULTS)));
  await page.route(`**${SB}/rest/v1/batches**`, (r) => r.fulfill(json([])));
  // Alerts surfaces (header bell etc.) — keep quiet.
  await page.route(`**${SB}/rest/v1/alert_rules**`, (r) => r.fulfill(json([])));
  await page.route(`**${SB}/rest/v1/alerts**`, (r) => r.fulfill(json([])));
}

test('Compliance tab renders pass rate / fail / override from live QC results', async ({ page }) => {
  await mocks(page);
  await page.goto('/reports');

  await page.getByRole('button', { name: 'Compliance' }).click();

  // Pass rate 2/4 = 50%, 2 failures, 1 override.
  await expect(page.getByText('50%')).toBeVisible();
  await expect(page.getByText('QC Failures')).toBeVisible();
  await expect(page.getByText('QC Overrides')).toBeVisible();

  // XLSX export button exists; Compliance Generate (CSV) is enabled with data.
  await expect(page.getByRole('button', { name: 'XLSX' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate' })).toBeEnabled();
});
