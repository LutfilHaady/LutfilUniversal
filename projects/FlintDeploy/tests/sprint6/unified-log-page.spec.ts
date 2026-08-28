import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

test('/log renders inside the shell with scan step', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.goto('/log')
  await expect(page.getByRole('link', { name: 'Process Log' })).toBeVisible()
  await expect(page.getByPlaceholder(/e\.g\. CTGC-20260601-A01/i).first()).toBeVisible()
  await expect(page.getByText('Scan Batch')).toBeVisible()
})

test('/log single-page model starts a process run as InProgress', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/users**`, route => route.continue())

  await page.route(`**${SB}/rest/v1/batches**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'batch-1', material_id: 'mat-1', batch_number: 'CTGC-20260601-A01' }),
  }))

  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      { process_id: 'p-ctgc', code: 'DRYC', name: 'Drying', sequence_hint: 1, requires_calibration: false },
    ]),
  }))

  await page.route(`**${SB}/rest/v1/equipment**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/recipes**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  let runBody: Record<string, unknown> | null = null
  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    if (route.request().method() === 'POST') {
      runBody = JSON.parse(route.request().postData() || '{}')
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'run-1' }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route(`**${SB}/rest/v1/process_run_inputs**`, route => route.fulfill({ status: 201, body: '' }))
  await page.route(`**${SB}/rest/v1/process_run_parameters**`, route => route.fulfill({ status: 201, body: '' }))

  await page.goto('/log')

  // Section 1: enter batch → Find batch (no Continue — single-page model)
  await page.getByPlaceholder(/e\.g\. CTGC-20260601-A01/i).first().fill('CTGC-20260601-A01')
  await page.getByRole('button', { name: /find batch/i }).click()

  // Section 2: process step dropdown appears inline — select from dropdown
  const stepSelect = page.getByTestId('process-step-select')
  await expect(stepSelect).toBeVisible({ timeout: 5000 })
  const stepOptLocator = stepSelect.locator('option').filter({ hasText: /Drying/ })
  const stepOptVal = await stepOptLocator.first().getAttribute('value')
  await stepSelect.selectOption(stepOptVal ?? '')

  // Section 5 sticky bar: Start run (INSERT status=InProgress; no AwaitingQC patch)
  await expect(page.getByRole('button', { name: /start run/i })).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /start run/i }).click()

  await expect.poll(() => runBody?.process_id).toBe('p-ctgc')
  await expect.poll(() => runBody?.status).toBe('InProgress')
  await expect(page.getByText(/run started/i)).toBeVisible({ timeout: 8000 })
})
