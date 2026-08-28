/**
 * Task 3 — Batch History Toggle
 *
 * Covers the 7-day / 30-day history toggle on the /batches page:
 *   - Default view shows "Showing last 7 days" and only recent batches
 *   - Clicking the toggle expands to "Showing last 30 days" and reveals older batches
 *   - Operator role has no toggle button (requires a dedicated Operator test account —
 *     see the skipped test below)
 *
 * Auth: Engineer session (tests/.auth/engineer.json)
 * All Supabase REST calls are intercepted with stateless page.route() mocks.
 *
 * Fix note: the original sprint3-tasks.spec.ts used a callCount variable to alternate
 * between 7-day and 30-day responses. This violates the project rule against stateful
 * mocks (AuthProvider fires duplicate effects on load). The mock below is stateless and
 * returns the same rows for every call: useBatches applies the 7/30-day window
 * client-side (no created_at filter is sent to Supabase), so the toggle reveals the
 * older batch purely via that client-side filter, not via a different server response.
 */

import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const RECENT_BATCH = {
  id:           '10000000-1000-1000-1000-100000000000',
  batch_number: 'ANOD-20260601-A01',
  parent_batch_id: null,
  created_at:   new Date().toISOString(),
  material:     { name: 'Anode Electrode', code: 'ANODE' },
  sub_batches:  [],
}

const OLD_BATCH = {
  id:           '30000000-3000-3000-3000-300000000000',
  batch_number: 'MIXC-20260515-A01',
  parent_batch_id: null,
  // 15 days ago — within 30-day window but outside 7-day window
  created_at:   new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
  material:     { name: 'Cathode Electrode', code: 'MTC1' },
  sub_batches:  [],
}

test.describe('Task 3 — Batch History Toggle', () => {

  test('toggle expands history from 7 days to 30 days', async ({ page }) => {
    // Stateless mock: always return BOTH batches. useBatches does the 7/30-day
    // windowing client-side — it sends no created_at filter to Supabase and
    // instead filters the fetched rows in JS by parent created_at / sub-batch
    // activity against the cutoff. So the server response is the same for both
    // windows; the toggle reveals OLD_BATCH purely via the client-side filter
    // (RECENT is "just now", OLD is 15 days ago → outside 7-day, inside 30-day).
    await page.route(`**${SB}/rest/v1/batches*`, async (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('parent_batch_id') !== 'is.null') {
        return route.continue()
      }

      return route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify([RECENT_BATCH, OLD_BATCH]),
      })
    })

    await page.goto('/batches')

    // Default state — 7-day window
    await expect(page.getByText('Showing last 7 days')).toBeVisible()
    await expect(page.getByText(RECENT_BATCH.batch_number)).toBeVisible()
    await expect(page.getByText(OLD_BATCH.batch_number)).not.toBeVisible()

    // Expand to 30-day window
    await page.getByRole('button', { name: 'Show all batches' }).click()

    await expect(page.getByText('Showing last 30 days')).toBeVisible()
    await expect(page.getByText(RECENT_BATCH.batch_number)).toBeVisible()
    await expect(page.getByText(OLD_BATCH.batch_number)).toBeVisible()
  })

  // Skipped: requires an Operator test account to be added to global.setup.ts
  // and a corresponding tests/.auth/operator.json storage state.
  // When set up, this test verifies that the history toggle button is not rendered
  // for the Operator role (Operators are always locked to the 7-day window).
  //
  // To enable:
  //   1. Create an Operator account in Supabase (see FLINT_REFERENCE §13, task 3E)
  //   2. Add an operatorSetup project to playwright.config.ts with its own storageState
  //   3. Remove the test.skip() call below
  test.skip('Operator role has no history toggle button', async ({ page }) => {
    await page.goto('/batches')
    await expect(page.getByRole('button', { name: 'Show all batches' })).not.toBeVisible()
    await expect(page.getByText('Showing last 7 days')).toBeVisible()
  })

})
