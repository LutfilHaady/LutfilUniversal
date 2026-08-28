/**
 * Sprint 5 (Jonny) — J-3: Passcode walkthrough modal
 *
 * Tests cover the 4-step modal flow triggered from the Profile page:
 *  - "Start walkthrough" button visible on profile page
 *  - Opening shows intro step with "Set your login passcode" heading
 *  - "Get started" advances to enter step (passcode input visible)
 *  - Short passcode (<8 chars) shows inline error and stays on step 2
 *  - Valid passcode advances to confirm step
 *  - Mismatched confirm shows inline error and stays on step 3
 *  - Completing the full flow calls supabase.auth.updateUser and shows success
 *  - "Return to profile" closes the modal (success screen no longer visible)
 *
 * /rest/v1/users is NOT mocked — left real so auth context resolves correctly.
 * PUT /auth/v1/user is intercepted for submit tests.
 */

import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

test.describe('J-3 — Passcode walkthrough', () => {

  test('"Start walkthrough" button is visible on the profile page', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByRole('button', { name: /Start walkthrough/i })).toBeVisible()
  })

  test('opening walkthrough shows step 1 intro', async ({ page }) => {
    await page.goto('/profile')
    await page.getByRole('button', { name: /Start walkthrough/i }).click()
    await expect(page.getByText('Set your login passcode', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
  })

  test('step 1 → 2: Get started shows passcode input', async ({ page }) => {
    await page.goto('/profile')
    await page.getByRole('button', { name: /Start walkthrough/i }).click()
    await page.getByRole('button', { name: 'Get started' }).click()
    await expect(page.getByLabel('New passcode')).toBeVisible()
  })

  test('step 2: short passcode shows error', async ({ page }) => {
    await page.goto('/profile')
    await page.getByRole('button', { name: /Start walkthrough/i }).click()
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.getByLabel('New passcode').fill('short')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText('Passcode must be at least 8 characters.')).toBeVisible()
  })

  test('step 2 → 3: valid passcode shows confirm input', async ({ page }) => {
    await page.goto('/profile')
    await page.getByRole('button', { name: /Start walkthrough/i }).click()
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.getByLabel('New passcode').fill('validpass1')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByLabel('Confirm passcode')).toBeVisible()
  })

  test('step 3: mismatched confirm shows error', async ({ page }) => {
    await page.goto('/profile')
    await page.getByRole('button', { name: /Start walkthrough/i }).click()
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.getByLabel('New passcode').fill('validpass1')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByLabel('Confirm passcode').fill('wrongpass1')
    await page.getByRole('button', { name: 'Set passcode' }).click()
    await expect(page.getByText('Passcodes do not match.')).toBeVisible()
  })

  test('completing the full flow shows success screen', async ({ page }) => {
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
    await page.getByRole('button', { name: /Start walkthrough/i }).click()
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.getByLabel('New passcode').fill('validpass1')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByLabel('Confirm passcode').fill('validpass1')
    await page.getByRole('button', { name: 'Set passcode' }).click()
    await expect(page.getByText('Passcode set!')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Return to profile' })).toBeVisible()
  })

  test('"Return to profile" button closes the walkthrough', async ({ page }) => {
    await page.route(`**${SB}/auth/v1/user`, async route => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      }
      return route.continue()
    })
    await page.goto('/profile')
    await page.getByRole('button', { name: /Start walkthrough/i }).click()
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.getByLabel('New passcode').fill('validpass1')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByLabel('Confirm passcode').fill('validpass1')
    await page.getByRole('button', { name: 'Set passcode' }).click()
    await page.getByRole('button', { name: 'Return to profile' }).click()
    await expect(page.getByText('Passcode set!')).not.toBeVisible()
  })

})
