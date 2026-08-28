/**
 * Sprint 10 — Process Log Redesign, Phase 1: timer/resume infrastructure
 *
 * Covers the additive pieces that let an operator leave the log page and resume
 * an in-progress run:
 *  - active-run drawer renders on /log when the operator has an InProgress run
 *  - "Complete run" PATCHes end_date/end_time/status=AwaitingQC
 *  - the compact active-run chip renders on /dashboard and links to /log
 *
 * All Supabase REST calls mocked; /rest/v1/users left real so auth resolves the
 * engineer role (stateless mocks, no call counters).
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const RUN = {
  id: 'run-aaaa-1111',
  process_id: 'proc-1111',
  start_date: '2026-06-28',
  start_time: '09:00',
  status: 'InProgress',
  process: { name: 'Calendaring', code: 'CALC' },
  process_run_inputs: [
    { input_batch: { id: 'batch-1111', batch_number: 'CALC-20260628-A01-01' } },
  ],
}

async function setupMocks(page: Page, opts: { activeRuns?: unknown[] } = {}) {
  const runs = opts.activeRuns ?? [RUN]

  // Default: everything empty.
  await page.route(`**${SB}/rest/v1/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  // Keep auth real so the engineer role resolves.
  await page.route(`**${SB}/rest/v1/users**`, route => route.continue())

  // The operator's active runs (and PATCH on completion).
  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    const method = route.request().method()
    if (method === 'PATCH') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(runs),
    })
  })
}

test('active-run drawer renders on /log with the operator open run', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/log')

  const drawer = page.getByTestId('active-run-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('CALC-20260628-A01-01')).toBeVisible()
})

test('Complete run PATCHes end_date/end_time/status=AwaitingQC', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/log')

  const drawer = page.getByTestId('active-run-drawer')
  await expect(drawer).toBeVisible()

  // Expand and capture the PATCH that "Complete run" fires.
  await drawer.getByRole('button').first().click()

  const [patch] = await Promise.all([
    page.waitForRequest(r => r.url().includes('/rest/v1/process_runs') && r.method() === 'PATCH'),
    drawer.getByRole('button', { name: /complete run/i }).click(),
  ])

  const body = JSON.parse(patch.postData() ?? '{}')
  expect(body.status).toBe('AwaitingQC')
  expect(body.end_date).toBeTruthy()
  expect(body.end_time).toBeTruthy()
})

test('drawer is absent when the operator has no active runs', async ({ page }) => {
  await setupMocks(page, { activeRuns: [] })
  await page.goto('/log')

  // Give the page time to settle, then confirm the drawer never appears.
  await page.waitForTimeout(1000)
  await expect(page.getByTestId('active-run-drawer')).toHaveCount(0)
})

test('dashboard active-run chip renders and links to /log', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/dashboard')

  const chip = page.getByTestId('active-run-chip')
  await expect(chip).toBeVisible()
  await expect(chip).toContainText('1 active run')
  await expect(chip.getByText('CALC-20260628-A01-01')).toBeVisible()
  await expect(chip).toHaveAttribute('href', '/log')
})
