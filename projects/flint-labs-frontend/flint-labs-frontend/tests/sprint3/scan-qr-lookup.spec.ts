/**
 * Task 1 — Scan QR Lookup
 *
 * Covers the /scan page batch lookup flow:
 *   - Successful sub-batch scan navigates to the correct detail route
 *   - Unknown batch number shows the "Batch Not Found" error state
 *
 * Auth: Engineer session (tests/.auth/engineer.json)
 * All Supabase REST calls are intercepted with stateless page.route() mocks.
 */

import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const MOCK = {
  parentId: '10000000-1000-1000-1000-100000000000',
  subId:    '20000000-2000-2000-2000-200000000000',
  batchNum: 'ANOD-20260601-A01-01',
}

test.describe('Task 1 — Scan QR Lookup', () => {

  test('successful sub-batch lookup navigates to batch detail page', async ({ page }) => {
    await page.route(`**${SB}/rest/v1/batches*`, async (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('batch_number') === `eq.${MOCK.batchNum}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id:              MOCK.subId,
            batch_number:    MOCK.batchNum,
            parent_batch_id: MOCK.parentId,
          }),
        })
      }
      return route.continue()
    })

    await page.goto('/scan')
    await page.getByPlaceholder(/MIXC-20260430-A01-03/i).fill(MOCK.batchNum)
    await page.getByRole('button', { name: 'Go' }).click()

    await page.waitForURL(`**/batches/${MOCK.parentId}/${MOCK.subId}`)
    await expect(page).toHaveURL(new RegExp(`/batches/${MOCK.parentId}/${MOCK.subId}`))
  })

  test('unknown batch number shows Batch Not Found error', async ({ page }) => {
    await page.route(`**${SB}/rest/v1/batches*`, async (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('batch_number') === 'eq.NONEXISTENT-BATCH') {
        return route.fulfill({
          status: 406,
          contentType: 'application/json',
          body: JSON.stringify({
            code:    'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
          }),
        })
      }
      return route.continue()
    })

    await page.goto('/scan')
    await page.getByPlaceholder(/MIXC-20260430-A01-03/i).fill('NONEXISTENT-BATCH')
    await page.getByRole('button', { name: 'Go' }).click()

    await expect(page.getByText('Batch Not Found')).toBeVisible()
    await expect(page.getByText(/NONEXISTENT-BATCH/)).toBeVisible()
  })

})
