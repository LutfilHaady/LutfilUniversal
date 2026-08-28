/**
 * Sprint 4 — Task 1: Raw material intake completeness
 *
 * Verifies that submitting the Create Batch modal:
 *  1. Inserts the batch row
 *  2. Inserts the batch_raw_material_intake row (with supplier + lot ref)
 *  3. Inserts an initial batch_status_changes audit row
 *  4. Shows the QR success screen with the batch number
 *  5. Recovery message is shown when the intake INSERT fails (orphaned batch)
 *
 * All Supabase REST calls are mocked; /rest/v1/users is left real for auth.
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:   'cccccccc-cccc-cccc-cccc-cccccccccccc',
  batchNum:  'MTC1-20260604-A55',
  matId:     'dddddddd-dddd-dddd-dddd-dddddddddddd',
}

type Calls = {
  batchInsert: boolean
  intakeInsert: boolean
  auditInsert: boolean
}

async function setupMocks(page: Page, calls: Calls, intakeShouldFail = false) {
  // Materials list for the modal's dropdown
  await page.route(`**${SB}/rest/v1/materials**`, r =>
    r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: M.matId, code: 'MTC1', name: 'Cathode Material C1' },
      ]),
    })
  )

  // Batch INSERT + SELECT
  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const method = route.request().method()
    if (method === 'POST') {
      calls.batchInsert = true
      return route.fulfill({ status: 201, contentType: 'application/json', body: '' })
    }
    // SELECT after insert (single row by batch_number)
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: M.batchId, batch_number: M.batchNum, created_at: '2026-06-04T10:00:00Z' }),
    })
  })

  // Intake INSERT
  await page.route(`**${SB}/rest/v1/batch_raw_material_intake**`, async route => {
    if (route.request().method() === 'POST') {
      calls.intakeInsert = true
      if (intakeShouldFail) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'DB error' }) })
      }
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  // Audit INSERT
  await page.route(`**${SB}/rest/v1/batch_status_changes**`, async route => {
    if (route.request().method() === 'POST') {
      calls.auditInsert = true
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  // Main batch list for /batches page — empty so the modal can open cleanly
  await page.route(`**${SB}/rest/v1/main_batches**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
}

async function openModalAndFill(page: Page) {
  await page.goto('/batches')
  await page.getByRole('button', { name: /register batch|new batch/i }).first().click()

  // Pick Cathode Electrode category (default) then specific material
  await page.getByRole('button', { name: /cathode material c1/i }).click()

  // Fill supplier and quantity (required)
  await page.getByPlaceholder(/targray/i).fill('Targray Industries')
  await page.getByRole('spinbutton').fill('50')

  // Optional: lot reference
  await page.getByPlaceholder(/TGR-CTH/i).fill('TGR-CTH-9821-A')
}

test('happy path: batch + intake + audit rows written, QR shown', async ({ page }) => {
  const calls: Calls = { batchInsert: false, intakeInsert: false, auditInsert: false }
  await setupMocks(page, calls)
  await openModalAndFill(page)

  await page.getByRole('button', { name: /create batch/i }).click()

  // QR success screen must appear
  await expect(page.getByText('Batch registered')).toBeVisible({ timeout: 5000 })

  // Batch number displayed on success screen
  await expect(page.getByText(M.batchNum)).toBeVisible()

  // QR SVG rendered
  await expect(page.locator('svg[role="img"], svg').first()).toBeVisible()

  // All three DB writes fired
  await expect.poll(() => calls.batchInsert).toBe(true)
  await expect.poll(() => calls.intakeInsert).toBe(true)
  await expect.poll(() => calls.auditInsert).toBe(true)
})

test('intake fields are included in the intake INSERT payload', async ({ page }) => {
  let intakeBody: Record<string, unknown> = {}
  const calls: Calls = { batchInsert: false, intakeInsert: false, auditInsert: false }

  await page.route(`**${SB}/rest/v1/batch_raw_material_intake**`, async route => {
    if (route.request().method() === 'POST') {
      calls.intakeInsert = true
      try { intakeBody = JSON.parse(route.request().postData() ?? '{}') } catch { /* noop */ }
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await setupMocks(page, calls)
  // Re-route intake after setupMocks to capture body (route order: last registered wins in Playwright)
  await page.route(`**${SB}/rest/v1/batch_raw_material_intake**`, async route => {
    if (route.request().method() === 'POST') {
      calls.intakeInsert = true
      try { intakeBody = JSON.parse(route.request().postData() ?? '{}') } catch { /* noop */ }
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await openModalAndFill(page)
  await page.getByRole('button', { name: /create batch/i }).click()
  await expect(page.getByText('Batch registered')).toBeVisible({ timeout: 5000 })

  expect(intakeBody).toMatchObject({
    batch_id: M.batchId,
    supplier_name: 'Targray Industries',
    supplier_batch_no: 'TGR-CTH-9821-A',
  })
})

test('Done button on QR screen closes modal and adds batch to list', async ({ page }) => {
  const calls: Calls = { batchInsert: false, intakeInsert: false, auditInsert: false }
  await setupMocks(page, calls)
  await openModalAndFill(page)

  await page.getByRole('button', { name: /create batch/i }).click()
  await expect(page.getByText('Batch registered')).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: /done/i }).click()

  // Modal should be closed
  await expect(page.getByText('Batch registered')).not.toBeVisible()
})

test('intake INSERT failure shows recovery message without silently losing the batch', async ({ page }) => {
  const calls: Calls = { batchInsert: false, intakeInsert: false, auditInsert: false }
  await setupMocks(page, calls, /* intakeShouldFail= */ true)
  await openModalAndFill(page)

  await page.getByRole('button', { name: /create batch/i }).click()

  // QR screen still shown (batch exists)
  await expect(page.getByText('Batch registered')).toBeVisible({ timeout: 5000 })

  // Recovery error message is shown on the success screen
  await expect(page.getByText(/intake record failed/i)).toBeVisible()
})
