import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const MOCK_MACHINE = {
  id: 'mach-uuid-1',
  equipment_code: 'EQ-001',
  name: 'Mixer Alpha',
  process_id: 'proc-uuid-1',
  supplier_info: 'Supplier Co',
  is_active: true,
  checklist_template: [],
  created_at: '2026-01-01T00:00:00Z',
  process: { name: 'Mixing', code: 'MIXC' },
  equipment_maintenance: [
    {
      id: 'maint-uuid-1',
      equipment_id: 'mach-uuid-1',
      maintenance_date: '2026-06-20',
      next_due_date: '2026-09-20',
      notes: 'Replaced belt',
      reviewed_by: 'Ahmad Rizal',
      approved_by: 'Ahmad Rizal',
      checklist_results: [],
      created_at: '2026-06-20T10:00:00Z',
    },
  ],
}

test.describe('Maintenance history — Reviewed & Approved By (M1)', () => {
  test.beforeEach(async ({ page }) => {
    // Register catch-all first so specific routes registered after take priority (Playwright LIFO)
    await page.route(`**${SB}/rest/v1/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
    await page.route(`**${SB}/rest/v1/equipment**`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_MACHINE]),
      })
    )
  })

  test('Maintenance history entry shows Reviewed & Approved By value', async ({ page }) => {
    await page.goto('/machines')
    // Expand the machine row
    await page.getByText('EQ-001').click()
    await expect(page.getByText('Reviewed & Approved By', { exact: true })).toBeVisible()
    await expect(page.getByText('Ahmad Rizal').first()).toBeVisible()
  })

  test('Maintenance history entry without reviewer shows no reviewer line', async ({ page }) => {
    // Override with a machine that has no reviewer
    await page.route(`**${SB}/rest/v1/equipment**`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          ...MOCK_MACHINE,
          equipment_maintenance: [{
            ...MOCK_MACHINE.equipment_maintenance[0],
            reviewed_by: null,
            approved_by: null,
          }],
        }]),
      })
    )
    await page.goto('/machines')
    await page.getByText('EQ-001').click()
    await expect(page.getByText('Reviewed & Approved By', { exact: true })).not.toBeVisible()
  })
})
