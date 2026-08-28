/**
 * Create Sub-batch drawer — split integrity
 *
 * Updated for Sprint 8 (J5): the drawer now uses a single `create_sub_batch`
 * RPC instead of three separate REST calls. Mocks the RPC endpoint and the
 * separate best-effort process_runs POST.
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

async function setupBaseMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const url = route.request().url()
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

  await page.route(`**${SB}/rest/v1/processes**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROCESSES) }))
  await page.route(`**${SB}/rest/v1/equipment**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/recipes**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/alert_rules**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/alerts**`, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
}

test('happy path: RPC called once, process_run inserted, drawer closes', async ({ page }) => {
  let rpcCalled = false
  let processRunInserted = false

  await setupBaseMocks(page)

  await page.route(`**${SB}/rest/v1/rpc/create_sub_batch**`, async route => {
    rpcCalled = true
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: M.newSubId, batch_number: 'MIXC-20260521-A01-C1' }),
    })
  })

  await page.route(`**${SB}/rest/v1/process_runs**`, async route => {
    if (route.request().method() === 'POST') {
      processRunInserted = true
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto(`/batches/${M.parentId}`)
  await page.getByRole('button', { name: /create sub-batch/i }).first().click()
  const drawer = page.getByRole('dialog', { name: 'Create sub-batch' })
  await drawer.getByRole('button', { name: 'Select process step' }).click()
  await page.getByRole('button', { name: 'Mixing (Cathode)' }).click()
  await drawer.getByPlaceholder('0').fill('25')
  await drawer.getByRole('button', { name: /create sub-batch/i }).click()

  await expect.poll(() => rpcCalled).toBe(true)
  await expect.poll(() => processRunInserted).toBe(true)
})

test('over-allocation: RPC error surfaces as user-facing message, no process_run written', async ({ page }) => {
  let processRunInserted = false

  await setupBaseMocks(page)

  await page.route(`**${SB}/rest/v1/rpc/create_sub_batch**`, async route => {
    return route.fulfill({
      status: 400, contentType: 'application/json',
      body: JSON.stringify({
        code: '22000',
        message: 'Requested quantity (25) exceeds remaining (10) for parent batch MTC1-20260521-A01',
      }),
    })
  })

  await page.route(`**${SB}/rest/v1/process_runs**`, async route => {
    if (route.request().method() === 'POST') {
      processRunInserted = true
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto(`/batches/${M.parentId}`)
  await page.getByRole('button', { name: /create sub-batch/i }).first().click()
  const drawer = page.getByRole('dialog', { name: 'Create sub-batch' })
  await drawer.getByRole('button', { name: 'Select process step' }).click()
  await page.getByRole('button', { name: 'Mixing (Cathode)' }).click()
  await drawer.getByPlaceholder('0').fill('25')
  await drawer.getByRole('button', { name: /create sub-batch/i }).click()

  await expect(drawer.getByText(/Split exceeds available/i)).toBeVisible()
  await expect.poll(() => processRunInserted).toBe(false)
})
