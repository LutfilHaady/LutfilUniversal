/**
 * Create Sub-batch drawer — split integrity (Task 2)
 *
 * Asserts that submitting the drawer: reads the parent quantity, inserts the
 * child (returning select), PATCHes the parent current_quantity, writes a
 * batch_status_changes audit row, and inserts a process_runs row.
 * Stateless mocks; /rest/v1/users left real (Engineer role).
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  parentId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  parentNum: 'MTC1-20260521-A01',
  matId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  mixcId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  newSubId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
}

const PROCESSES = [
  { id: M.mixcId, code: 'MIXC', name: 'Mixing (Cathode)', sequence_hint: 1, requires_calibration: false },
]

async function setupMocks(page: Page, calls: { patchedParent: boolean; auditRow: boolean; processRun: boolean }) {
  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const method = route.request().method()
    const url = route.request().url()

    if (method === 'POST') {
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: M.newSubId, batch_number: `MIXC-x-A01` }),
      })
    }
    if (method === 'PATCH') {
      calls.patchedParent = true
      return route.fulfill({ status: 204, body: '' })
    }
    if (url.includes('batch_number=like')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    if (url.includes(`id=eq.${M.parentId}`) || url.includes('parent_batch_id=is.null')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: M.parentId, batch_number: M.parentNum, parent_batch_id: null,
          material_id: M.matId, status: 'InProgress', current_quantity: 100,
          original_quantity: 100, unit: 'kg', current_location: 'Shelf A1',
          created_at: '2026-05-21T08:00:00Z',
          material: { name: 'Cathode Electrode', code: 'MTC1' },
          intake: [{ supplier_name: 'Targray' }],
        }),
      })
    }
    if (url.includes('parent_batch_id=eq')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.route(`**${SB}/rest/v1/processes**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROCESSES) }))
  await page.route(`**${SB}/rest/v1/equipment**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/recipes**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/process_runs**`, async route => {
    if (route.request().method() === 'POST') { calls.processRun = true; return route.fulfill({ status: 201, body: '' }) }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route(`**${SB}/rest/v1/batch_status_changes**`, async route => {
    if (route.request().method() === 'POST') { calls.auditRow = true; return route.fulfill({ status: 201, body: '' }) }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

test('submitting a split deducts parent qty, writes audit row and process run', async ({ page }) => {
  const calls = { patchedParent: false, auditRow: false, processRun: false }
  await setupMocks(page, calls)
  await page.goto(`/batches/${M.parentId}`)

  await page.getByRole('button', { name: /create sub-batch/i }).first().click()
  const drawer = page.getByRole('dialog', { name: 'Create sub-batch' })
  await drawer.getByRole('button', { name: 'Select process step' }).click()
  await page.getByRole('button', { name: 'Mixing (Cathode)' }).click()
  await drawer.getByPlaceholder('0').fill('25')
  await drawer.getByRole('button', { name: /create sub-batch/i }).click()

  await expect.poll(() => calls.patchedParent).toBe(true)
  await expect.poll(() => calls.auditRow).toBe(true)
  await expect.poll(() => calls.processRun).toBe(true)
})

test('over-allocation is blocked by the server guard before any write', async ({ page }) => {
  const calls = { childInsert: false, patchedParent: false, auditRow: false, processRun: false }

  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const method = route.request().method()
    const url = route.request().url()

    if (method === 'POST') { calls.childInsert = true; return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: M.newSubId, batch_number: 'MIXC-x-A01' }) }) }
    if (method === 'PATCH') { calls.patchedParent = true; return route.fulfill({ status: 204, body: '' }) }
    if (url.includes('batch_number=like')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })

    // Drawer step-1 guard read: only current_quantity is selected → return a small value.
    if (url.includes('select=current_quantity')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current_quantity: 10 }) })
    }
    // Page parent load (full row) → large quantity so the Create button enables.
    if (url.includes(`id=eq.${M.parentId}`) || url.includes('parent_batch_id=is.null')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: M.parentId, batch_number: M.parentNum, parent_batch_id: null,
          material_id: M.matId, status: 'InProgress', current_quantity: 100,
          original_quantity: 100, unit: 'kg', current_location: 'Shelf A1',
          created_at: '2026-05-21T08:00:00Z',
          material: { name: 'Cathode Electrode', code: 'MTC1' },
          intake: [{ supplier_name: 'Targray' }],
        }),
      })
    }
    if (url.includes('parent_batch_id=eq')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.route(`**${SB}/rest/v1/processes**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROCESSES) }))
  await page.route(`**${SB}/rest/v1/equipment**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/recipes**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/process_runs**`, async route => {
    if (route.request().method() === 'POST') { calls.processRun = true; return route.fulfill({ status: 201, body: '' }) }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route(`**${SB}/rest/v1/batch_status_changes**`, async route => {
    if (route.request().method() === 'POST') { calls.auditRow = true; return route.fulfill({ status: 201, body: '' }) }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto(`/batches/${M.parentId}`)
  await page.getByRole('button', { name: /create sub-batch/i }).first().click()
  const drawer = page.getByRole('dialog', { name: 'Create sub-batch' })
  await drawer.getByRole('button', { name: 'Select process step' }).click()
  await page.getByRole('button', { name: 'Mixing (Cathode)' }).click()
  await drawer.getByPlaceholder('0').fill('25')
  await drawer.getByRole('button', { name: /create sub-batch/i }).click()

  // Server guard rejects: error shown, and NO writes happened.
  await expect(drawer.getByText(/Split exceeds available/i)).toBeVisible()
  await expect.poll(() => calls.childInsert).toBe(false)
  await expect.poll(() => calls.patchedParent).toBe(false)
})
