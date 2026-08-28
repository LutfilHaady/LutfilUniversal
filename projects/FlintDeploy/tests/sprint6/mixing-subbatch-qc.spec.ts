import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const PARENT_UUID = 'bbbb1111-1111-1111-1111-111111111111'
const CHILD_UUID  = 'cccc2222-2222-2222-2222-222222222222'

async function setupBaseMocks(page: import('@playwright/test').Page) {
  // Process lookup by code
  await page.route(`**${SB}/rest/v1/processes*code=eq*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'proc-mix', code: 'MIXC' }),
  }))

  // Recipes (for ratio calculator)
  await page.route(`**${SB}/rest/v1/recipes**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  // QC check results
  await page.route(`**${SB}/rest/v1/qc_check_results**`, route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  // QC check definitions for mixing process
  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      { id: 'qc1', qc_item_name: 'Homogeneity', method: 'VisualManual', timing: 'EndOfRun', acceptance_criteria_text: 'No visible lumps' },
    ]),
  }))
}

test('Add Material step creates a child batch and shows QC gate', async ({ page }) => {
  await setupBaseMocks(page)

  // Mixing steps — start empty
  await page.route(`**${SB}/rest/v1/mixing_steps**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  // Single unified handler for ALL /rest/v1/batches requests
  let batchInsertBody: Record<string, unknown> | null = null
  await page.route(`**${SB}/rest/v1/batches**`, route => {
    const url = route.request().url()
    const method = route.request().method()

    // POST — child batch creation
    if (method === 'POST') {
      batchInsertBody = JSON.parse(route.request().postData() || '{}')
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: CHILD_UUID, batch_number: 'MIXC-20260618-A01-C1' }),
      })
    }

    // GET with batch_number filter — initial batch lookup
    if (url.includes('batch_number=eq')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: PARENT_UUID, batch_number: 'MIXC-20260618-A01', material_id: 'mat-1' }),
      })
    }

    // GET with parent_batch_id filter — child batches (initially none)
    if (url.includes('parent_batch_id=eq')) {
      return route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify([]),
      })
    }

    // Default GET
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  // Mock the log_mixing_step RPC
  await page.route(`**${SB}/rest/v1/rpc/log_mixing_step**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'step-1', batch_id: PARENT_UUID, step_number: 1, type: 'add_material',
      label: 'Add Cathode Material C1', display_ref: 'MIXC-20260618-A01 / Add Material · Step 01',
      status: 'completed', params: { materialCode: 'MTC1', materialName: 'Cathode Material C1', quantity: 5, unit: 'kg' },
      operator: 'u1', created_at: '2026-06-18T10:00:00Z', completed_at: null,
    }),
  }))

  await page.goto('/log/mixing/MIXC-20260618-A01')
  await page.getByRole('button', { name: /Add Step/i }).click()

  // Unified form — fill material fields directly (no type-choice screen)
  await page.locator('select').first().selectOption('MTC1')
  await page.getByPlaceholder('0.0').fill('5')
  await page.getByRole('button', { name: /Log Step/i }).click()

  // Wait for the child batch insert
  await expect.poll(() => batchInsertBody?.batch_number, { timeout: 10000 }).toMatch(/MIXC.*-C1/)
  await expect.poll(() => batchInsertBody?.parent_batch_id).toBe(PARENT_UUID)

  // QC gate should appear
  await expect(page.getByText('QC Check', { exact: true })).toBeVisible()
  await expect(page.getByText('Homogeneity')).toBeVisible()
})

test('QC gate blocks Add Step button until completed', async ({ page }) => {
  await setupBaseMocks(page)

  // Mixing steps with one completed add_material step
  await page.route(`**${SB}/rest/v1/mixing_steps**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{
      id: 'step-1', batch_id: PARENT_UUID, step_number: 1, type: 'add_material',
      label: 'Add Cathode Material C1', display_ref: 'MIXC-20260618-A01 / Add Material · Step 01',
      status: 'completed', params: { materialCode: 'MTC1', materialName: 'Cathode Material C1', quantity: 5, unit: 'kg' },
      operator: 'u1', created_at: '2026-06-18T10:00:00Z', completed_at: null,
    }]),
  }))

  // Batches handler — child batch exists, no QC results
  await page.route(`**${SB}/rest/v1/batches**`, route => {
    const url = route.request().url()
    if (url.includes('batch_number=eq')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: PARENT_UUID, batch_number: 'MIXC-20260618-A01', material_id: 'mat-1' }),
      })
    }
    if (url.includes('parent_batch_id=eq')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ id: CHILD_UUID, batch_number: 'MIXC-20260618-A01-C1', status: 'InProgress' }]),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.goto('/log/mixing/MIXC-20260618-A01')

  // The QC gate should be showing
  await expect(page.getByText('QC Check', { exact: true })).toBeVisible()

  // Add Step button should be disabled while QC is pending
  const addStepBtn = page.getByRole('button', { name: /Add Step/i })
  await expect(addStepBtn).toBeDisabled()

  // Hint text about QC pending
  await expect(page.getByText(/Complete QC check/i)).toBeVisible()
})
