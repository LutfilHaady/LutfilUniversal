import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

test('batchNumber param auto-resolves the batch and reveals process steps inline', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route(`**${SB}/rest/v1/users**`, route => route.continue())
  await page.route(`**${SB}/rest/v1/batches**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: 'b-1', batch_number: 'MTC1-20260521-A20', material_id: 'm-1' }),
    }),
  )
  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { process_id: 'p-mixc', code: 'MIXC', name: 'Mixing (Cathode)', sequence_hint: 1, requires_calibration: false },
      ]),
    }),
  )

  await page.goto('/log/process-step?batchNumber=MTC1-20260521-A20')
  // Section 1 auto-resolves and collapses to the batch summary.
  await expect(page.getByText('MTC1-20260521-A20').first()).toBeVisible({ timeout: 5000 })
  // Section 2 reveals process step dropdown inline — no wizard step title.
  const stepSelect = page.getByTestId('process-step-select')
  await expect(stepSelect).toBeVisible({ timeout: 5000 })
})
