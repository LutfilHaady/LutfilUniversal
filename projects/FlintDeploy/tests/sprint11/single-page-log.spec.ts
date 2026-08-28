/**
 * Sprint 11 — Process Log Redesign, Phase 2: single-page rewrite
 *
 * The process log is no longer a step-by-step wizard. It is one scrolling page
 * whose numbered sections reveal progressively as prerequisites are met:
 *   1 Scan batch  2 Process step  3 Equipment & recipe  4 Parameters  5 Start
 *
 * The defining behavioural change: tapping "Start run" INSERTs process_runs with
 * status=InProgress and leaves it open — completion happens later in the
 * active-run drawer (covered by sprint10), NOT in the same submit. Recipes now
 * drive the form: a single active equipment/recipe auto-selects, recipe params
 * pre-fill the matching fields, and operator deviations are flagged so
 * recipe_unchanged / is_modified_from_recipe carry real values.
 *
 * All Supabase REST/RPC mocked via page.route(); /rest/v1/users left real so the
 * engineer role resolves. Stateless mocks (no call counters).
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:  '11111111-1111-1111-1111-111111111111',
  batchNum: 'CALC-20260601-A01-01',
  matId:    '22222222-2222-2222-2222-222222222222',
  procId:   '33333333-3333-3333-3333-333333333333',
  equipId:  '44444444-4444-4444-4444-444444444444',
  recipeId: '55555555-5555-5555-5555-555555555555',
  runId:    '66666666-6666-6666-6666-666666666666',
}

const CALC = { process_id: M.procId, code: 'CALC', name: 'Calendaring', sequence_hint: 1, requires_calibration: false }

interface MockOpts {
  process?: typeof CALC
  equipment?: unknown[]
  recipes?: unknown[]
  recipeParams?: Record<string, unknown>
  activeRuns?: unknown[]
  batchByNumber?: Record<string, { id: string; batch_number: string; material_id: string }>
}

async function setupMocks(page: Page, opts: MockOpts = {}) {
  const process = opts.process ?? CALC
  const equipment = opts.equipment ?? [
    { id: M.equipId, name: 'Calender A', equipment_code: 'CL-A', process_id: M.procId, is_active: true },
  ]
  const recipes = opts.recipes ?? [
    { id: M.recipeId, recipe_number: 'RCP-001', version: '1.0', process_id: M.procId, is_active: true },
  ]
  // Default pre-fills all three CALC fields so allParamsFilled=true and Start run is enabled.
  const recipeParams = opts.recipeParams ?? { pressure_mpa: 0.8, calendared_length_m: 20, feed_rate_m_per_min: 5 }
  const activeRuns = opts.activeRuns ?? []
  const batchMap = opts.batchByNumber ?? {
    [M.batchNum]: { id: M.batchId, batch_number: M.batchNum, material_id: M.matId },
  }

  await page.route(`**${SB}/rest/v1/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )

  await page.route(`**${SB}/rest/v1/users**`, route => route.continue())

  await page.route(`**${SB}/rest/v1/batches**`, route => {
    if (route.request().method() !== 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    const url = decodeURIComponent(route.request().url())
    const match = Object.values(batchMap).find(b => url.includes(b.batch_number))
    if (match) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(match) })
    }
    return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found' }) })
  })

  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([process]) }),
  )

  await page.route(`**${SB}/rest/v1/equipment**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(equipment) }),
  )

  await page.route(`**${SB}/rest/v1/recipes**`, route => {
    if (route.request().url().includes('select=params')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ params: recipeParams }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(recipes) })
  })

  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    const method = route.request().method()
    if (method === 'POST') {
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: M.runId }) })
    }
    if (method === 'PATCH') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activeRuns) })
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

/** Resolve the primary batch on the single page (section 1). */
async function resolveBatch(page: Page, num = M.batchNum) {
  await page.getByPlaceholder(/e\.g\. CALC-20260601-A01|e\.g\./i).first().fill(num)
  await page.getByRole('button', { name: /find batch/i }).click()
}

/** Resolve batch then pick a process step (section 2). */
async function resolveBatchAndStep(page: Page, processName: string) {
  await resolveBatch(page)
  const sel = page.getByTestId('process-step-select')
  await expect(sel).toBeVisible({ timeout: 5000 })
  const optLocator = sel.locator('option').filter({ hasText: processName })
  const optVal = await optLocator.first().getAttribute('value')
  await sel.selectOption(optVal ?? '')
}

test('no wizard: selecting a process step does not require a Continue button', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/log')
  await resolveBatch(page)
  // Section 2 appears inline once the batch resolves — dropdown, no "Continue" gate.
  await expect(page.getByTestId('process-step-select')).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /^continue/i })).toHaveCount(0)
})

