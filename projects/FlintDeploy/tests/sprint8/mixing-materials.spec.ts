import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const PARENT_UUID = 'aaaa1111-1111-1111-1111-111111111111'

const MOCK_MATERIALS = [
  { code: 'MTDW', name: 'DI Water' },
  { code: 'MTC1', name: 'Material C1' },
  { code: 'MTC2', name: 'Material C2' },
  { code: 'MTC3', name: 'Material C3' },
  { code: 'MTC4', name: 'Material C4' },
  { code: 'MTCR', name: 'Roll C' },
  { code: 'MTE1', name: 'Material E1' },
  { code: 'MTE2', name: 'Material E2' },
  { code: 'MTE3', name: 'Material E3' },
  { code: 'MTAR', name: 'Anode Roll' },
  { code: 'MTSR', name: 'Separator Roll' },
  { code: 'MTPP', name: 'Packaging' },
]

test.describe('GAP-01: Live materials in AddStepModal', () => {
  test.beforeEach(async ({ page }) => {
    // Catch-all first (Playwright LIFO — registered first = lowest priority)
    await page.route(`**${SB}/rest/v1/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // Materials query
    await page.route(`**${SB}/rest/v1/materials**`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATERIALS),
      })
    )

    // Process lookup by code
    await page.route(`**${SB}/rest/v1/processes*code=eq*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'proc-mix', code: 'MIXC' }),
      })
    )

    // Mixing steps — empty
    await page.route(`**${SB}/rest/v1/mixing_steps**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // Recipes
    await page.route(`**${SB}/rest/v1/recipes**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // QC check definitions
    await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // Batch lookup — return parent batch for batch_number lookup
    await page.route(`**${SB}/rest/v1/batches**`, route => {
      const url = route.request().url()
      if (url.includes('batch_number=eq')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: PARENT_UUID,
            batch_number: 'MIXC-20260625-A01',
            parent_batch_id: null,
            material_id: 'mat-uuid',
            status: 'InProgress',
          }),
        })
      }
      if (url.includes('parent_batch_id=eq')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
  })

  test('add-step modal lists live materials including MTPP', async ({ page }) => {
    await page.goto('/log/mixing/MIXC-20260625-A01')
    await page.getByRole('button', { name: /Add Step/i }).click()

    // The material select should contain MTPP — the tell that the live query is wired
    const select = page.locator('select').first()
    await expect(select).toBeVisible()
    const options = select.locator('option')
    await expect(options).toContainText(['MTPP'])
  })

  test('add-step modal shows all 12 materials from the database', async ({ page }) => {
    await page.goto('/log/mixing/MIXC-20260625-A01')
    await page.getByRole('button', { name: /Add Step/i }).click()

    const select = page.locator('select').first()
    await expect(select).toBeVisible()
    // 12 materials + 1 placeholder option = 13 options
    await expect(select.locator('option')).toHaveCount(13)
  })
})
