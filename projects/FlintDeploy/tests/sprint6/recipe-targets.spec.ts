import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

// Recipe target display is not yet implemented in the wizard — skip until
// the vertical form rewrite lands and adds target labels from recipe params.
test.skip('Selecting a recipe shows target values from recipe params', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  await page.route(`**${SB}/rest/v1/batches**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'b-1', material_id: 'm-1', batch_number: 'CALC-20260601-A01' }),
  }))

  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      { process_id: 'p-calc', code: 'CALC', name: 'Calendaring', sequence_hint: 1, requires_calibration: false },
    ]),
  }))

  await page.route(`**${SB}/rest/v1/equipment**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  let recipeFetchCount = 0
  await page.route(`**${SB}/rest/v1/recipes**`, route => {
    const url = route.request().url()
    if (url.includes('select=params')) {
      recipeFetchCount++
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          params: {
            pressure_mpa: 45,
            calendared_length_m: 100,
            feed_rate_m_per_min: 3.5,
          },
        }),
      })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'rcp-1', recipe_number: 'RCP-010', version: '1.0' }]),
    })
  })

  await page.goto('/log')

  await page.getByPlaceholder(/e\.g\. CTGC-20260601-A01/i).fill('CALC-20260601-A01')
  await page.getByRole('button', { name: /continue/i }).click()

  const stepSelect = page.getByTestId('process-step-select')
  await expect(stepSelect).toBeVisible({ timeout: 5000 })
  const stepOptLocator = stepSelect.locator('option').filter({ hasText: /Calendaring/ })
  await stepOptLocator.waitFor({ state: 'attached' })
  const stepOptVal = await stepOptLocator.first().getAttribute('value')
  await stepSelect.selectOption(stepOptVal ?? '')
  await page.getByRole('button', { name: /continue/i }).click()

  await page.locator('select').nth(1).selectOption('rcp-1')

  await expect(page.getByText('target: 45')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('target: 100')).toBeVisible()
  await expect(page.getByText('target: 3.5')).toBeVisible()
  expect(recipeFetchCount).toBeGreaterThan(0)
})
