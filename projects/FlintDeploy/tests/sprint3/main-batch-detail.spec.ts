/**
 * Main batch detail page (/batches/[id]) + Create Sub-batch drawer
 *
 * Tests cover:
 *  - Page renders identity + the four info cards from live (mocked) data
 *  - Remaining qty = parent current_quantity − sum of sub-batch quantities
 *  - Sub-batch table lists children with status badges and links
 *  - Status history renders
 *  - "Change status" visible for Engineer role
 *  - "+ Create sub-batch" opens the drawer; selecting a process step updates
 *    the sub-batch ID preview with the correct process-code prefix
 *  - Empty equipment table → "No machines configured yet"
 *
 * All Supabase REST calls are mocked at the network layer (stateless, keyed on
 * the request URL — no call counters). /rest/v1/users is left real so the auth
 * context resolves the Engineer role.
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  parentId:  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  parentNum: 'MTC1-20260521-A01',
  matId:     'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  sub1:      'cccccccc-cccc-cccc-cccc-cccccccccccc',
  sub2:      'dddddddd-dddd-dddd-dddd-dddddddddddd',
  mixcId:    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
}

const PROCESSES = [
  { id: M.mixcId, code: 'MIXC', name: 'Mixing (Cathode)',     sequence_hint: 1, requires_calibration: false },
  { id: 'p2',     code: 'MIXE', name: 'Mixing (Electrolyte)', sequence_hint: 2, requires_calibration: false },
  { id: 'p3',     code: 'CTGC', name: 'Coating & Oven Drying', sequence_hint: 3, requires_calibration: true },
]

async function setupMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const method = route.request().method()
    const url = route.request().url()

    if (method === 'POST') {
      return route.fulfill({ status: 201, body: '' })
    }
    // Drawer's next-sequence lookup: GET batches?batch_number=like.MIXC-...
    if (url.includes('batch_number=like')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    // Parent batch lookup (.maybeSingle → object)
    if (url.includes('parent_batch_id=is.null')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: M.parentId,
          batch_number: M.parentNum,
          parent_batch_id: null,
          material_id: M.matId,
          status: 'InProgress',
          current_quantity: 40,
          original_quantity: 100,
          unit: 'kg',
          current_location: 'Shelf A1',
          created_at: '2026-05-21T08:00:00Z',
          material: { name: 'Cathode Electrode', code: 'MTC1' },
          intake: [{ supplier_name: 'Targray Industries' }],
        }),
      })
    }
    // Sub-batches list (parent_batch_id=eq → array)
    if (url.includes('parent_batch_id=eq')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: M.sub1, batch_number: 'MIXC-20260521-A01', status: 'InProgress',
            current_quantity: 40, original_quantity: 40, unit: 'kg', current_location: null,
          },
          {
            id: M.sub2, batch_number: 'MIXC-20260521-A02', status: 'Released',
            current_quantity: 20, original_quantity: 20, unit: 'kg', current_location: 'Shelf B2',
          },
        ]),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.route(`**${SB}/rest/v1/processes**`, async route => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROCESSES) })
  })

  await page.route(`**${SB}/rest/v1/batch_status_changes**`, async route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, body: '' })
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'ch1', from_status: 'InProgress', to_status: 'OnHold',
          changed_at: '2026-05-22T10:00:00Z', reason: 'QC pending review',
          changer: { full_name: 'Dev Engineer' },
        },
      ]),
    })
  })

  await page.route(`**${SB}/rest/v1/process_runs**`, async route => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  // Equipment table is empty in the live DB → drawer shows placeholder
  await page.route(`**${SB}/rest/v1/equipment**`, async route => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.route(`**${SB}/rest/v1/recipes**`, async route => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

test.describe('Main batch detail — /batches/[id]', () => {
  test('renders identity, info cards and sub-batch table from data', async ({ page }) => {
    await setupMocks(page)
    await page.goto(`/batches/${M.parentId}`)

    // Identity
    await expect(page.getByText(M.parentNum).first()).toBeVisible()

    // Info cards
    await expect(page.getByText('Total Qty')).toBeVisible()
    await expect(page.getByText('Supplier')).toBeVisible()
    await expect(page.getByText('Targray Industries')).toBeVisible()

    // Remaining = current_quantity from DB (already deducted by create_sub_batch RPC) = 40 kg
    await expect(page.getByText('Remaining')).toBeVisible()
    await expect(page.getByText('40 kg').first()).toBeVisible()

    // Sub-batch table — both children with links + a Released badge
    await expect(page.getByRole('link', { name: 'MIXC-20260521-A01' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'MIXC-20260521-A02' })).toBeVisible()
    await expect(page.getByText('Released')).toBeVisible()

    // Process step derived from the batch-number prefix
    await expect(page.getByText('Mixing (Cathode)').first()).toBeVisible()

    // Status history
    await expect(page.getByText('Status history')).toBeVisible()
    await expect(page.getByText('QC pending review')).toBeVisible()
  })

  test('sub-batch link points to /batches/[parentId]/[subId]', async ({ page }) => {
    await setupMocks(page)
    await page.goto(`/batches/${M.parentId}`)

    const link = page.getByRole('link', { name: 'MIXC-20260521-A01' })
    await expect(link).toHaveAttribute('href', `/batches/${M.parentId}/${M.sub1}`)
  })

  test('Change status button is visible for the Engineer role', async ({ page }) => {
    await setupMocks(page)
    await page.goto(`/batches/${M.parentId}`)
    await expect(page.getByRole('button', { name: 'Change status' })).toBeVisible()
  })

  test('Create sub-batch drawer opens and ID preview uses the process code prefix', async ({ page }) => {
    await setupMocks(page)
    await page.goto(`/batches/${M.parentId}`)

    await page.getByRole('button', { name: /create sub-batch/i }).click()

    const drawer = page.getByRole('dialog', { name: 'Create sub-batch' })
    await expect(drawer).toBeVisible()
    // Drawer context line + footer allocation summary (empty until a qty is entered)
    await expect(drawer.getByText('Parent', { exact: true })).toBeVisible()
    await expect(drawer.getByText('Select a quantity to allocate')).toBeVisible()

    // Pick a process step via the custom dropdown → live ID preview with MIXC prefix
    const d = new Date()
    const today = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    await drawer.getByRole('button', { name: 'Select process step' }).click()
    await page.getByRole('button', { name: 'Mixing (Cathode)' }).click()
    await expect(drawer.getByText(`MIXC-${today}-AXX-C1`)).toBeVisible()
    await expect(drawer.getByText('System generated · Auto-assigned on creation')).toBeVisible()

    // Empty equipment table → placeholder shown as the Machine dropdown label
    await expect(drawer.getByText('No machines configured yet')).toBeVisible()
  })

  test('Create button is disabled until process step and quantity are filled', async ({ page }) => {
    await setupMocks(page)
    await page.goto(`/batches/${M.parentId}`)
    await page.getByRole('button', { name: /create sub-batch/i }).click()

    const drawer = page.getByRole('dialog', { name: 'Create sub-batch' })
    const createBtn = drawer.getByRole('button', { name: /create sub-batch/i })
    await expect(createBtn).toBeDisabled()

    await drawer.getByRole('button', { name: 'Select process step' }).click()
    await page.getByRole('button', { name: 'Mixing (Cathode)' }).click()
    await drawer.getByPlaceholder('0').fill('25')
    await expect(createBtn).toBeEnabled()
  })
})
