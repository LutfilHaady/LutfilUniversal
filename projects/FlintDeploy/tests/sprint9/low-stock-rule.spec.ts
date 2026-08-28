/**
 * Sprint 9 — J2 · Low-stock alert rule in Admin panel
 *
 * Verifies that the new 'low_stock' alert rule added to alert_rules is
 * correctly surfaced in the Admin → Settings → Alert Rules panel.
 *
 * /rest/v1/users left real for auth context.
 */
import { test, expect } from '@playwright/test'

// Admin page is gated to Admin role — use the admin session for all tests here
test.use({ storageState: 'tests/.auth/admin.json' })

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const ALL_RULES = [
  { id: 'r-bh', key: 'batch_held',          label: 'Batch on Hold / Quarantine / Scrap', enabled: true,  severity: 'warning',  threshold: null },
  { id: 'r-es', key: 'expiry_soon',          label: 'Material nearing expiry',            enabled: true,  severity: 'warning',  threshold: 7    },
  { id: 'r-ls', key: 'low_stock',            label: 'Material below minimum stock level', enabled: true,  severity: 'warning',  threshold: null },
  { id: 'r-mo', key: 'maintenance_overdue',  label: 'Equipment maintenance overdue',      enabled: true,  severity: 'warning',  threshold: 0    },
  { id: 'r-qf', key: 'qc_fail',             label: 'QC check failed',                    enabled: true,  severity: 'critical', threshold: null },
]

test('low_stock rule appears in Admin Alert Rules panel with correct label and key', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/alert_rules**`, r => {
    if (r.request().method() === 'PATCH') return r.fulfill({ status: 204, body: '' })
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ALL_RULES) })
  })

  await page.goto('/admin')
  await page.getByRole('button', { name: 'Settings' }).click()

  await expect(page.getByText('Material below minimum stock level')).toBeVisible()
  await expect(page.getByText('low_stock')).toBeVisible()
})

test('low_stock rule toggle is enabled by default', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/alert_rules**`, r => {
    if (r.request().method() === 'PATCH') return r.fulfill({ status: 204, body: '' })
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ALL_RULES) })
  })

  await page.goto('/admin')
  await page.getByRole('button', { name: 'Settings' }).click()

  const toggle = page.getByRole('switch', { name: /Material below minimum stock level/i })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
})

test('five alert rules shown (including new low_stock)', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/alert_rules**`, r => {
    if (r.request().method() === 'PATCH') return r.fulfill({ status: 204, body: '' })
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ALL_RULES) })
  })

  await page.goto('/admin')
  await page.getByRole('button', { name: 'Settings' }).click()

  await expect(page.getByRole('switch')).toHaveCount(5)
})
