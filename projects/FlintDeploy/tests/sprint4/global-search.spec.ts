/**
 * Global search (⌘K command palette) — header search wiring.
 *
 * Covers:
 *  - Trigger opens the palette; typing runs a live search across
 *    batches / lots / recipes / machines and renders grouped results.
 *  - Selecting a batch result navigates to its detail route (sub-batch →
 *    /batches/{parentId}/{subId}).
 *  - ⌘K opens the palette and Escape closes it.
 *  - Sidebar Machines nav item no longer carries the hardcoded "2" badge.
 *
 * Hosted on /lots (a light page). All Supabase REST calls touched by the
 * header + palette are mocked statelessly. alert_rules is stubbed empty so the
 * header's alert scan is a no-op. /rest/v1/users is left real (auth role).
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const PARENT_ID = '10000000-1000-1000-1000-100000000000'
const SUB_ID = '20000000-2000-2000-2000-200000000000'

async function baseMocks(page: Page) {
  // Header alert scan → no-op (empty rule catalog) + empty alert feed
  await page.route(`**${SB}/rest/v1/alert_rules**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/alerts**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))

  // Lots host page + palette lots query
  await page.route(`**${SB}/rest/v1/lots**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: 'lot-1', lot_number: 'LOT-20260601-001', category: 'standard',
        status: 'Released', battery_type: 'LFP', storage_location: 'A3',
        notes: null, created_by: null, created_at: '2026-06-01T00:00:00Z',
        lot_sub_batches: [],
      }]),
    }))

  // Palette: batches search → one sub-batch
  await page.route(`**${SB}/rest/v1/batches**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: SUB_ID, batch_number: 'MIXC-20260601-A01-01',
        parent_batch_id: PARENT_ID, status: 'InProgress',
      }]),
    }))

  // Palette: recipes search
  await page.route(`**${SB}/rest/v1/recipes**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: 'rcp-1', name: 'Cathode Mix A', recipe_number: 'RCP-001', version: '1.0',
      }]),
    }))

  // Palette: equipment/machines search
  await page.route(`**${SB}/rest/v1/equipment**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: 'eq-1', equipment_code: 'MA001', name: '60L Mixer',
      }]),
    }))
}

test('palette searches and a batch result navigates to its detail route', async ({ page }) => {
  await baseMocks(page)
  await page.goto('/lots')

  await page.getByRole('button', { name: 'Search' }).click()

  const input = page.getByPlaceholder(/Search batches, lots, recipes, machines/i)
  await expect(input).toBeFocused()
  await input.fill('A01')

  // Grouped results render across entity types (scoped to the palette dialog)
  const dialog = page.getByRole('dialog', { name: 'Global search' })
  await expect(dialog.getByText('MIXC-20260601-A01-01')).toBeVisible()
  await expect(dialog.getByText('LOT-20260601-001')).toBeVisible()
  await expect(dialog.getByText('Cathode Mix A')).toBeVisible()
  await expect(dialog.getByText('60L Mixer')).toBeVisible()

  await dialog.getByText('MIXC-20260601-A01-01').click()
  await page.waitForURL(`**/batches/${PARENT_ID}/${SUB_ID}`)
  await expect(page).toHaveURL(new RegExp(`/batches/${PARENT_ID}/${SUB_ID}`))
})

test('Cmd+K opens the palette and Escape closes it', async ({ page }) => {
  await baseMocks(page)
  await page.goto('/lots')
  await page.locator('body').click()

  await page.keyboard.press('Control+k')
  const input = page.getByPlaceholder(/Search batches, lots, recipes, machines/i)
  await expect(input).toBeVisible()
  await expect(input).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(input).toHaveCount(0)
})

test('Machines sidebar item no longer shows the hardcoded badge', async ({ page }) => {
  await baseMocks(page)
  await page.goto('/lots')

  const machines = page.getByRole('link', { name: 'Machines' })
  await expect(machines).toBeVisible()
  await expect(machines).toHaveText('Machines')
})
