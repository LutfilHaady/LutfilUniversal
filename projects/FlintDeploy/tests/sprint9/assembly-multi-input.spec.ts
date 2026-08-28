/**
 * Sprint 9 — Assembly (UTPC) logs one process_run_inputs row per input batch.
 * Migrated to the Phase 2 single-page model (Sprint 11): the multi-batch input
 * lives inline in section 4 and "Start run" writes all inputs at once.
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

async function blockCamera(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () => Promise.reject(new DOMException('NotAllowed', 'NotAllowedError')),
        enumerateDevices: () => Promise.resolve([]),
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
      },
      configurable: true,
    })
  })
}

async function setupMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**${SB}/rest/v1/users**`, route => route.continue())
  await page.route(`**${SB}/rest/v1/batches**`, route => {
    if (route.request().method() === 'GET') {
      const url = route.request().url()
      if (url.includes('TEST-01'))
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'b-1', batch_number: 'TEST-01', material_id: 'm-1' }) })
      if (url.includes('TEST-02'))
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'b-2', batch_number: 'TEST-02', material_id: 'm-2' }) })
      return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found' }) })
    }
    return route.continue()
  })
  await page.route(`**${SB}/rest/v1/rpc/get_process_route*`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        process_id: 'p-1',
        name: 'Assembly',
        code: 'UTPC',
        sequence_hint: 6,
        requires_calibration: false,
      }]),
    }),
  )
  await page.route(`**${SB}/rest/v1/equipment*`, route => route.fulfill({ status: 200, body: '[]' }))
  await page.route(`**${SB}/rest/v1/recipes*`, route => route.fulfill({ status: 200, body: '[]' }))
}

test('Assembly logs one process_run_inputs row per input batch', async ({ page }) => {
  await blockCamera(page)
  await setupMocks(page)
  await page.goto('/log')

  await page.getByPlaceholder(/e\.g\./i).first().fill('TEST-01')
  await page.getByRole('button', { name: /find batch/i }).click()
  const stepSelect = page.getByTestId('process-step-select')
  await expect(stepSelect).toBeVisible({ timeout: 5000 })
  const stepOptLocator = stepSelect.locator('option').filter({ hasText: /Assembly/ })
  const stepOptVal = await stepOptLocator.first().getAttribute('value')
  await stepSelect.selectOption(stepOptVal ?? '')

  await expect(page.getByText(/Cell Assembled/i)).toBeVisible()
  await page.getByTestId('param-cell_assembled').fill('500')

  await page.getByPlaceholder('Scan/Enter Batch Number').fill('TEST-02')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('TEST-02').first()).toBeVisible()

  let inputInserts: Array<{ input_batch_id: string }> = []
  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    if (route.request().method() === 'POST')
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'run-1' }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route(`**${SB}/rest/v1/process_run_inputs**`, route => {
    if (route.request().method() === 'POST') inputInserts = JSON.parse(route.request().postData() || '[]')
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })

  await page.getByRole('button', { name: /start run/i }).click()

  await expect.poll(() => inputInserts.length, { timeout: 8000 }).toBe(2)
  expect(inputInserts[0].input_batch_id).toBe('b-1')
  expect(inputInserts[1].input_batch_id).toBe('b-2')
})
