import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const SB_UUID = '11111111-2222-3333-4444-555555555555'
const PARENT_UUID = '99999999-8888-7777-6666-555555555555'
const SB_CODE = 'MIXC-20260618-A01-01'

// Lot detail must show the source sub-batch's batch_number (custom code), never the UUID.
test('Lot detail shows sub-batch batch_number, not the UUID', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/lots**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'lot-1', lot_number: 'L-20260618-001', status: 'Released',
      category: 'Cathode Electrode', unit_count: 1, created_at: '2026-06-18',
      units: [
        { serial: 'U-20260618-001', lot_id: 'lot-1', sub_batch_id: SB_UUID,
          created_at: '2026-06-18', sub_batch: { batch_number: SB_CODE } },
      ],
      lot_sub_batches: [
        { sub_batch_id: SB_UUID, sub_batch: { batch_number: SB_CODE, parent_batch_id: PARENT_UUID } },
      ],
    }),
  }))
  await page.route(`**${SB}/rest/v1/alerts**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/alert_rules**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  for (const t of ['qc_check_results', 'equipment_maintenance', 'batches']) {
    await page.route(`**${SB}/rest/v1/${t}**`, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([]),
    }))
  }

  await page.goto('/lots/lot-1')

  // The custom batch code is shown (units table + source sub-batch list)
  await expect(page.getByText(SB_CODE).first()).toBeVisible()
  // The raw UUID must NOT leak into the page
  await expect(page.getByText(SB_UUID)).toHaveCount(0)

  // Source sub-batch link points at the two-segment sub-batch route
  const sbLink = page.getByRole('link', { name: SB_CODE })
  await expect(sbLink).toHaveAttribute('href', `/batches/${PARENT_UUID}/${SB_UUID}`)
})
