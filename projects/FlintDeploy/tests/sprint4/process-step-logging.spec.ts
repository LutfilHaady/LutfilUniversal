/**
 * Sprint 4 — Process Step Logging (/log/process-step)
 *
 * Migrated to the Phase 2 single-page model (Sprint 11): the wizard is gone.
 * The page reveals numbered sections inline; a single active equipment/recipe
 * auto-selects; "Start run" opens the process_runs row as InProgress (it no
 * longer immediately PATCHes to AwaitingQC — completion happens in the
 * active-run drawer, covered by sprint10).
 *
 * Supabase REST calls are mocked — no test data written.
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:   '11111111-1111-1111-1111-111111111111',
  batchNum:  'CTGC-20260601-A01-01',
  matId:     '22222222-2222-2222-2222-222222222222',
  procId:    '33333333-3333-3333-3333-333333333333',
  equipId:   '44444444-4444-4444-4444-444444444444',
  recipeId:  '55555555-5555-5555-5555-555555555555',
  runId:     '66666666-6666-6666-6666-666666666666',
}

const PROCESS_NO_CALIB = {
  process_id: M.procId, code: 'CALC', name: 'Calendaring',
  sequence_hint: 1, requires_calibration: false,
}
// Same process code (CALC) as PROCESS_NO_CALIB so the params section always
// renders 3 simple scalar fields — avoids needing CTGC's 8+ array fields.
const PROCESS_WITH_CALIB = {
  process_id: M.procId, code: 'CALC', name: 'Calendaring',
  sequence_hint: 1, requires_calibration: true,
}

async function setupCommonMocks(page: Page, processStep = PROCESS_NO_CALIB) {
  await page.route(`**${SB}/rest/v1/**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  await page.route(`**${SB}/rest/v1/users**`, route => route.continue())

  await page.route(`**${SB}/rest/v1/batches**`, route => {
    const url = route.request().url()
    if (route.request().method() === 'GET' && url.includes('batch_number')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: M.batchId, batch_number: M.batchNum, material_id: M.matId }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([processStep]) }),
  )

  await page.route(`**${SB}/rest/v1/equipment**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: M.equipId, name: 'Coating Machine A', equipment_code: 'CM-A', process_id: M.procId, is_active: true },
      ]),
    }),
  )

  await page.route(`**${SB}/rest/v1/recipes**`, route => {
    if (route.request().url().includes('select=params')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ params: {} }) })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: M.recipeId, recipe_number: 'RCP-001', version: '1.0', process_id: M.procId, is_active: true },
      ]),
    })
  })

  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    const method = route.request().method()
    if (method === 'POST') {
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: M.runId }) })
    }
    if (method === 'PATCH') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route(`**${SB}/rest/v1/process_run_inputs**`, route =>
    route.fulfill({ status: 201, contentType: 'application/json', body: '{}' }),
  )
  await page.route(`**${SB}/rest/v1/process_run_parameters**`, route =>
    route.fulfill({ status: 201, contentType: 'application/json', body: '{}' }),
  )
}

async function blockCamera(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () => Promise.reject(new DOMException('NotAllowed', 'NotAllowedError')),
        enumerateDevices: () => Promise.resolve([]),
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      },
      configurable: true,
    })
  })
}

/** Fill the three CALC parameter fields (section 4) so Start run enables. */
async function fillCalcParams(page: Page) {
  await page.getByPlaceholder('20', { exact: true }).fill('20')
  await page.getByPlaceholder('0.8', { exact: true }).fill('0.8')
  await page.getByPlaceholder('5', { exact: true }).fill('5')
}

/** Resolve the batch (section 1) then pick a process step (section 2). */
async function resolveBatchAndStep(page: Page, processName: string) {
  await page.getByPlaceholder(/e\.g\./i).first().fill(M.batchNum)
  await page.getByRole('button', { name: /find batch/i }).click()
  const sel = page.getByTestId('process-step-select')
  await expect(sel).toBeVisible({ timeout: 5000 })
  const optLocator = sel.locator('option').filter({ hasText: processName })
  const optVal = await optLocator.first().getAttribute('value')
  await sel.selectOption(optVal ?? '')
}

test('Find batch button disabled without a batch number', async ({ page }) => {
  await setupCommonMocks(page)
  await page.goto('/log/process-step')
  await expect(page.getByRole('button', { name: /find batch/i })).toBeDisabled()
})

test('Batch not found shows error', async ({ page }) => {
  await setupCommonMocks(page)
  await page.route(`**${SB}/rest/v1/batches**`, route =>
    route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found' }) }),
  )
  await page.goto('/log/process-step')
  await page.getByPlaceholder(/e\.g\./i).first().fill('FAKE-BATCH-NUM')
  await page.getByRole('button', { name: /find batch/i }).click()
  await expect(page.getByText(/Batch not found/i)).toBeVisible({ timeout: 5000 })
})

test('Calibration section shown for a process with requires_calibration=true', async ({ page }) => {
  await setupCommonMocks(page, PROCESS_WITH_CALIB)
  await page.goto('/log/process-step')
  await resolveBatchAndStep(page, 'Calendaring')
  await expect(page.getByText('Start-up Calibration Required')).toBeVisible()
})

test('Calibration gate disables Start run until confirmed', async ({ page }) => {
  await setupCommonMocks(page, PROCESS_WITH_CALIB)
  await page.goto('/log/process-step')
  await resolveBatchAndStep(page, 'Calendaring')
  await fillCalcParams(page)

  // Params filled but calibration not yet confirmed — still disabled.
  await expect(page.getByRole('button', { name: /start run/i })).toBeDisabled()
  await page.getByText('I confirm start-up calibration').click()
  await expect(page.getByRole('button', { name: /start run/i })).not.toBeDisabled()
})

