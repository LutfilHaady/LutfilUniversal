/**
 * Machine active toggle + delete (app/machines/page.tsx) — Task 3b
 * Admin role required. Asserts toggle PATCHes /rest/v1/equipment, delete with
 * 204 removes the row, and delete returning a 23503 FK error keeps the row and
 * shows the "in use" message.
 *
 * NOTE: the saved Playwright session is the Engineer account, but the machines
 * page gates the toggle/delete on Admin. This spec stubs the /rest/v1/users
 * lookup to return an Admin role for the signed-in id (the one case where we
 * mock users — required to exercise the Admin-gated controls).
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const EQ_ID = '22222222-2222-2222-2222-222222222222'

async function adminUser(page: Page) {
  await page.route(`**${SB}/rest/v1/users**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ full_name: 'Dev Admin', role_id: 'r-admin', roles: { name: 'Admin' } }),
  }))
}

async function equipmentMock(page: Page, opts: { deleteStatus: number; calls: { patched: boolean; deleted: boolean } }) {
  await page.route(`**${SB}/rest/v1/equipment**`, async route => {
    const method = route.request().method()
    if (method === 'PATCH') { opts.calls.patched = true; return route.fulfill({ status: 204, body: '' }) }
    if (method === 'DELETE') {
      opts.calls.deleted = true
      if (opts.deleteStatus === 204) return route.fulfill({ status: 204, body: '' })
      return route.fulfill({
        status: 409, contentType: 'application/json',
        body: JSON.stringify({ code: '23503', message: 'update or delete on table "equipment" violates foreign key constraint' }),
      })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: EQ_ID, equipment_code: 'MIX-01', name: 'Cathode Mixer', process_id: 'p1',
        supplier_info: 'Ross', is_active: true, created_at: '2026-05-21',
        process: { name: 'Mixing (Cathode)', code: 'MIXC' }, equipment_maintenance: [],
      }]),
    })
  })
}

test('toggling a machine active state PATCHes Supabase', async ({ page }) => {
  const calls = { patched: false, deleted: false }
  await adminUser(page)
  await equipmentMock(page, { deleteStatus: 204, calls })
  await page.goto('/machines')

  await expect(page.getByText('Cathode Mixer')).toBeVisible()
  const row = page.getByRole('row', { name: /MIX-01/ })
  await row.locator('label').first().click()
  await expect.poll(() => calls.patched).toBe(true)
})

test('deleting a machine DELETEs and removes the row', async ({ page }) => {
  const calls = { patched: false, deleted: false }
  await adminUser(page)
  await equipmentMock(page, { deleteStatus: 204, calls })
  page.on('dialog', d => d.accept())
  await page.goto('/machines')

  await page.getByRole('row', { name: /MIX-01/ }).click() // expand
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect.poll(() => calls.deleted).toBe(true)
  await expect(page.getByText('Cathode Mixer')).toHaveCount(0)
})

test('delete blocked by FK shows the in-use message and keeps the row', async ({ page }) => {
  const calls = { patched: false, deleted: false }
  await adminUser(page)
  await equipmentMock(page, { deleteStatus: 409, calls })
  page.on('dialog', d => d.accept())
  await page.goto('/machines')

  await page.getByRole('row', { name: /MIX-01/ }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Cannot delete — equipment is in use')).toBeVisible()
  await expect(page.getByText('Cathode Mixer')).toBeVisible()
})

test('a failed toggle PATCH rolls back and shows an error toast', async ({ page }) => {
  await adminUser(page)
  await page.route(`**${SB}/rest/v1/equipment**`, async route => {
    const method = route.request().method()
    if (method === 'PATCH') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'server error' }) })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: EQ_ID, equipment_code: 'MIX-01', name: 'Cathode Mixer', process_id: 'p1',
        supplier_info: 'Ross', is_active: true, created_at: '2026-05-21',
        process: { name: 'Mixing (Cathode)', code: 'MIXC' }, equipment_maintenance: [],
      }]),
    })
  })
  await page.goto('/machines')

  const row = page.getByRole('row', { name: /MIX-01/ })
  await expect(row.locator('input[type="checkbox"]')).toBeChecked()
  await row.locator('label').first().click()

  await expect(page.getByText('Could not update MIX-01')).toBeVisible()
  // Rollback restored the original checked state.
  await expect(row.locator('input[type="checkbox"]')).toBeChecked()
})
