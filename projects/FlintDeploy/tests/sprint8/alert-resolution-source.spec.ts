/**
 * Sprint 8 — J1 · Alert resolution source
 *
 * Verifies:
 *  1. Manual dismiss (Engineer clicking ×) sends PATCH with
 *     resolution_source='manual' and resolved_by set to the user's UUID.
 *  2. Auto-resolve (scanAlerts stale-condition path) sends PATCH with
 *     resolution_source='auto' and no resolved_by.
 *
 * /rest/v1/users is left real so auth context resolves the correct role.
 */
import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const OPEN_ALERT = {
  id: 'al-sprint8-1',
  severity: 'warning',
  message: 'MIXC-A01 is OnHold',
  batch_id: 'b-s8-1',
  resolved_at: null,
  created_at: '2026-06-20T00:00:00Z',
  rule_key: 'batch_held',
  dedup_key: 'batch_held:b-s8-1:OnHold',
}

const BATCH_HELD_RULE = [
  { id: 'r-bh', key: 'batch_held', label: 'Batch on Hold', enabled: true, severity: 'warning', threshold: null },
]

test('manual dismiss PATCH body has resolution_source=manual and resolved_by set', async ({ page }) => {
  // Condition still holds (batch is still OnHold) → no auto-resolve fires.
  // The only PATCH is from the user clicking dismiss.
  await page.route(`**${SB}/rest/v1/alert_rules**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BATCH_HELD_RULE) }))
  await page.route(`**${SB}/rest/v1/qc_check_results**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/equipment_maintenance**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  // Held batch still exists → desired dedup_key matches → no auto-resolve PATCH.
  await page.route(`**${SB}/rest/v1/batches**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'b-s8-1', batch_number: 'MIXC-A01', status: 'OnHold' }]) }))
  await page.route(`**${SB}/rest/v1/alerts**`, async route => {
    const m = route.request().method()
    if (m === 'PATCH') return route.fulfill({ status: 204, body: '' })
    if (m === 'POST')  return route.fulfill({ status: 201, body: '' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([OPEN_ALERT]) })
  })

  const patchWait = page.waitForRequest(
    req => req.url().includes('/rest/v1/alerts') && req.method() === 'PATCH')

  await page.goto('/alerts')
  await expect(page.getByText('MIXC-A01 is OnHold')).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss alert' }).first().click()

  const patchReq = await patchWait
  const body = JSON.parse(patchReq.postData() ?? '{}')
  expect(body.resolution_source).toBe('manual')
  expect(body.resolved_by).toBeTruthy()
})

test('auto-resolve PATCH body has resolution_source=auto, resolved_by absent', async ({ page }) => {
  // Condition no longer holds (no held batches) → scanAlerts auto-resolves the stale alert.
  await page.route(`**${SB}/rest/v1/alert_rules**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BATCH_HELD_RULE) }))
  await page.route(`**${SB}/rest/v1/qc_check_results**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/equipment_maintenance**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  // Empty batches → desired is empty → stale open alert is auto-resolved.
  await page.route(`**${SB}/rest/v1/batches**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/alerts**`, async route => {
    const m = route.request().method()
    if (m === 'PATCH') return route.fulfill({ status: 204, body: '' })
    if (m === 'POST')  return route.fulfill({ status: 201, body: '' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([OPEN_ALERT]) })
  })

  const patchWait = page.waitForRequest(
    req => req.url().includes('/rest/v1/alerts') && req.method() === 'PATCH')
  await page.goto('/dashboard')
  const patchReq = await patchWait

  const body = JSON.parse(patchReq.postData() ?? '{}')
  expect(body.resolution_source).toBe('auto')
  expect(body.resolved_by).toBeFalsy()
})
