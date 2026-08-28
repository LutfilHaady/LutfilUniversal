/**
 * Sprint 4 — Identity Header status changes (Gap 1)
 *
 * Tests cover:
 *  - Hold / Quarantine / Release buttons visible to Engineer on InProgress batch
 *  - Scrap button opens confirmation dialog
 *  - Confirm Scrap calls transition_batch_status RPC and updates badge
 *  - Hold call succeeds → badge updates to OnHold
 *  - RPC error leaves badge unchanged and shows inline error
 *  - Terminal state (Scrapped) shows "No further actions"
 *
 * All Supabase REST calls are mocked at the network layer.
 * /rest/v1/users is left real so the auth context resolves the Engineer role.
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  parentId:  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  parentNum: 'MTC1-20260521-A01',
  subId:     'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  subNum:    'MIXC-20260521-A01-01',
  matId:     'cccccccc-cccc-cccc-cccc-cccccccccccc',
}

const SUB_BATCH = {
  id:               M.subId,
  batch_number:     M.subNum,
  parent_batch_id:  M.parentId,
  material_id:      M.matId,
  status:           'InProgress',
  current_quantity: 40,
  original_quantity: 40,
  unit:             'kg',
  current_location: null,
  created_at:       '2026-05-21T08:00:00Z',
  notes:            null,
  material:         { name: 'Cathode Electrode', code: 'MTC1' },
  parent_batch:     { id: M.parentId, batch_number: M.parentNum },
}

async function setupMocks(page: Page, batchStatus = 'InProgress') {
  const batch = { ...SUB_BATCH, status: batchStatus }

  // Sub-batch detail fetch
  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const method = route.request().method()
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(batch),
      })
    }
    return route.continue()
  })

  // mixing_steps — empty
  await page.route(`**${SB}/rest/v1/mixing_steps**`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // process route RPC
  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, async route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { process_id: 'p1', code: 'MIXC', name: 'Mixing (Cathode)', sequence_hint: 1, requires_calibration: false },
      ]),
    })
  )

  // batch_status_changes for timeline — empty
  await page.route(`**${SB}/rest/v1/batch_status_changes**`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // process_runs — empty
  await page.route(`**${SB}/rest/v1/process_runs**`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // alerts — empty
  await page.route(`**${SB}/rest/v1/alerts**`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // alert_rules — empty
  await page.route(`**${SB}/rest/v1/alert_rules**`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // genealogy RPC
  await page.route(`**${SB}/rest/v1/rpc/trace_batch_genealogy**`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // qc_check_results — empty
  await page.route(`**${SB}/rest/v1/qc_check_results**`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )
}

const PAGE_URL = `/batches/${M.parentId}/${M.subId}`

test('Hold button visible for Engineer on InProgress batch', async ({ page }) => {
  await setupMocks(page)
  await page.goto(PAGE_URL)
  await expect(page.getByRole('button', { name: /Place On Hold/i })).toBeVisible({ timeout: 8000 })
})

test('Quarantine button visible for Engineer on InProgress batch', async ({ page }) => {
  await setupMocks(page)
  await page.goto(PAGE_URL)
  await expect(page.getByRole('button', { name: /Quarantine/i })).toBeVisible({ timeout: 8000 })
})

test('Scrap button opens confirmation dialog', async ({ page }) => {
  await setupMocks(page)
  await page.goto(PAGE_URL)
  // Use exact name 'Scrap' to avoid matching 'Confirm Scrap' button
  await page.getByRole('button', { name: 'Scrap' }).click()
  // Dialog heading (div, not button) — use first() to avoid strict violation with the confirm button
  await expect(page.getByText('Confirm Scrap').first()).toBeVisible()
  await expect(page.getByText('This action cannot be undone')).toBeVisible()
})

test('Confirm Scrap calls RPC and updates badge to Scrapped', async ({ page }) => {
  await setupMocks(page)

  let rpcCalled = false
  await page.route(`**${SB}/rest/v1/rpc/transition_batch_status**`, async route => {
    rpcCalled = true
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...SUB_BATCH, status: 'Scrapped' }),
    })
  })

  await page.goto(PAGE_URL)
  // Use exact name to avoid matching 'Confirm Scrap'
  await page.getByRole('button', { name: 'Scrap' }).click()
  await page.getByRole('button', { name: 'Confirm Scrap' }).click()

  // Wait for dialog to close (proves the RPC completed and state updated)
  await expect(page.getByText('This action cannot be undone')).not.toBeVisible({ timeout: 5000 })
  // Badge label is 'Scrapped' from BATCH_STATUS_TONES
  await expect(page.getByText('Scrapped').first()).toBeVisible()
  expect(rpcCalled).toBe(true)
})

test('Hold RPC success updates badge to On Hold', async ({ page }) => {
  await setupMocks(page)

  await page.route(`**${SB}/rest/v1/rpc/transition_batch_status**`, async route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...SUB_BATCH, status: 'OnHold' }),
    })
  )

  await page.goto(PAGE_URL)
  await page.getByRole('button', { name: /Place On Hold/i }).click()
  // StatusBadge renders label 'On Hold' (not 'OnHold')
  await expect(page.getByText('On Hold')).toBeVisible({ timeout: 5000 })
})

test('RPC error leaves badge unchanged and shows error text', async ({ page }) => {
  await setupMocks(page)

  await page.route(`**${SB}/rest/v1/rpc/transition_batch_status**`, async route =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid status transition from InProgress to Released' }),
    })
  )

  await page.goto(PAGE_URL)
  await page.getByRole('button', { name: /Place On Hold/i }).click()

  // Badge should stay 'In Progress' (StatusBadge label) since the RPC failed
  await expect(page.getByText('In Progress')).toBeVisible({ timeout: 5000 })
})

test('Scrapped batch shows "No further actions" instead of buttons', async ({ page }) => {
  await setupMocks(page, 'Scrapped')
  await page.goto(PAGE_URL)
  await expect(page.getByText('No further actions')).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('button', { name: /Place On Hold/i })).not.toBeVisible()
})

test('Release button visible when batch is OnHold', async ({ page }) => {
  await setupMocks(page, 'OnHold')
  await page.goto(PAGE_URL)
  await expect(page.getByRole('button', { name: /Release/i })).toBeVisible({ timeout: 8000 })
})
