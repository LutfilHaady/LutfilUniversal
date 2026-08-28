/**
 * Sprint 7 — Per-process step data forms.
 *
 * Migrated to the Phase 2 single-page model (Sprint 11). Field labels follow the
 * current PROCESS_LOG_FIELDS config in lib/constants.ts. Selecting a process
 * step reveals its dedicated parameter fields inline; "Start run" writes
 * process_run_parameters keyed by the structured parameter_key.
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:  '11111111-1111-1111-1111-111111111111',
  batchNum: 'CTGC-20260601-A01-01',
  matId:    '22222222-2222-2222-2222-222222222222',
  equipId:  '44444444-4444-4444-4444-444444444444',
  recipeId: '55555555-5555-5555-5555-555555555555',
  runId:    '66666666-6666-6666-6666-666666666666',
}

function makeProcess(code: string, name: string, procId: string) {
  return { process_id: procId, code, name, sequence_hint: 1, requires_calibration: false }
}

async function setupMocks(page: Page, process: ReturnType<typeof makeProcess>) {
  await page.route(`**${SB}/rest/v1/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  )
  await page.route(`**${SB}/rest/v1/users**`, route => route.continue())

  await page.route(`**${SB}/rest/v1/batches**`, route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 200, body: '[]' })
    if (route.request().url().includes('batch_number'))
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: M.batchId, batch_number: M.batchNum, material_id: M.matId }),
      })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([process]) }),
  )
  await page.route(`**${SB}/rest/v1/equipment**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: M.equipId, name: 'Machine A', equipment_code: 'MA', process_id: process.process_id, is_active: true }]),
    }),
  )
  await page.route(`**${SB}/rest/v1/recipes**`, route => {
    if (route.request().url().includes('select=params'))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ params: {} }) })
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: M.recipeId, recipe_number: 'RCP-001', version: '1.0', process_id: process.process_id, is_active: true }]),
    })
  })

  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    if (route.request().method() === 'POST')
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: M.runId }) })
    if (route.request().method() === 'PATCH') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })
  await page.route(`**${SB}/rest/v1/process_run_inputs**`, route => route.fulfill({ status: 201, body: '{}' }))
  await page.route(`**${SB}/rest/v1/process_run_parameters**`, route => route.fulfill({ status: 201, body: '{}' }))
}

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

async function resolveAndPick(page: Page, processName: string) {
  await page.getByPlaceholder(/e\.g\./i).first().fill(M.batchNum)
  await page.getByRole('button', { name: /find batch/i }).click()
  const sel = page.getByTestId('process-step-select')
  await expect(sel).toBeVisible({ timeout: 5000 })
  const optLocator = sel.locator('option').filter({ hasText: processName })
  const optVal = await optLocator.first().getAttribute('value')
  await sel.selectOption(optVal ?? '')
}

test.describe('Per-process step data forms', () => {
  test('Coating renders substrate speed, oven temps and fan speed', async ({ page }) => {
    await setupMocks(page, makeProcess('CTGC', 'Coating & Oven Drying', '33333333-3333-3333-3333-333333333333'))
    await page.goto('/log')
    await resolveAndPick(page, 'Coating & Oven Drying')

    await expect(page.getByText('Substrate Feeding Speed')).toBeVisible()
    await expect(page.getByText('Transfer Gap')).toBeVisible()
    await expect(page.getByText('Upper Oven')).toBeVisible()
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible()
  })

  test('Calendaring renders length, pressure and feed rate', async ({ page }) => {
    await setupMocks(page, makeProcess('CALC', 'Calendaring', '33333333-3333-3333-3333-333333333334'))
    await page.goto('/log')
    await resolveAndPick(page, 'Calendaring')

    await expect(page.getByText('Pressure')).toBeVisible()
    await expect(page.getByText('Feed Rate')).toBeVisible()
  })

  test('Die Cut renders piston travel depth and pcs cut', async ({ page }) => {
    await setupMocks(page, makeProcess('DICC', 'Die Cutting (Cathode)', '33333333-3333-3333-3333-333333333335'))
    await page.goto('/log')
    await resolveAndPick(page, 'Die Cutting (Cathode)')

    await expect(page.getByText('Cutting Piston Travel Depth')).toBeVisible()
    await expect(page.getByText('Pcs Cut')).toBeVisible()
  })

  test('parameter_key uses the structured key in the Start-run write body', async ({ page }) => {
    await blockCamera(page)
    await setupMocks(page, makeProcess('CALC', 'Calendaring', '33333333-3333-3333-3333-333333333334'))

    const paramBodies: Record<string, unknown>[] = []
    await page.route(`**${SB}/rest/v1/process_run_parameters**`, route => {
      if (route.request().method() === 'POST') paramBodies.push(JSON.parse(route.request().postData() || '{}'))
      return route.fulfill({ status: 201, body: '{}' })
    })

    await page.goto('/log')
    await resolveAndPick(page, 'Calendaring')

    // Fill Force field — find by the label's associated input
    // Force is the first scalar parameter field (after equipment select, recipe select, qty consumed)
    const pressureLabel = page.locator('label', { hasText: 'Pressure' })
    const pressureInput = pressureLabel.locator('..').locator('input[type="number"]')
    await pressureInput.fill('50')

    // Fill the remaining two CALC required fields so allParamsFilled=true
    await page.getByTestId('param-calendared_length_m').fill('100')
    await page.getByTestId('param-feed_rate_m_per_min').fill('10')

    await page.getByRole('button', { name: /start run/i }).click()

    await expect.poll(() => paramBodies.length, { timeout: 10000 }).toBeGreaterThan(0)
    expect(paramBodies.some(b => b.parameter_key === 'pressure_mpa')).toBe(true)
  })

  test('Cutting renders its own structured fields, not Die Cut fields', async ({ page }) => {
    await setupMocks(page, makeProcess('CUTS', 'Cutting (Separator)', '33333333-3333-3333-3333-333333333336'))
    await page.goto('/log')
    await resolveAndPick(page, 'Cutting (Separator)')

    await expect(page.getByText('Cutting Distance')).toBeVisible()
    await expect(page.getByText('Cutting Piston Travel Depth')).not.toBeVisible()
  })
})
