/**
 * Sub-batch detail breadcrumb (/batches/[id]/[subId])
 *
 * Verifies the breadcrumb fix: the middle (parent) segment now links to the
 * parent batch detail page /batches/[id] — instead of dead-ending back at
 * /batches — and renders the parent's batch_number (resolved via the
 * parent_batch join, with a useBatch(params.id) fallback).
 *
 * Tests cover:
 *  - "Batches" root link → /batches
 *  - Parent segment → /batches/[parentId], showing the parent batch_number
 *  - Current sub-batch segment shows the sub-batch_number (not a link)
 *  - Fallback path: when the sub-batch row carries no parent_batch join,
 *    the parent number is still resolved from the standalone parent fetch
 *
 * All Supabase REST/RPC calls are mocked at the network layer (stateless,
 * keyed on the request URL — no call counters). /rest/v1/users is left real so
 * the auth context resolves the Engineer role.
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  parentId:  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  parentNum: 'MTC1-20260521-A01',
  matId:     'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  subId:     'cccccccc-cccc-cccc-cccc-cccccccccccc',
  subNum:    'MIXC-20260521-A01',
}

/**
 * @param withParentJoin when false the sub-batch row omits the parent_batch
 *   join, exercising the useBatch(params.id) fallback path of the fix.
 */
async function setupMocks(page: Page, { withParentJoin = true } = {}) {
  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const url = route.request().url()

    // Parent batch lookup — useBatch(params.id) (.single → object)
    if (url.includes(`id=eq.${M.parentId}`)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: M.parentId,
          batch_number: M.parentNum,
          parent_batch_id: null,
          material_id: M.matId,
          status: 'InProgress',
          current_quantity: 100,
          original_quantity: 100,
          unit: 'kg',
          current_location: 'Shelf A1',
          created_at: '2026-05-21T08:00:00Z',
          material: { name: 'Cathode Electrode', code: 'MTC1' },
          parent_batch: null,
        }),
      })
    }

    // Sub-batch lookup — useBatch(params.subId) (.single → object)
    if (url.includes(`id=eq.${M.subId}`)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: M.subId,
          batch_number: M.subNum,
          parent_batch_id: M.parentId,
          material_id: M.matId,
          status: 'InProgress',
          current_quantity: 40,
          original_quantity: 40,
          unit: 'kg',
          current_location: 'Shelf B2',
          created_at: '2026-05-21T09:00:00Z',
          material: { name: 'Cathode Electrode', code: 'MTC1' },
          parent_batch: withParentJoin ? { id: M.parentId, batch_number: M.parentNum } : null,
        }),
      })
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  // Mixing steps panel fetch (MIXC sub-batch)
  await page.route(`**${SB}/rest/v1/mixing_steps**`, async route => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  // Dynamic process route RPC
  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, async route => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  // Catch-all for any other sub-batch panel queries
  await page.route(`**${SB}/rest/v1/process_runs**`, async route => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

test.describe('Sub-batch detail breadcrumb — /batches/[id]/[subId]', () => {
  test('parent segment links to the parent batch detail page', async ({ page }) => {
    await setupMocks(page)
    await page.goto(`/batches/${M.parentId}/${M.subId}`)

    // Scope to the header so the sidebar nav's own "Batches" link is excluded
    const crumb = page.getByRole('banner')

    // Root "Batches" link
    await expect(crumb.getByRole('link', { name: 'Batches' })).toHaveAttribute('href', '/batches')

    // Parent segment → /batches/[parentId], showing the parent batch_number
    const parentLink = crumb.getByRole('link', { name: M.parentNum })
    await expect(parentLink).toBeVisible()
    await expect(parentLink).toHaveAttribute('href', `/batches/${M.parentId}`)

    // Current sub-batch segment renders its number (and is not a link)
    await expect(crumb.getByText(M.subNum)).toBeVisible()
    await expect(crumb.getByRole('link', { name: M.subNum })).toHaveCount(0)
  })

  test('parent number resolves via fallback when the parent_batch join is absent', async ({ page }) => {
    await setupMocks(page, { withParentJoin: false })
    await page.goto(`/batches/${M.parentId}/${M.subId}`)

    // Even without the join, the standalone parent fetch supplies the number,
    // and the link still targets the parent detail page.
    const parentLink = page.getByRole('banner').getByRole('link', { name: M.parentNum })
    await expect(parentLink).toBeVisible()
    await expect(parentLink).toHaveAttribute('href', `/batches/${M.parentId}`)
  })
})
