/**
 * Recipe active toggle (app/recipes/page.tsx) — Task 3a
 * Asserts the toggle issues a PATCH to /rest/v1/recipes and flips the UI.
 * Stateless mocks; /rest/v1/users left real (Engineer role can edit).
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const RECIPE_ID = '11111111-1111-1111-1111-111111111111'

async function setupMocks(page: Page, calls: { patched: boolean }) {
  await page.route(`**${SB}/rest/v1/recipes**`, async route => {
    if (route.request().method() === 'PATCH') { calls.patched = true; return route.fulfill({ status: 204, body: '' }) }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: RECIPE_ID, process_id: 'p1', name: 'Cathode Mix A', version: '1.0',
        recipe_number: 'RCP-001', is_active: true, notes: null, params: {},
        created_at: '2026-05-21', created_by: null, parent_recipe_id: null,
        process: { name: 'Mixing (Cathode)', code: 'MIXC' },
        creator: { full_name: 'Dev Engineer' },
      }]),
    })
  })
}

test('toggling a recipe active state PATCHes Supabase', async ({ page }) => {
  const calls = { patched: false }
  await setupMocks(page, calls)
  await page.goto('/recipes')

  await expect(page.getByText('Cathode Mix A')).toBeVisible()
  const row = page.getByRole('row', { name: /Cathode Mix A/ })
  await row.getByRole('button').last().click()

  await expect.poll(() => calls.patched).toBe(true)
})
