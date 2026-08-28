/**
 * Sub-batch genealogy panel (components/subbatch/genealogy.tsx)
 *
 * Verifies the panel reads trace_batch_genealogy (p_batch_id) and renders
 * ancestor / self / descendant nodes, plus the empty state when the RPC
 * returns only the self row. Supabase REST/RPC mocked statelessly; /rest/v1/users
 * left real so the auth context resolves the Engineer role.
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  parentId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  parentNum: 'MTC1-20260521-A01',
  matId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  subId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  subNum: 'MIXC-20260521-A01',
  childId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  childNum: 'CTGC-20260521-A01',
}

function batchRow() {
  return {
    id: M.subId, batch_number: M.subNum, parent_batch_id: M.parentId,
    material_id: M.matId, status: 'InProgress', current_quantity: 40,
    original_quantity: 40, unit: 'kg', current_location: 'Shelf B2',
    created_at: '2026-05-21T09:00:00Z',
    material: { name: 'Cathode Electrode', code: 'MTC1' },
    parent_batch: { id: M.parentId, batch_number: M.parentNum },
  }
}

async function baseMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const url = route.request().url()
    if (url.includes(`id=eq.${M.subId}`) || url.includes(`id=eq.${M.parentId}`)) {
      const isParent = url.includes(`id=eq.${M.parentId}`)
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(isParent
          ? { ...batchRow(), id: M.parentId, batch_number: M.parentNum, parent_batch_id: null, parent_batch: null }
          : batchRow()),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route(`**${SB}/rest/v1/mixing_steps**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/materials**`, r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: M.matId, name: 'Cathode Electrode' }]),
  }))
}

test.describe('Genealogy panel', () => {
  test('renders ancestor, self and descendant nodes from the RPC', async ({ page }) => {
    await baseMocks(page)
    await page.route(`**${SB}/rest/v1/rpc/trace_batch_genealogy**`, route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: M.parentId, batch_number: M.parentNum, parent_batch_id: null, material_id: M.matId, status: 'Released', current_quantity: 100, unit: 'kg', depth: -1, direction: 'ancestor' },
        { id: M.subId, batch_number: M.subNum, parent_batch_id: M.parentId, material_id: M.matId, status: 'InProgress', current_quantity: 40, unit: 'kg', depth: 0, direction: 'self' },
        { id: M.childId, batch_number: M.childNum, parent_batch_id: M.subId, material_id: M.matId, status: 'InProgress', current_quantity: 10, unit: 'kg', depth: 1, direction: 'descendant' },
      ]),
    }))

    await page.goto(`/batches/${M.parentId}/${M.subId}`)

    const main = page.getByRole('main')
    await expect(page.getByText('Material Genealogy')).toBeVisible()
    await expect(main.getByText(M.parentNum)).toBeVisible()
    await expect(main.getByText(M.childNum)).toBeVisible()
    await expect(main.getByText('current', { exact: true })).toBeVisible()
    await expect(main.getByText('Current Sub-batch')).toBeVisible()
    await expect(main.getByText('MIXC-20260521-A01').first()).toBeVisible()
  })

  test('shows the empty state when the RPC returns only the self row', async ({ page }) => {
    await baseMocks(page)
    await page.route(`**${SB}/rest/v1/rpc/trace_batch_genealogy**`, route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: M.subId, batch_number: M.subNum, parent_batch_id: M.parentId, material_id: M.matId, status: 'InProgress', current_quantity: 40, unit: 'kg', depth: 0, direction: 'self' },
      ]),
    }))

    await page.goto(`/batches/${M.parentId}/${M.subId}`)
    await expect(page.getByText('No parent or child batches recorded yet.')).toBeVisible()
  })
})
