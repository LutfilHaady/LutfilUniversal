import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const EQ_ID = '22222222-2222-2222-2222-222222222222'

async function adminUser(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/users**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ full_name: 'Dev Admin', role_id: 'r-admin', roles: { name: 'Admin' } }),
  }))
}

async function processesMock(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/processes**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 'p1', name: 'Mixing (Cathode)' }]),
  }))
}

function machineRow() {
  return {
    id: EQ_ID, equipment_code: 'MA001', name: '60L Mixer', process_id: 'p1',
    supplier_info: null, is_active: true, created_at: '2026-06-05',
    checklist_template: [], process: { name: 'Mixing (Cathode)', code: 'MIXC' },
    equipment_maintenance: [],
  }
}

test('Log Maintenance shows single "Reviewed & Approved By" field and writes to both DB columns', async ({ page }) => {
  await adminUser(page)
  await processesMock(page)
  await page.route(`**${SB}/rest/v1/equipment**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([machineRow()]),
  }))

  let maintBody: any = null
  await page.route(`**${SB}/rest/v1/equipment_maintenance**`, async route => {
    if (route.request().method() === 'POST') {
      maintBody = JSON.parse(route.request().postData() || '{}')
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.goto('/machines')
  await page.getByRole('row', { name: /MA001/ }).click()
  await page.getByRole('button', { name: 'Log Maintenance' }).click()

  // Old separate fields should NOT exist
  // (Check by partial matching on the form inputs — there should be only 1 text input besides date/vendor)
  // which is the merged field
  const textInputs = page.locator('#lmf input[type="text"]');
  await expect(textInputs).toHaveCount(1);

  // New merged field should exist
  const mergedField = page.getByLabel('Reviewed & Approved By')
  await expect(mergedField).toBeVisible()
  await mergedField.fill('John Smith')

  await page.getByPlaceholder('Describe work performed...').fill('Routine check')
  await page.getByRole('button', { name: 'Save Log' }).click()

  await expect.poll(() => maintBody?.reviewed_by).toBe('John Smith')
  await expect.poll(() => maintBody?.approved_by).toBe('John Smith')
})
