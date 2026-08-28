/**
 * Sprint 5 (Lutfil) — Recipe per-material amounts (L-1 remainder)
 *
 * Tests cover:
 *  - New Mixing recipe — adding a Material Step row defaults Amount to 1 kg
 *  - Saving persists the entered amount into recipes.params.mixing_steps[].amount_kg
 *  - Editing an existing recipe pre-fills Amount from saved params
 *  - Editing a legacy recipe missing amount_kg defaults the field to 1
 *
 * Supabase REST calls are mocked at the network layer — no test data written.
 * /rest/v1/users is left real so auth context resolves the Engineer role.
 */

import { test, expect, type Page, type Locator } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const PROCESSES = [
  { id: 'proc-mixc-id', name: 'Mixing (Cathode)' },
  { id: 'proc-mixe-id', name: 'Mixing (Electrolyte)' },
]

function fieldInput(page: Page, labelText: string): Locator {
  return page.locator('div.flex.flex-col.gap-1', { hasText: labelText }).locator('input')
}

async function mockProcesses(page: Page) {
  await page.route(`**${SB}/rest/v1/processes**`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROCESSES) })
  )
}

test('new Mixing recipe — Amount defaults to 1 kg and the entered value is saved', async ({ page }) => {
  await mockProcesses(page)

  await page.route(`**${SB}/rest/v1/recipes**`, async route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'new-recipe-id', name: 'Cathode Mix Test', version: '1.0',
          process_id: 'proc-mixc-id', created_by: null, parent_recipe_id: null,
          is_active: true, created_at: '2026-06-11', notes: null,
          params: { mixing_steps: [{ material: 'Cathode Material C1', amount_kg: 2, mixing_time_hr: 1, temperature_c: 1, internal_pressure_bar: 1, dispersion_rpm: 1, propeller_rpm: 1, target_viscosity_mpas: 1 }] },
        }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/recipes')
  await expect(page.getByText('No recipes found')).toBeVisible()

  await page.getByRole('button', { name: /New Recipe/i }).click()
  // Recipe panel now opens on a type-selection step (added with simplified ratio
  // mode) — choose Standard to reach the parameter form this test exercises.
  await page.getByRole('button', { name: /Standard Recipe/i }).click()
  await page.getByPlaceholder('e.g. Standard Cathode Coat v4').fill('Cathode Mix Test')
  await page.getByRole('button', { name: /Next: Set Parameters/i }).click()

  await page.getByRole('button', { name: /Add Material Step/i }).click()

  // New row defaults Amount to 1
  await expect(fieldInput(page, 'Amount (kg)')).toHaveValue('1')

  await fieldInput(page, 'Material').fill('Cathode Material C1')
  await fieldInput(page, 'Mixing Time (hr)').fill('1')
  await fieldInput(page, 'Temperature (°C)').fill('1')
  await fieldInput(page, 'Internal Pressure (bar)').fill('1')
  await fieldInput(page, 'Dispersion RPM (rpm)').fill('1')
  await fieldInput(page, 'Propeller RPM (rpm)').fill('1')
  await fieldInput(page, 'Target Viscosity (mPa·s)').fill('1')
  await fieldInput(page, 'Amount (kg)').fill('2')

  const [postReq] = await Promise.all([
    page.waitForRequest(req => req.url().includes('/rest/v1/recipes') && req.method() === 'POST'),
    page.getByRole('button', { name: /Save Recipe/i }).click(),
  ])

  const body = JSON.parse(postReq.postData() ?? '{}')
  expect(body.params.mixing_steps[0].amount_kg).toBe(2)
  expect(body.params.mixing_steps[0].material).toBe('Cathode Material C1')
})

test('editing an existing recipe pre-fills Amount from saved params (defaults to 1 if missing)', async ({ page }) => {
  await mockProcesses(page)

  const ROW_WITH_AMOUNT = { material: 'Cathode Material C1', amount_kg: 5, mixing_time_hr: 2, temperature_c: 60, internal_pressure_bar: 1, dispersion_rpm: 1000, propeller_rpm: 500, target_viscosity_mpas: 2000 }
  const ROW_WITHOUT_AMOUNT = { material: 'Cathode Material C2', mixing_time_hr: 2, temperature_c: 60, internal_pressure_bar: 1, dispersion_rpm: 1000, propeller_rpm: 500, target_viscosity_mpas: 2000 }

  await page.route(`**${SB}/rest/v1/recipes**`, async route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'r1', name: 'Cathode Mix A', recipe_number: 'RCP-010', version: '1.0',
          process_id: 'proc-mixc-id', is_active: true, notes: null, created_at: '2026-06-01',
          created_by: null, parent_recipe_id: null,
          process: { name: 'Mixing (Cathode)', code: 'MIXC' },
          creator: { full_name: 'Dev Engineer' },
          params: { mixing_steps: [ROW_WITH_AMOUNT] },
        },
        {
          id: 'r2', name: 'Cathode Mix B', recipe_number: 'RCP-011', version: '1.0',
          process_id: 'proc-mixc-id', is_active: true, notes: null, created_at: '2026-06-01',
          created_by: null, parent_recipe_id: null,
          process: { name: 'Mixing (Cathode)', code: 'MIXC' },
          creator: { full_name: 'Dev Engineer' },
          params: { mixing_steps: [ROW_WITHOUT_AMOUNT] },
        },
      ]),
    })
  )

  // Recipe with amount_kg=5 saved
  await page.goto('/recipes')
  await page.getByText('Cathode Mix A').click()
  await page.getByRole('button', { name: /Edit Parameters/i }).click()
  await page.getByRole('button', { name: /Next: Set Parameters/i }).click()
  await expect(fieldInput(page, 'Amount (kg)')).toHaveValue('5')

  // Recipe with no amount_kg saved -> defaults to 1
  await page.goto('/recipes')
  await page.getByText('Cathode Mix B').click()
  await page.getByRole('button', { name: /Edit Parameters/i }).click()
  await page.getByRole('button', { name: /Next: Set Parameters/i }).click()
  await expect(fieldInput(page, 'Amount (kg)')).toHaveValue('1')
})