test('section 2 reveals only after the batch resolves', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/log')
  await expect(page.getByTestId('process-step-select')).toHaveCount(0)
  await resolveBatch(page)
  await expect(page.getByTestId('process-step-select')).toBeVisible({ timeout: 5000 })
})

test('a single active equipment auto-selects and its id is sent on Start run', async ({ page }) => {
  await blockCamera(page)
  await setupMocks(page)
  await page.goto('/log')
  await resolveBatchAndStep(page, 'Calendaring')

  // Auto-selected equipment is shown as a value (no dropdown needed for 1 option).
  await expect(page.getByTestId('equipment-value')).toContainText('Calender A')

  const [post] = await Promise.all([
    page.waitForRequest(r => r.url().includes('/rest/v1/process_runs') && r.method() === 'POST'),
    page.getByRole('button', { name: /start run/i }).click(),
  ])
  const body = JSON.parse(post.postData() ?? '{}')
  expect(body.equipment_id).toBe(M.equipId)
  expect(body.recipe_id).toBe(M.recipeId)
  expect(body.status).toBe('InProgress')
})

test('a single active recipe pre-fills params with a target hint', async ({ page }) => {
  await setupMocks(page, { recipeParams: { pressure_mpa: 0.8, calendared_length_m: 20 } })
  await page.goto('/log')
  await resolveBatchAndStep(page, 'Calendaring')

  await expect(page.getByTestId('recipe-value')).toContainText('RCP-001 v1.0')
  await expect(page.getByTestId('prefill-note')).toBeVisible()
  // Pressure field pre-filled from the recipe.
  await expect(page.getByTestId('param-pressure_mpa')).toHaveValue('0.8')
  await expect(page.getByText(/target: 0\.8/i)).toBeVisible()
})

test('editing a pre-filled field away from its target flags it as modified', async ({ page }) => {
  await setupMocks(page, { recipeParams: { pressure_mpa: 0.8, calendared_length_m: 20, feed_rate_m_per_min: 5 } })
  await page.goto('/log')
  await resolveBatchAndStep(page, 'Calendaring')

  await expect(page.getByTestId('modified-pressure_mpa')).toHaveCount(0)
  await page.getByTestId('param-pressure_mpa').fill('1.2')
  await expect(page.getByTestId('modified-pressure_mpa')).toBeVisible()
})

test('Start run sends recipe_unchanged=true when nothing is edited', async ({ page }) => {
  await blockCamera(page)
  await setupMocks(page, { recipeParams: { pressure_mpa: 0.8, calendared_length_m: 20, feed_rate_m_per_min: 5 } })
  await page.goto('/log')
  await resolveBatchAndStep(page, 'Calendaring')

  const [post] = await Promise.all([
    page.waitForRequest(r => r.url().includes('/rest/v1/process_runs') && r.method() === 'POST'),
    page.getByRole('button', { name: /start run/i }).click(),
  ])
  expect(JSON.parse(post.postData() ?? '{}').recipe_unchanged).toBe(true)
})

test('Start run sends recipe_unchanged=false and per-param is_modified after an edit', async ({ page }) => {
  await blockCamera(page)
  await setupMocks(page, { recipeParams: { pressure_mpa: 0.8, calendared_length_m: 20, feed_rate_m_per_min: 5 } })
  await page.goto('/log')
  await resolveBatchAndStep(page, 'Calendaring')
  await expect(page.getByTestId('prefill-note')).toBeVisible({ timeout: 5000 })

  await page.getByTestId('param-pressure_mpa').fill('1.2')

  const paramBodies: Record<string, unknown>[] = []
  await page.route(`**${SB}/rest/v1/process_run_parameters**`, route => {
    if (route.request().method() === 'POST') paramBodies.push(JSON.parse(route.request().postData() || '{}'))
    return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
  })

  const [post] = await Promise.all([
    page.waitForRequest(r => r.url().includes('/rest/v1/process_runs') && r.method() === 'POST'),
    page.getByRole('button', { name: /start run/i }).click(),
  ])
  expect(JSON.parse(post.postData() ?? '{}').recipe_unchanged).toBe(false)

  await expect.poll(() => paramBodies.length).toBeGreaterThan(0)
  const pressure = paramBodies.find(b => b.parameter_key === 'pressure_mpa')
  expect(pressure?.is_modified_from_recipe).toBe(true)
})

