import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

test.use({ storageState: 'tests/.auth/admin.json' })

const ROLES = [
  { id: 'r-admin', name: 'Admin' },
  { id: 'r-eng', name: 'Engineer' },
  { id: 'r-op', name: 'Operator' },
]

const USER_ROWS = [
  { id: 'u1', full_name: 'Alice Tan', staff_code: 'S001', role_id: 'r-eng', is_active: true, roles: { name: 'Engineer' } },
  { id: 'u2', full_name: 'Bob Lee', staff_code: 'S002', role_id: 'r-op', is_active: true, roles: { name: 'Operator' } },
]

async function setupMocks(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/users*order=full_name*`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(USER_ROWS),
  }))
  await page.route(`**${SB}/rest/v1/roles**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(ROLES),
  }))
  for (const t of ['alerts', 'alert_rules', 'qc_check_results', 'equipment_maintenance', 'batches']) {
    await page.route(`**${SB}/rest/v1/${t}**`, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([]),
    }))
  }
}

test('Reset password modal opens and shows validation error for short password', async ({ page }) => {
  await setupMocks(page)

  await page.goto('/admin')

  // Click reset password button for Alice
  await page.getByRole('row', { name: /Alice Tan/ }).getByRole('button', { name: /Reset Password/i }).click()

  // Modal should appear with correct user name
  await expect(page.getByText(/Reset password for Alice Tan/i)).toBeVisible()

  // New Password field should be present
  const pwInput = page.getByLabel('New Password')
  await expect(pwInput).toBeVisible()

  // Short password triggers client-side validation
  await pwInput.fill('123')
  await page.getByRole('button', { name: /Confirm Reset/i }).click()
  await expect(page.getByText(/at least 8 characters/i)).toBeVisible()

  // Clear and enter valid-length password — Confirm Reset should be enabled
  await pwInput.fill('newpass123')
  const confirmBtn = page.getByRole('button', { name: /Confirm Reset/i })
  await expect(confirmBtn).toBeEnabled()

  // Cancel closes the modal
  await page.getByRole('button', { name: /Cancel/i }).click()
  await expect(page.getByText(/Reset password for Alice Tan/i)).toBeHidden()
})

test('Reset password Confirm button is disabled when password field is empty', async ({ page }) => {
  await setupMocks(page)

  await page.goto('/admin')

  await page.getByRole('row', { name: /Bob Lee/ }).getByRole('button', { name: /Reset Password/i }).click()
  await expect(page.getByText(/Reset password for Bob Lee/i)).toBeVisible()

  // Confirm button should be disabled with empty password
  const confirmBtn = page.getByRole('button', { name: /Confirm Reset/i })
  await expect(confirmBtn).toBeDisabled()
})
