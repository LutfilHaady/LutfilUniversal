/**
 * Sprint 9 — J1 · Alert DB trigger surface
 *
 * Verifies that alerts produced by the two new DB triggers
 * (fn_alert_qc_fail, fn_alert_batch_held) render correctly in the UI.
 * The trigger shape is fixed: rule_key, dedup_key, severity come from the
 * trigger functions; this suite asserts the frontend surfaces them right.
 *
 * Mocks all Supabase REST calls. /rest/v1/users left real for auth context.
 */
import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const ALL_RULES = [
  { id: 'r-qf', key: 'qc_fail',             label: 'QC check failed',                    enabled: true,  severity: 'critical', threshold: null },
  { id: 'r-bh', key: 'batch_held',           label: 'Batch on Hold / Quarantine / Scrap', enabled: true,  severity: 'warning',  threshold: null },
  { id: 'r-mo', key: 'maintenance_overdue',  label: 'Equipment maintenance overdue',      enabled: false, severity: 'warning',  threshold: 0    },
  { id: 'r-es', key: 'expiry_soon',          label: 'Material nearing expiry',            enabled: false, severity: 'warning',  threshold: 7    },
  { id: 'r-ls', key: 'low_stock',            label: 'Material below minimum stock level', enabled: true,  severity: 'warning',  threshold: null },
]

// Exact shape fn_alert_qc_fail produces
const QC_FAIL_ALERT = {
  id: 'al-s9-qc',
  rule_key: 'qc_fail',
  dedup_key: 'qc_fail:e453a80c-d230-4924-9ee2-b6755e3612a5',
  severity: 'critical',
  message: 'MIXC-20260520-A01 failed QC: Homogeneity',
  batch_id: 'f8bd226a-54b1-41db-8457-d6fa7ab9bf9a',
  resolved_at: null,
  created_at: '2026-06-25T00:00:00Z',
}

// Exact shape fn_alert_batch_held produces
const BATCH_HELD_ALERT = {
  id: 'al-s9-bh',
  rule_key: 'batch_held',
  dedup_key: 'batch_held:4840216b-9246-4cc3-88fc-69050eee2b45:OnHold',
  severity: 'warning',
  message: 'UTPC-20260522-A02 is OnHold',
  batch_id: '4840216b-9246-4cc3-88fc-69050eee2b45',
  resolved_at: null,
  created_at: '2026-06-25T00:00:00Z',
}

function setupCommonMocks(page: import('@playwright/test').Page) {
  return async () => {
    await page.route(`**${SB}/rest/v1/alert_rules**`, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ALL_RULES) }))
    await page.route(`**${SB}/rest/v1/equipment_maintenance**`, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route(`**${SB}/rest/v1/batches**`, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route(`**${SB}/rest/v1/qc_check_results**`, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  }
}

test('qc_fail alert (trigger shape) renders as Critical on /alerts page', async ({ page }) => {
  await setupCommonMocks(page)()
  await page.route(`**${SB}/rest/v1/alerts**`, r => {
    const m = r.request().method()
    if (m === 'PATCH') return r.fulfill({ status: 204, body: '' })
    if (m === 'POST')  return r.fulfill({ status: 201, body: '' })
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([QC_FAIL_ALERT]) })
  })

  await page.goto('/alerts')
  await expect(page.getByText('MIXC-20260520-A01 failed QC: Homogeneity')).toBeVisible()
  // Critical severity badge is shown
  await expect(page.getByText('Critical').first()).toBeVisible()
})

test('qc_fail alert appears under Critical tab filter', async ({ page }) => {
  await setupCommonMocks(page)()
  await page.route(`**${SB}/rest/v1/alerts**`, r => {
    const m = r.request().method()
    if (m === 'PATCH') return r.fulfill({ status: 204, body: '' })
    if (m === 'POST')  return r.fulfill({ status: 201, body: '' })
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([QC_FAIL_ALERT]) })
  })

  await page.goto('/alerts')
  await page.getByRole('button', { name: /^Critical/ }).click()
  await expect(page.getByText('MIXC-20260520-A01 failed QC: Homogeneity')).toBeVisible()
})

test('batch_held alert (trigger shape) renders as Warning on /alerts page', async ({ page }) => {
  await setupCommonMocks(page)()
  await page.route(`**${SB}/rest/v1/alerts**`, r => {
    const m = r.request().method()
    if (m === 'PATCH') return r.fulfill({ status: 204, body: '' })
    if (m === 'POST')  return r.fulfill({ status: 201, body: '' })
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([BATCH_HELD_ALERT]) })
  })

  await page.goto('/alerts')
  await expect(page.getByText('UTPC-20260522-A02 is OnHold')).toBeVisible()
  await expect(page.getByText('Warning').first()).toBeVisible()
})

test('batch_held alert appears under Warning tab filter, absent from Critical', async ({ page }) => {
  await setupCommonMocks(page)()
  await page.route(`**${SB}/rest/v1/alerts**`, r => {
    const m = r.request().method()
    if (m === 'PATCH') return r.fulfill({ status: 204, body: '' })
    if (m === 'POST')  return r.fulfill({ status: 201, body: '' })
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([BATCH_HELD_ALERT]) })
  })

  await page.goto('/alerts')
  await page.getByRole('button', { name: /^Warning/ }).click()
  await expect(page.getByText('UTPC-20260522-A02 is OnHold')).toBeVisible()

  await page.getByRole('button', { name: /^Critical/ }).click()
  await expect(page.getByText('UTPC-20260522-A02 is OnHold')).not.toBeVisible()
})

test('both trigger-produced alerts render together; counts are correct', async ({ page }) => {
  await setupCommonMocks(page)()
  await page.route(`**${SB}/rest/v1/alerts**`, r => {
    const m = r.request().method()
    if (m === 'PATCH') return r.fulfill({ status: 204, body: '' })
    if (m === 'POST')  return r.fulfill({ status: 201, body: '' })
    return r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([QC_FAIL_ALERT, BATCH_HELD_ALERT]),
    })
  })

  await page.goto('/alerts')
  await expect(page.getByText('MIXC-20260520-A01 failed QC: Homogeneity')).toBeVisible()
  await expect(page.getByText('UTPC-20260522-A02 is OnHold')).toBeVisible()

  // All tab shows count 2
  await expect(page.getByRole('button', { name: /^All/ })).toContainText('2')
  // Critical count 1, Warning count 1
  await expect(page.getByRole('button', { name: /^Critical/ })).toContainText('1')
  await expect(page.getByRole('button', { name: /^Warning/ })).toContainText('1')
})
