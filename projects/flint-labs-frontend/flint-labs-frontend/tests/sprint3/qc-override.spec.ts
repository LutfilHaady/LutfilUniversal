/**
 * Sprint 3 — QC Override page (/qc-override)
 *
 * Tests cover:
 *  - Empty state when no unoverridden failures exist
 *  - Failure cards displayed from DB
 *  - Confirm Override button disabled without a reason
 *  - Full override write chain (qc_overrides, process_runs, batches, batch_status_changes)
 *  - Already-overridden results filtered from the queue
 *
 * Supabase REST calls are mocked at the network layer.
 * Page is restricted to Engineer / Admin — tests run with the engineer auth session.
 *
 * Note: AuthProvider calls both getSession() and onAuthStateChange() on page load,
 * which can trigger fetchResults() twice. Mocks are therefore stateless (no call counter)
 * to avoid the second call clearing previously loaded data.
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:    '11111111-1111-1111-1111-111111111111',
  batchNum:   'MIXC-20260601-A01-01',
  runId:      '22222222-2222-2222-2222-222222222222',
  qcResultId: '88888888-8888-8888-8888-888888888888',
}

const failedResultFixture = {
  id: M.qcResultId,
  process_run_id: M.runId,
  qc_check_definitions: { qc_item_name: 'Viscosity' },
  qc_overrides: [],
  process_runs: {
    id: M.runId,
    processes: { name: 'Mixing' },
    process_run_inputs: [{
      input_batch_id: M.batchId,
      batches: { batch_number: M.batchNum },
    }],
  },
}

async function setupOverrideMocks(page: Page, { withResults }: { withResults: boolean }) {
  // qc_check_results — stateless: always return the same body.
  // Using a counter here breaks because AuthProvider triggers fetchResults twice on load.
  await page.route(`**${SB}/rest/v1/qc_check_results**`, async route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: withResults ? JSON.stringify([failedResultFixture]) : '[]',
    })
  })

  // qc_overrides — POST (insert override record)
  await page.route(`**${SB}/rest/v1/qc_overrides**`, async route => {
    return route.fulfill({ status: 201, body: '' })
  })

  // process_runs — PATCH (set status = Overridden) + GET (fetch input_batch_id for step 4)
  await page.route(`**${SB}/rest/v1/process_runs**`, async route => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: M.runId,
        output_batch_id: null,
        process_run_inputs: [{ input_batch_id: M.batchId }],
      }),
    })
  })

  // batches — PATCH (set input batch back to Released)
  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    return route.fulfill({ status: 204, body: '' })
  })

  // batch_status_changes — POST (audit row)
  await page.route(`**${SB}/rest/v1/batch_status_changes**`, async route => {
    return route.fulfill({ status: 201, body: '' })
  })
}

test.describe('QC Override — /qc-override', () => {
  test('renders heading and shows empty state when no failures pending', async ({ page }) => {
    await setupOverrideMocks(page, { withResults: false })
    await page.goto('/qc-override')

    await expect(page.getByText('QC Override')).toBeVisible()
    await expect(page.getByText(/pending failures/i)).toBeVisible()
    await expect(page.getByText(/no failed qc results pending override/i)).toBeVisible()
  })

  test('displays pending failure cards when unoverridden results exist', async ({ page }) => {
    await setupOverrideMocks(page, { withResults: true })
    await page.goto('/qc-override')

    // Result card should show QC item name, process name, and batch number
    await expect(page.getByText('Viscosity')).toBeVisible()
    await expect(page.getByText('Mixing')).toBeVisible()
    await expect(page.getByText(M.batchNum)).toBeVisible()
  })

  test('Confirm Override is disabled without a reason, enabled after typing', async ({ page }) => {
    await setupOverrideMocks(page, { withResults: true })
    await page.goto('/qc-override')

    // Select the failure card to reveal the override form
    await page.getByRole('button', { name: /viscosity/i }).click()
    await expect(page.getByPlaceholder(/explain why/i)).toBeVisible()

    // Button must be disabled while reason is empty
    await expect(page.getByRole('button', { name: /confirm override/i })).toBeDisabled()

    // Typing a reason enables the button
    await page.getByPlaceholder(/explain why/i).fill('Re-tested — within spec')
    await expect(page.getByRole('button', { name: /confirm override/i })).toBeEnabled()
  })

  test('full override flow — success banner shown, form cleared after submit', async ({ page }) => {
    await setupOverrideMocks(page, { withResults: true })
    await page.goto('/qc-override')

    // Select failure
    await page.getByRole('button', { name: /viscosity/i }).click()

    // Enter reason and submit
    await page.getByPlaceholder(/explain why/i).fill(
      'Sample re-tested with calibrated tool — actual reading within ± 2% spec'
    )
    await page.getByRole('button', { name: /confirm override/i }).click()

    // Success banner
    await expect(page.getByText(/override recorded/i)).toBeVisible()
    await expect(page.getByText(/run marked overridden/i)).toBeVisible()

    // Form should be gone (selectedId cleared on success)
    await expect(page.getByPlaceholder(/explain why/i)).not.toBeVisible()
  })

  test('already-overridden results are filtered from the pending queue', async ({ page }) => {
    // Return a result that already has an override — client should filter it out
    const alreadyOverridden = {
      ...failedResultFixture,
      qc_overrides: [{ id: 'existing-override-uuid' }],
    }

    await page.route(`**${SB}/rest/v1/qc_check_results**`, async route => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([alreadyOverridden]),
      })
    })

    await page.goto('/qc-override')

    // The only result is already overridden — queue should appear empty
    await expect(page.getByText(/no failed qc results pending override/i)).toBeVisible()
    await expect(page.getByText('Viscosity')).not.toBeVisible()
  })
})
