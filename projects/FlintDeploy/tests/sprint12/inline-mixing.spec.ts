import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

// Shared route setup for MIXC-based tests
async function setupMixcPage(page: Page) {
  // Catch-all — return empty arrays for anything not explicitly overridden
  await page.route(`**${SB}/rest/v1/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**${SB}/rest/v1/users**`, route => route.continue())

  await page.route(`**${SB}/rest/v1/batches**`, route => {
    if (route.request().method() === 'POST') {
      // Child batch creation
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: 'child-batch-1' }),
      })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: 'batch-uuid-1', batch_number: 'MTC1-20260521-A20', material_id: 'mat-1' }),
    })
  })

  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { process_id: 'p-mixc', code: 'MIXC', name: 'Mixing (Cathode)', sequence_hint: 1, requires_calibration: false },
      ]),
    }),
  )

  await page.route(`**${SB}/rest/v1/equipment**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**${SB}/rest/v1/recipes**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**${SB}/rest/v1/materials**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { code: 'PVDF', name: 'PVDF Binder' },
        { code: 'NMC', name: 'NMC Cathode' },
      ]),
    }),
  )
  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: 'run-1' }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route(`**${SB}/rest/v1/process_run_inputs**`, route =>
    route.fulfill({ status: 201, body: '' }),
  )
  // No QC defs by default (gate auto-completes)
  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
}

test('selecting MIXC does not redirect to /log/mixing/', async ({ page }) => {
  await setupMixcPage(page)

  const navEvents: string[] = []
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) navEvents.push(frame.url())
  })

  await page.goto('/log/process-step?batchNumber=MTC1-20260521-A20')

  // Wait for batch to resolve and process step dropdown to appear
  const stepSelect = page.getByTestId('process-step-select')
  await expect(stepSelect).toBeVisible({ timeout: 5000 })

  const urlBefore = page.url()
  const mixOptLocator = stepSelect.locator('option').filter({ hasText: /Mixing \(Cathode\)/ })
  const mixOptVal = await mixOptLocator.first().getAttribute('value')
  await stepSelect.selectOption(mixOptVal ?? '')

  // Should NOT navigate to /log/mixing/
  await page.waitForTimeout(500)
  const mixingNavOccurred = navEvents.some(u => u.includes('/log/mixing/'))
  expect(mixingNavOccurred).toBe(false)

  // The page should still show the process log
  await expect(page.getByText('Process Log')).toBeVisible()
  expect(page.url()).toBe(urlBefore)
})

test('MIXC shows Mixing steps section with placeholder before run starts', async ({ page }) => {
  await setupMixcPage(page)
  await page.goto('/log/process-step?batchNumber=MTC1-20260521-A20')

  const stepSel = page.getByTestId('process-step-select')
  await expect(stepSel).toBeVisible({ timeout: 5000 })
  const selOptLocator = stepSel.locator('option').filter({ hasText: /Mixing \(Cathode\)/ })
  const selOptVal = await selOptLocator.first().getAttribute('value')
  await stepSel.selectOption(selOptVal ?? '')

  // Section 4 heading appears
  await expect(page.getByText('Mixing steps')).toBeVisible({ timeout: 3000 })

  // Placeholder tells user to start first
  await expect(page.getByText(/start the mixing run below/i)).toBeVisible()

  // Sticky button says "Start mixing" not "Start run"
  await expect(page.getByTestId('start-run')).toHaveText('Start mixing')
})

test('clicking Start mixing creates InProgress run and reveals Add step button', async ({ page }) => {
  await setupMixcPage(page)

  let runBody: Record<string, unknown> | null = null
  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    if (route.request().method() === 'POST') {
      runBody = JSON.parse(route.request().postData() || '{}')
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: 'run-1' }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/log/process-step?batchNumber=MTC1-20260521-A20')
  const stepSel = page.getByTestId('process-step-select')
  await expect(stepSel).toBeVisible({ timeout: 5000 })
  const selOptLocator = stepSel.locator('option').filter({ hasText: /Mixing \(Cathode\)/ })
  const selOptVal = await selOptLocator.first().getAttribute('value')
  await stepSel.selectOption(selOptVal ?? '')

  await expect(page.getByTestId('start-run')).toBeVisible({ timeout: 3000 })
  await page.getByTestId('start-run').click()

  // Verify InProgress run was created with correct process_id
  await expect.poll(() => runBody?.process_id).toBe('p-mixc')
  await expect.poll(() => runBody?.status).toBe('InProgress')

  // "Add step" button appears; sticky Start button disappears
  await expect(page.getByTestId('add-mix-step')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('start-run')).not.toBeVisible()
})

test('Add step form opens, logs an add_material step, and QC auto-completes when no defs', async ({ page }) => {
  await setupMixcPage(page)

  let mixStepBody: Record<string, unknown> | null = null
  await page.route(`**${SB}/rest/v1/rpc/log_mixing_step**`, route => {
    mixStepBody = JSON.parse(route.request().postData() || '{}')
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: 'step-1',
        step_number: 1,
        label: 'Add PVDF Binder',
        display_ref: 'S01',
        status: 'in_progress',
        created_at: '2026-06-28T10:00:00Z',
      }),
    })
  })

  await page.goto('/log/process-step?batchNumber=MTC1-20260521-A20')
  const stepSel = page.getByTestId('process-step-select')
  await expect(stepSel).toBeVisible({ timeout: 5000 })
  const selOptLocator = stepSel.locator('option').filter({ hasText: /Mixing \(Cathode\)/ })
  const selOptVal = await selOptLocator.first().getAttribute('value')
  await stepSel.selectOption(selOptVal ?? '')
  await page.getByTestId('start-run').click()

  // Open the add step form
  await expect(page.getByTestId('add-mix-step')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('add-mix-step').click()

  // Add material form appears
  await expect(page.getByTestId('mix-material-select')).toBeVisible()
  await page.getByTestId('mix-material-select').selectOption('PVDF')
  await page.getByTestId('mix-quantity').fill('5.0')

  // Log Step
  await expect(page.getByTestId('log-mix-step')).toBeEnabled()
  await page.getByTestId('log-mix-step').click()

  // RPC was called with correct params
  await expect.poll(() => mixStepBody?.p_type).toBe('add_material')
  await expect.poll(() => (mixStepBody?.p_params as Record<string, unknown>)?.materialCode).toBe('PVDF')

  // No QC defs → gate auto-completes → "Add step" button reappears
  await expect(page.getByTestId('add-mix-step')).toBeVisible({ timeout: 5000 })
})

test('QC gate blocks adding next step until QC is submitted', async ({ page }) => {
  await setupMixcPage(page)

  // Override QC defs to return a single visual check
  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'qc-def-1',
          qc_item_name: 'Colour check',
          method: 'VisualManual',
          timing: 'During',
          acceptance_criteria_text: 'Uniform black',
          is_active: true,
        },
      ]),
    }),
  )
  await page.route(`**${SB}/rest/v1/rpc/log_mixing_step**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: 'step-1', step_number: 1, label: 'Add PVDF Binder',
        display_ref: 'S01', status: 'in_progress', created_at: '2026-06-28T10:00:00Z',
      }),
    }),
  )
  await page.route(`**${SB}/rest/v1/qc_check_results**`, route =>
    route.fulfill({ status: 201, body: '' }),
  )

  await page.goto('/log/process-step?batchNumber=MTC1-20260521-A20')
  const stepSel = page.getByTestId('process-step-select')
  await expect(stepSel).toBeVisible({ timeout: 5000 })
  const selOptLocator = stepSel.locator('option').filter({ hasText: /Mixing \(Cathode\)/ })
  const selOptVal = await selOptLocator.first().getAttribute('value')
  await stepSel.selectOption(selOptVal ?? '')
  await page.getByTestId('start-run').click()

  await expect(page.getByTestId('add-mix-step')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('add-mix-step').click()
  await page.getByTestId('mix-material-select').selectOption('PVDF')
  await page.getByTestId('mix-quantity').fill('5.0')
  await page.getByTestId('log-mix-step').click()

  // QC gate appears with the check definition
  await expect(page.getByText('QC Check')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Colour check')).toBeVisible()

  // "Add step" button is blocked while gate is open
  await expect(page.getByTestId('add-mix-step')).not.toBeVisible()

  // Submit QC (pass)
  await page.getByRole('button', { name: /colour check pass/i }).click()
  await page.getByRole('button', { name: /submit qc results/i }).click()

  // Gate clears, "Add step" reappears
  await expect(page.getByTestId('add-mix-step')).toBeVisible({ timeout: 5000 })
})
