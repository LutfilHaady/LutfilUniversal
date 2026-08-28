/**
 * Maintenance checklist feature (machines page) — client-spec checklist.
 *
 * Covers:
 *  - Add Equipment panel: Admin can add/remove checklist task names; the
 *    equipment INSERT carries checklist_template.
 *  - Log Maintenance panel: renders a Task/Done/Remarks table from the machine's
 *    checklist_template; Y/N toggle + remarks persist into checklist_results on
 *    the equipment_maintenance INSERT.
 *  - Machines page: expanded maintenance log renders saved checklist_results.
 *
 * All Supabase REST calls are mocked. The machines panels are Admin-gated, so we
 * stub the /rest/v1/users lookup to return an Admin role for the signed-in id
 * (same pattern as machines-toggle-delete.spec.ts).
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const EQ_ID = '22222222-2222-2222-2222-222222222222'

async function adminUser(page: Page) {
  await page.route(`**${SB}/rest/v1/users**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ full_name: 'Dev Admin', role_id: 'r-admin', roles: { name: 'Admin' } }),
  }))
}

async function processesMock(page: Page) {
  await page.route(`**${SB}/rest/v1/processes**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: 'p1', name: 'Mixing (Cathode)' }]),
  }))
}

function machineRow(extra: Record<string, unknown> = {}) {
  return {
    id: EQ_ID, equipment_code: 'MA001', name: '60L Mixer', process_id: 'p1',
    supplier_info: null, is_active: true, created_at: '2026-06-05',
    checklist_template: ['Mixing Blade Inspection', 'Seal Check', 'Speed Calibration'],
    process: { name: 'Mixing (Cathode)', code: 'MIXC' }, equipment_maintenance: [],
    ...extra,
  }
}

test('Add Equipment: checklist tasks can be added/removed and POST carries checklist_template', async ({ page }) => {
  await adminUser(page)
  await processesMock(page)

  let postBody: any = null
  await page.route(`**${SB}/rest/v1/equipment**`, async route => {
    if (route.request().method() === 'POST') {
      postBody = JSON.parse(route.request().postData() || '{}')
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ ...machineRow(), checklist_template: postBody.checklist_template ?? [] }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.goto('/machines')
  await page.getByRole('button', { name: /Add Equipment/ }).click()

  await page.getByPlaceholder('e.g. MIX-02').fill('MA099')
  await page.getByPlaceholder('e.g. Mixer B').fill('Test Mixer')
  await page.locator('#aef select').selectOption('p1')

  // Add two checklist tasks (one via Enter, one via the + button), then remove one.
  const taskInput = page.getByPlaceholder('e.g. Rail Lubrication')
  await taskInput.fill('Blade Inspection')
  await taskInput.press('Enter')
  await taskInput.fill('Seal Check')
  await page.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByText('Blade Inspection')).toBeVisible()
  await expect(page.getByText('Seal Check')).toBeVisible()

  await page.getByRole('button', { name: 'Remove Seal Check' }).click()
  await expect(page.getByText('Seal Check')).toHaveCount(0)

  await page.getByRole('button', { name: 'Add Equipment', exact: true }).click()
  await expect.poll(() => postBody?.checklist_template).toEqual(['Blade Inspection'])
})

test('Log Maintenance: renders checklist from template and saves checklist_results', async ({ page }) => {
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
  await page.getByRole('row', { name: /MA001/ }).click()       // expand
  await page.getByRole('button', { name: 'Log Maintenance' }).click()

  // Checklist tasks from the template render
  await expect(page.getByText('Mixing Blade Inspection')).toBeVisible()
  await expect(page.getByText('Speed Calibration')).toBeVisible()

  // Mark the first task done and add a remark
  await page.getByRole('button', { name: /Mixing Blade Inspection (done|not done)/ }).click()
  await page.locator('#lmf input[type="text"]').first().fill('OK — no wear')

  await page.getByPlaceholder('Describe work performed...').fill('Routine service')
  await page.getByRole('button', { name: 'Save Log' }).click()

  await expect.poll(() => maintBody?.checklist_results?.length).toBe(3)
  await expect.poll(() => maintBody?.checklist_results?.[0]).toEqual({
    task: 'Mixing Blade Inspection', completed: true, remarks: 'OK — no wear',
  })
})

test('Machines page: expanded log renders saved checklist_results', async ({ page }) => {
  await adminUser(page)

  const withResults = machineRow({
    equipment_maintenance: [{
      id: 'm1', equipment_id: EQ_ID, maintenance_date: '2026-06-05',
      next_due_date: '2026-07-05', notes: 'Quarterly service',
      checklist_results: [
        { task: 'Mixing Blade Inspection', completed: true, remarks: 'Clean' },
        { task: 'Seal Check', completed: false, remarks: 'Replace soon' },
      ],
      created_at: '2026-06-05T00:00:00Z',
    }],
  })

  await page.route(`**${SB}/rest/v1/equipment**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([withResults]),
  }))

  await page.goto('/machines')
  await page.getByRole('row', { name: /MA001/ }).click()  // expand

  await expect(page.getByText('Quarterly service')).toBeVisible()
  await expect(page.getByText('Mixing Blade Inspection')).toBeVisible()
  await expect(page.getByText('Clean')).toBeVisible()
  await expect(page.getByText('Replace soon')).toBeVisible()
})
