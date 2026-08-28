/**
 * QR scan → machine deep-link (Fix 1)
 *
 * Covers the two new code paths in app/scan/page.tsx and app/machines/page.tsx:
 *  1. Scanning an equipment-code-format string navigates to /machines?equipment=<code>
 *  2. Scanning an unknown equipment code shows "Machine Not Found" with the code
 *  3. /machines?equipment=MA001 auto-expands the matching machine row on load
 *
 * Auth: Engineer session (tests/.auth/engineer.json)
 * All Supabase REST calls are mocked via page.route() — no real DB writes.
 */

import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const EQ_CODE = 'MA001'
const EQ_ID   = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function machineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EQ_ID,
    equipment_code: EQ_CODE,
    name: '60L Mixer',
    process_id: 'p1',
    supplier_info: null,
    is_active: true,
    created_at: '2026-06-01',
    checklist_template: [],
    process: { name: 'Mixing (Cathode)', code: 'MIXC' },
    equipment_maintenance: [],
    ...overrides,
  }
}

test.describe('QR scan → machine deep-link', () => {

  test('scanning a valid equipment code navigates to /machines?equipment=<code>', async ({ page }) => {
    // equipment table returns the machine
    await page.route(`**${SB}/rest/v1/equipment*`, route => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('equipment_code') === `eq.${EQ_CODE}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: EQ_ID }),
        })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([machineRow()]) })
    })

    await page.goto('/scan')
    await page.getByPlaceholder(/MIXC-20260430-A01-03/i).fill(EQ_CODE)
    await page.getByRole('button', { name: 'Go' }).click()

    await page.waitForURL(`**/machines?equipment=${EQ_CODE}`)
    await expect(page).toHaveURL(new RegExp(`/machines\\?equipment=${EQ_CODE}`))
  })

  test('scanning an unknown equipment code shows Machine Not Found with the code', async ({ page }) => {
    const UNKNOWN = 'ZZ999'

    // equipment table returns PGRST116 (no rows)
    await page.route(`**${SB}/rest/v1/equipment*`, route => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('equipment_code') === `eq.${UNKNOWN}`) {
        return route.fulfill({
          status: 406,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }),
        })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    })

    await page.goto('/scan')
    await page.getByPlaceholder(/MIXC-20260430-A01-03/i).fill(UNKNOWN)
    await page.getByRole('button', { name: 'Go' }).click()

    await expect(page.getByText('Machine Not Found')).toBeVisible()
    await expect(page.getByText(new RegExp(UNKNOWN))).toBeVisible()
  })

  test('machines page auto-expands the row matching ?equipment= on load', async ({ page }) => {
    await page.route(`**${SB}/rest/v1/equipment*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([machineRow()]),
      })
    )
    await page.route(`**${SB}/rest/v1/equipment_maintenance*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    )

    await page.goto(`/machines?equipment=${EQ_CODE}`)

    // The expanded row shows the "Maintenance Log" section label
    await expect(page.getByText('Maintenance Log')).toBeVisible()
    // The machine code is also visible (it's in the table row)
    await expect(page.getByText(EQ_CODE)).toBeVisible()
  })

})
