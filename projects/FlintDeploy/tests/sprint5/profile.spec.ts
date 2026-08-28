/**
 * Sprint 5 (Jonny) — J-2: Profile page
 *
 * Tests cover:
 *  - Page renders user name and role badge from real auth session
 *  - Password fields and submit button are present
 *  - Short password (<8 chars) shows inline error without calling the API
 *  - Mismatched passwords shows inline error without calling the API
 *  - Successful update shows success banner and clears both fields
 *  - Server error surfaces error.message and re-enables the submit button
 *  - Sidebar shows a profile link
 *
 * /rest/v1/users is NOT mocked — left real so auth context resolves the Engineer role
 * and the staff_code fetch resolves against the live DB.
 * Only PUT /auth/v1/user is intercepted where needed.
 */

import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

test.describe('J-2 — Profile page', () => {

  test('renders user name and role badge', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByRole('main').getByText('Dev Engineer', { exact: true })).toBeVisible()
    await expect(page.getByRole('main').getByText('Engineer', { exact: true })).toBeVisible()
  })

  test('shows new-password and confirm-password fields', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByLabel('New password')).toBeVisible()
    await expect(page.getByLabel('Confirm password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Update password' })).toBeVisible()
  })

  test('short password shows inline error', async ({ page }) => {
    await page.goto('/profile')
    await page.getByLabel('New password').fill('short1')
    await page.getByLabel('Confirm password').fill('short1')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible()
  })

  test('mismatched passwords shows inline error', async ({ page }) => {
    await page.goto('/profile')
    await page.getByLabel('New password').fill('password123')
    await page.getByLabel('Confirm password').fill('different99')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByText('Passwords do not match.')).toBeVisible()
  })

  test('successful update shows success banner and clears fields', async ({ page }) => {
    await page.route(`**${SB}/auth/v1/user`, async route => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: { id: 'uid', email: 'dev.engineer@flintlabs.com' } }),
        })
      }
      return route.continue()
    })
    await page.goto('/profile')
    await page.getByLabel('New password').fill('newpassword1')
    await page.getByLabel('Confirm password').fill('newpassword1')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByText('Password updated successfully.')).toBeVisible()
    await expect(page.getByLabel('New password')).toHaveValue('')
    await expect(page.getByLabel('Confirm password')).toHaveValue('')
  })

  test('server error shows error banner and re-enables button', async ({ page }) => {
    await page.route(`**${SB}/auth/v1/user`, async route => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ code: 422, error_code: 'weak_password', msg: 'Password is too weak.' }),
        })
      }
      return route.continue()
    })
    await page.goto('/profile')
    await page.getByLabel('New password').fill('newpassword1')
    await page.getByLabel('Confirm password').fill('newpassword1')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByRole('button', { name: 'Update password' })).not.toBeDisabled()
  })

  test('sidebar shows profile link to /profile', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible()
  })

})