test('Start run does NOT immediately patch the run to AwaitingQC', async ({ page }) => {
  await blockCamera(page)
  await setupMocks(page, { recipeParams: { pressure_mpa: 0.8, calendared_length_m: 20, feed_rate_m_per_min: 5 } })
  await page.goto('/log')
  await resolveBatchAndStep(page, 'Calendaring')

  let patched = false
  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    const method = route.request().method()
    if (method === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: M.runId }) })
    if (method === 'PATCH') { patched = true; return route.fulfill({ status: 204, body: '' }) }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.getByRole('button', { name: /start run/i }).click()
  await expect(page.getByText(/run started/i)).toBeVisible({ timeout: 8000 })
  expect(patched).toBe(false)
})

test('after Start run an inline success banner offers Log another and Return to batch', async ({ page }) => {
  await blockCamera(page)
  await setupMocks(page)
  await page.goto('/log')
  await resolveBatchAndStep(page, 'Calendaring')

  await page.getByRole('button', { name: /start run/i }).click()
  await expect(page.getByText(/run started/i)).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('button', { name: /log another/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /return to batch/i })).toBeVisible()

  await page.getByRole('button', { name: /log another/i }).click()
  await expect(page.getByPlaceholder(/e\.g\./i).first()).toBeVisible()
})

test('calibration gate disables Start run until confirmed', async ({ page }) => {
  // Use CALC with requires_calibration=true — default recipeParams pre-fills all 3 CALC fields
  // so the only thing blocking Start run is the unchecked calibration confirmation.
  await setupMocks(page, { process: { ...CALC, requires_calibration: true } })
  await page.goto('/log')
  await resolveBatchAndStep(page, 'Calendaring')

  await expect(page.getByText('Start-up Calibration Required')).toBeVisible()
  await expect(page.getByRole('button', { name: /start run/i })).toBeDisabled()
  await page.getByText(/I confirm start-up calibration/i).click()
  await expect(page.getByRole('button', { name: /start run/i })).not.toBeDisabled()
})

test('UTPC shows multi-batch input and records one input row per batch', async ({ page }) => {
  await blockCamera(page)
  await setupMocks(page, {
    process: { ...CALC, code: 'UTPC', name: 'Assembly' },
    recipes: [],
    batchByNumber: {
      'UTPC-A': { id: 'b-1', batch_number: 'UTPC-A', material_id: 'm-1' },
      'INPUT-B': { id: 'b-2', batch_number: 'INPUT-B', material_id: 'm-2' },
    },
  })
  await page.goto('/log')
  await resolveBatch(page, 'UTPC-A')
  const utpcSel = page.getByTestId('process-step-select')
  await expect(utpcSel).toBeVisible({ timeout: 5000 })
  const utpcOptLocator = utpcSel.locator('option').filter({ hasText: /Assembly/ })
  const utpcOptVal = await utpcOptLocator.first().getAttribute('value')
  await utpcSel.selectOption(utpcOptVal ?? '')

  await expect(page.getByText(/Cell Assembled/i)).toBeVisible()
  await page.getByTestId('param-cell_assembled').fill('500')
  await page.getByPlaceholder('Scan/Enter Batch Number').fill('INPUT-B')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('INPUT-B').first()).toBeVisible()

  let inputInserts: Array<{ input_batch_id: string }> = []
  await page.route(`**${SB}/rest/v1/process_run_inputs**`, route => {
    if (route.request().method() === 'POST') inputInserts = JSON.parse(route.request().postData() || '[]')
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  })

  await page.getByRole('button', { name: /start run/i }).click()
  await expect.poll(() => inputInserts.length).toBe(2)
  expect(inputInserts[0].input_batch_id).toBe('b-1')
  expect(inputInserts[1].input_batch_id).toBe('b-2')
})

test('changing the batch collapses and invalidates downstream sections', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/log')
  await resolveBatchAndStep(page, 'Calendaring')
  // Section 3 is showing equipment now.
  await expect(page.getByTestId('equipment-value')).toBeVisible()

  // Re-open section 1 and change the batch.
  await page.getByTestId('edit-section-1').click()
  await expect(page.getByText('Calendaring')).toHaveCount(0)
  await expect(page.getByTestId('equipment-value')).toHaveCount(0)
})

test('the active-run drawer appears after the run is started', async ({ page }) => {
  await blockCamera(page)
  // process_runs GET returns the freshly-started run so the drawer rehydrates.
  await setupMocks(page, {
    activeRuns: [{
      id: M.runId, process_id: M.procId, start_date: '2026-06-28', start_time: '09:00', status: 'InProgress',
      process: { name: 'Calendaring', code: 'CALC' },
      process_run_inputs: [{ input_batch: { id: M.batchId, batch_number: M.batchNum } }],
    }],
  })
  await page.goto('/log')
  await expect(page.getByTestId('active-run-drawer')).toBeVisible()
})
