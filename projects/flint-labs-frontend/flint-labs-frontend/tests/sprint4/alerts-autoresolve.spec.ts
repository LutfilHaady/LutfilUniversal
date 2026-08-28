/**
 * Sprint 4 — Alerts auto-resolve
 *
 * Covers:
 *  - An open alert whose underlying condition has cleared is auto-resolved by the
 *    scan pass (a PATCH to /rest/v1/alerts sets resolved_at), without anyone
 *    clicking dismiss.
 *
 * Setup: alert_rules enabled, but every candidate-source table returns [] so no
 * condition holds (desired = ∅). The alerts GET returns one open alert carrying a
 * dedup_key + an enabled rule_key → the scan must resolve it.
 * Stateless URL-keyed mocks; /rest/v1/users left real for the auth context.
 */

import { test, expect, type Page } from '@playwright/test';

const SB = 'https://pewrwrqituidyxhfsner.supabase.co';

const RULES = [
  { id: 'r2', key: 'batch_held', label: 'Batch on Hold / Quarantine / Scrap', enabled: true, severity: 'warning', threshold: null },
];

// Open alert for a condition that no longer holds (no batch is OnHold anymore).
const STALE_ALERT = [
  { id: 'al-stale', severity: 'warning', message: 'MTC1-A01 is OnHold', batch_id: 'b2', resolved_at: null, created_at: '2026-06-01T00:00:00Z', rule_key: 'batch_held', dedup_key: 'batch_held:b2:OnHold' },
];

async function mocks(page: Page) {
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route(`**${SB}/rest/v1/alert_rules**`, (r) => r.fulfill(json(RULES)));
  await page.route(`**${SB}/rest/v1/alerts**`, (r) => {
    const m = r.request().method();
    if (m === 'PATCH') return r.fulfill({ status: 204, body: '' });
    if (m === 'POST') return r.fulfill({ status: 201, body: '' });
    return r.fulfill(json(STALE_ALERT));
  });
  // No condition holds → desired is empty → the stale alert must be auto-resolved.
  for (const t of ['qc_check_results', 'equipment_maintenance', 'batches']) {
    await page.route(`**${SB}/rest/v1/${t}**`, (r) => r.fulfill(json([])));
  }
}

test('scan auto-resolves an open alert whose condition has cleared', async ({ page }) => {
  await mocks(page);

  const patchWait = page.waitForRequest(
    (req) => req.url().includes('/rest/v1/alerts') && req.method() === 'PATCH',
  );
  await page.goto('/dashboard');
  await patchWait; // auto-resolve PATCH fired with no manual dismiss
});
