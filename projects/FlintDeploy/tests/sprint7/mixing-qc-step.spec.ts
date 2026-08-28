import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const PARENT_UUID = 'aaa11111-1111-1111-1111-111111111111'

async function setupMocks(page: import('@playwright/test').Page) {
  await page.route(`**${SB}/rest/v1/processes*code=eq*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: 'proc-mix', code: 'MIXC' }),
  }))

  await page.route(`**${SB}/rest/v1/recipes**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      {
        id: 'qc-def-1', qc_item_name: 'Homogeneity', method: 'VisualManual',
        timing: 'EndOfRun', acceptance_criteria_text: 'No visible lumps',
        acceptance_criteria_min: null, acceptance_criteria_max: null,
      },
      {
        id: 'qc-def-2', qc_item_name: 'Particle Size', method: 'ToolEquipment',
        timing: 'EndOfRun', acceptance_criteria_text: '< 50',
        acceptance_criteria_min: null, acceptance_criteria_max: 50,
      },
    ]),
  }))

  await page.route(`**${SB}/rest/v1/qc_check_results**`, route => {
    if (route.request().method() === 'POST')
      return route.fulfill({ status: 201, body: '' })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route(`**${SB}/rest/v1/mixing_steps**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  await page.route(`**${SB}/rest/v1/batches**`, route => {
    if (route.request().url().includes('batch_number=eq'))
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: PARENT_UUID, batch_number: 'MIXC-20260618-A01', material_id: 'mat-1' }),
      })
    if (route.request().url().includes('parent_batch_id=eq'))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })
}

test('QC Check step option appears in Add Step modal', async ({ page }) => {
  await setupMocks(page)
  await page.goto('/log/mixing/MIXC-20260618-A01')
  await page.getByRole('button', { name: /Add Step/i }).click()

  await expect(page.getByText('QC Check').first()).toBeVisible()
  await expect(page.getByText('Homogeneity')).toBeVisible()
  await expect(page.getByText('Particle Size')).toBeVisible()
})

test('Submitting QC Check calls log_mixing_step with qc_check type', async ({ page }) => {
  await setupMocks(page)

  let rpcBody: Record<string, unknown> | null = null
  await page.route(`**${SB}/rest/v1/rpc/log_mixing_step**`, route => {
    rpcBody = JSON.parse(route.request().postData() || '{}')
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: 'step-qc-1', batch_id: PARENT_UUID, step_number: 1,
        type: 'qc_check', label: 'QC Check',
        display_ref: 'MIXC-20260618-A01 / QC Check · Step 01',
        status: 'completed', params: {},
        operator: 'u1', created_at: '2026-06-18T10:00:00Z', completed_at: null,
      }),
    })
  })

  await page.goto('/log/mixing/MIXC-20260618-A01')
  await page.getByRole('button', { name: /Add Step/i }).click()

  // Fill QC Check — click Pass for the VisualManual check
  const passButtons = page.getByRole('button', { name: 'Pass' })
  await passButtons.first().click()

  // Fill numeric check
  await page.getByPlaceholder('Enter measured value').fill('30')

  // Submit
  await page.getByRole('button', { name: /Log Step/i }).click()

  await expect.poll(() => rpcBody?.p_type, { timeout: 10000 }).toBe('qc_check')
})

test('QC check step renders in step timeline', async ({ page }) => {
  await setupMocks(page)

  // Override mixing_steps to include a completed qc_check step
  await page.route(`**${SB}/rest/v1/mixing_steps**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{
      id: 'step-qc-1', batch_id: PARENT_UUID, step_number: 1, type: 'qc_check',
      label: 'QC Check', display_ref: 'MIXC-20260618-A01 / QC Check · Step 01',
      status: 'completed', params: { checks: [
        { itemName: 'Homogeneity', passed: true },
        { itemName: 'Particle Size', passed: true },
      ] },
      operator: 'u1', created_at: '2026-06-18T10:00:00Z', completed_at: '2026-06-18T10:05:00Z',
    }]),
  }))

  await page.goto('/log/mixing/MIXC-20260618-A01')

  await expect(page.getByText('QC Check')).toBeVisible()
  await expect(page.getByText('2 checks')).toBeVisible()
})
