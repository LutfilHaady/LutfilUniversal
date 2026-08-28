/**
 * Customisable Alerts MVP
 *
 * Covers:
 *  - Dashboard AlertPanel renders live (mocked) alerts; Engineer can dismiss (PATCH)
 *  - Admin Settings → Alert Rules panel renders the rule catalog; toggling persists (PATCH)
 *
 * Stateless URL-keyed mocks. Candidate-source tables (qc_check_results, batches,
 * equipment_maintenance) return [] so the scan inserts nothing and the alerts GET
 * drives the UI. /rest/v1/users is left real so the auth context resolves the role.
 */

import { test, expect, type Page } from '@playwright/test';

const SB = 'https://pewrwrqituidyxhfsner.supabase.co';

const ALERTS = [
  { id: 'al-1', severity: 'critical', message: 'DICC-A02 failed QC: Warpage', batch_id: 'b1', resolved_at: null, created_at: '2026-06-04T02:00:00Z' },
  { id: 'al-2', severity: 'warning',  message: 'MTC1-A01 is OnHold',           batch_id: 'b2', resolved_at: null, created_at: '2026-06-04T01:00:00Z' },
];

const RULES = [
  { id: 'r1', key: 'qc_fail',             label: 'QC check failed',                    enabled: true, severity: 'critical', threshold: null },
  { id: 'r2', key: 'batch_held',          label: 'Batch on Hold / Quarantine / Scrap', enabled: true, severity: 'warning',  threshold: null },
  { id: 'r3', key: 'maintenance_overdue', label: 'Equipment maintenance overdue',      enabled: true, severity: 'warning',  threshold: 0 },
  { id: 'r4', key: 'expiry_soon',         label: 'Material nearing expiry',            enabled: true, severity: 'warning',  threshold: 7 },
];

async function mocks(page: Page) {
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route(`**${SB}/rest/v1/alerts**`, (r) => {
    const m = r.request().method();
    if (m === 'PATCH') return r.fulfill({ status: 204, body: '' });
    if (m === 'POST') return r.fulfill({ status: 201, body: '' });
    return r.fulfill(json(ALERTS));
  });
  await page.route(`**${SB}/rest/v1/alert_rules**`, (r) => {
    if (r.request().method() === 'PATCH') return r.fulfill({ status: 204, body: '' });
    return r.fulfill(json(RULES));
  });
  for (const t of ['qc_check_results', 'equipment_maintenance', 'batches']) {
    await page.route(`**${SB}/rest/v1/${t}**`, (r) => r.fulfill(json([])));
  }
}

test('dashboard AlertPanel shows live alerts and Engineer can dismiss', async ({ page }) => {
  await mocks(page);
  await page.goto('/dashboard');

  // Critical tab is active by default → the critical alert is shown.
  // (The message also appears in the dashboard banner, hence .first().)
  await expect(page.getByText('DICC-A02 failed QC: Warpage').first()).toBeVisible();

  // Dismiss the row (panel uses aria-label "Dismiss alert"; banner uses "Dismiss").
  const patchWait = page.waitForRequest(
    (req) => req.url().includes('/rest/v1/alerts') && req.method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Dismiss alert' }).first().click();
  await patchWait;
});

test.describe('admin', () => {
  test.use({ storageState: 'tests/.auth/admin.json' });

  test('Settings → Alert Rules renders and toggling persists', async ({ page }) => {
    await mocks(page);
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.getByText('Alert Rules')).toBeVisible();
    await expect(page.getByText('QC check failed')).toBeVisible();

    const patchWait = page.waitForRequest(
      (req) => req.url().includes('/rest/v1/alert_rules') && req.method() === 'PATCH',
    );
    await page.getByRole('switch', { name: 'Toggle QC check failed' }).click();
    await patchWait;
  });
});