test('Calibration section absent when requires_calibration=false', async ({ page }) => {
  await setupCommonMocks(page, PROCESS_NO_CALIB)
  await page.goto('/log/process-step')
  await resolveBatchAndStep(page, 'Calendaring')
  await expect(page.getByText('Calendared Length')).toBeVisible()
  await expect(page.getByText('Start-up Calibration Required')).not.toBeVisible()
})

test('Single active equipment auto-selects and shows as a value', async ({ page }) => {
  await setupCommonMocks(page, PROCESS_NO_CALIB)
  await page.goto('/log/process-step')
  await resolveBatchAndStep(page, 'Calendaring')

  await expect(page.getByTestId('equipment-value')).toContainText('Coating Machine A (CM-A)')
  await expect(page.getByTestId('recipe-value')).toContainText('RCP-001 v1.0')
})

test('Review section shows selected equipment and recipe', async ({ page }) => {
  await setupCommonMocks(page, PROCESS_NO_CALIB)
  await page.goto('/log/process-step')
  await resolveBatchAndStep(page, 'Calendaring')

  await expect(page.getByText('Review & start')).toBeVisible()
  await expect(page.getByText('Coating Machine A (CM-A)').last()).toBeVisible()
  await expect(page.getByText('RCP-001 v1.0').last()).toBeVisible()
})

test('Start run — process_runs INSERT contains equipment_id, recipe_id and status=InProgress', async ({ page }) => {
  await blockCamera(page)
  await setupCommonMocks(page, PROCESS_NO_CALIB)
  await page.goto('/log/process-step')
  await resolveBatchAndStep(page, 'Calendaring')
  await fillCalcParams(page)

  const [post] = await Promise.all([
    page.waitForRequest(r => r.url().includes('/rest/v1/process_runs') && r.method() === 'POST'),
    page.getByRole('button', { name: /start run/i }).click(),
  ])
  const body = JSON.parse(post.postData() ?? '{}')
  expect(body.equipment_id).toBe(M.equipId)
  expect(body.recipe_id).toBe(M.recipeId)
  expect(body.status).toBe('InProgress')
})

test('Start run — process_run_inputs INSERT records the input batch id', async ({ page }) => {
  await blockCamera(page)
  await setupCommonMocks(page, PROCESS_NO_CALIB)
  await page.goto('/log/process-step')
  await resolveBatchAndStep(page, 'Calendaring')
  await fillCalcParams(page)

  const [post] = await Promise.all([
    page.waitForRequest(r => r.url().includes('/rest/v1/process_run_inputs') && r.method() === 'POST'),
    page.getByRole('button', { name: /start run/i }).click(),
  ])
  const body = JSON.parse(post.postData() ?? '[]')
  const rows = Array.isArray(body) ? body : [body]
  expect(rows[0].input_batch_id).toBe(M.batchId)
})

test('Start run — inline success banner with Return to Batch and Log Another', async ({ page }) => {
  await blockCamera(page)
  await setupCommonMocks(page, PROCESS_NO_CALIB)
  await page.goto('/log/process-step')
  await resolveBatchAndStep(page, 'Calendaring')
  await fillCalcParams(page)

  await page.getByRole('button', { name: /start run/i }).click()
  await expect(page.getByText(/run started/i)).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('button', { name: /Return to Batch/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Log Another/i })).toBeVisible()
})

test('Start run — Log Another resets the form', async ({ page }) => {
  await blockCamera(page)
  await setupCommonMocks(page, PROCESS_NO_CALIB)
  await page.goto('/log/process-step')
  await resolveBatchAndStep(page, 'Calendaring')
  await fillCalcParams(page)

  await page.getByRole('button', { name: /start run/i }).click()
  await expect(page.getByText(/run started/i)).toBeVisible({ timeout: 8000 })

  await page.getByRole('button', { name: /Log Another/i }).click()
  await expect(page.getByPlaceholder(/e\.g\./i).first()).toBeVisible()
})

test('Start run — process_run_inputs INSERT records the input batch id (alternate path)', async ({ page }) => {
  await blockCamera(page)
  await setupCommonMocks(page, PROCESS_NO_CALIB)
  await page.goto('/log/process-step')
  await resolveBatchAndStep(page, 'Calendaring')
  await fillCalcParams(page)

  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('/rest/v1/process_run_inputs') && resp.request().method() === 'POST',
    { timeout: 8000 },
  )
  await page.getByTestId('start-run').click()
  const response = await responsePromise

  const body = JSON.parse(response.request().postData() ?? '{}')
  const inputBatchId = Array.isArray(body) ? body[0].input_batch_id : body.input_batch_id
  expect(inputBatchId).toBe(M.batchId)
})

test('Submit — server error shows error message and keeps Submit enabled', async ({ page }) => {
  await blockCamera(page)
  await setupCommonMocks(page, PROCESS_NO_CALIB)

  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 500, contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST500', message: 'DB write failed', details: null, hint: null }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.goto('/log/process-step')
  await resolveBatchAndStep(page, 'Calendaring')
  await fillCalcParams(page)
  await page.getByRole('button', { name: /start run/i }).click()

  await expect(page.getByText(/DB write failed/i)).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /start run/i })).not.toBeDisabled()
})
