/**
 * Register-batch lab QC gate (components/batches/create-batch-modal.tsx)
 *
 * Client request: add a "QC Approved from Lab? (Y/N)" control to the register-
 * batch form. If not approved, the batch must register On Hold (a sample is
 * pulled from the bulk material for the lab to clear before it goes live).
 *
 * Tests cover:
 *  - The toggle renders, defaults to "No", and shows the On-Hold hint
 *  - Flipping to "Yes" swaps the hint to the In-Progress wording
 *  - Default (No) submit → batches INSERT carries status 'OnHold'
 *  - Approved (Yes) submit → batches INSERT carries status 'InProgress'
 *
 * All Supabase REST calls are mocked at the network layer (stateless, no call
 * counters). /rest/v1/users is left real so the auth context resolves the role.
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const MATERIALS = [
  { id: 'mat-mtc1', code: 'MTC1', name: 'Cathode Material C1' },
]

// Captures the status sent on the batches INSERT so each test can assert it.
async function setupMocks(page: Page, captured: { status?: string }) {
  await page.route(`**${SB}/rest/v1/materials**`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MATERIALS) }),
  )

  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const method = route.request().method()
    const url = route.request().url()
    if (method === 'POST') {
      const body = route.request().postDataJSON() as { status?: string }
      captured.status = body?.status
      return route.fulfill({ status: 201, body: '' })
    }
    // Post-insert lookup: .eq('batch_number', …).single() → object
    if (url.includes('batch_number=eq')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'new-batch-id',
          batch_number: 'MTC1-PLACEHOLDER',
          created_at: '2026-06-08T08:00:00Z',
        }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.route(`**${SB}/rest/v1/batch_raw_material_intake**`, async route =>
    route.fulfill({ status: 201, body: '' }),
  )
  await page.route(`**${SB}/rest/v1/batch_status_changes**`, async route =>
    route.fulfill({ status: 201, body: '' }),
  )
}

async function openModalAndFill(page: Page) {
  await page.goto('/batches')
  await page.getByRole('button', { name: 'New Batch' }).click()

  // Default category is Cathode Electrode → MTC1 is offered. Pick it, fill the
  // required Supplier + quantity (Supplier is a required field — native
  // validation blocks submit otherwise).
  await page.getByRole('button', { name: /Cathode Material C1/ }).click()
  await page.getByPlaceholder('e.g. Targray Industries').fill('Targray Industries')
  await page.getByPlaceholder('0.0').fill('12.5')
}

test.describe('Register batch — lab QC gate', () => {
  test('toggle renders, defaults to No, and shows the On-Hold hint', async ({ page }) => {
    await setupMocks(page, {})
    await page.goto('/batches')
    await page.getByRole('button', { name: 'New Batch' }).click()

    await expect(page.getByText('QC Approved from Lab?')).toBeVisible()
    await expect(
      page.getByText('Batch will be placed On Hold until the lab clears the sample.'),
    ).toBeVisible()
  })

  test('flipping to Yes swaps the hint to In-Progress wording', async ({ page }) => {
    await setupMocks(page, {})
    await page.goto('/batches')
    await page.getByRole('button', { name: 'New Batch' }).click()

    await page.getByRole('button', { name: 'Yes', exact: true }).click()
    await expect(page.getByText('Batch will register as In Progress.')).toBeVisible()
  })

  test('default (No) submit registers the batch On Hold', async ({ page }) => {
    const captured: { status?: string } = {}
    await setupMocks(page, captured)
    await openModalAndFill(page)

    await page.getByRole('button', { name: 'Create Batch' }).click()
    await expect(page.getByText('Batch registered')).toBeVisible()
    expect(captured.status).toBe('OnHold')
  })

  test('approved (Yes) submit registers the batch In Progress', async ({ page }) => {
    const captured: { status?: string } = {}
    await setupMocks(page, captured)
    await openModalAndFill(page)

    await page.getByRole('button', { name: 'Yes', exact: true }).click()
    await page.getByRole('button', { name: 'Create Batch' }).click()
    await expect(page.getByText('Batch registered')).toBeVisible()
    expect(captured.status).toBe('InProgress')
  })
})
