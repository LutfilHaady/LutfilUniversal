import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const PARENT = 'bbbb1111-1111-1111-1111-111111111111'

// One completed first material (MTC1, 5kg) + an active recipe with a 2:8 ratio.
// The next suggested material (MTDW) should be pre-filled with 20kg (5 * 8/2).
test('next material quantity is pre-filled from the ratio plan', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/processes*code=eq*`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'proc-mix', code: 'MIXC' }),
  }))
  await page.route(`**${SB}/rest/v1/recipes**`, route => {
    const url = route.request().url()
    const accept = route.request().headers()['accept'] || ''
    const recipe = { id: 'rec-1', recipe_number: 'RCP-001', version: '1.0',
      params: { mixing_steps: [{ material: 'MTC1', amount_kg: 2 }, { material: 'MTDW', amount_kg: 8 }] } }
    // .single() sends Accept: application/vnd.pgrst.object+json — return object
    if (accept.includes('vnd.pgrst.object') || url.includes('id=eq')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(recipe) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([recipe]) })
  })
  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/qc_check_results**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'qc-done' }]),
  }))
  // First material already logged, carrying recipe_id in its params
  await page.route(`**${SB}/rest/v1/mixing_steps**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{
      id: 'step-1', batch_id: PARENT, step_number: 1, type: 'add_material',
      label: 'Add Cathode Material C1', display_ref: 'x', status: 'completed',
      params: { materialCode: 'MTC1', materialName: 'Cathode Material C1', quantity: 5, unit: 'kg', recipe_id: 'rec-1' },
      operator: 'u1', created_at: '2026-06-18T10:00:00Z', completed_at: null,
    }]),
  }))
  await page.route(`**${SB}/rest/v1/batches**`, route => {
    const url = route.request().url()
    if (url.includes('batch_number=eq')) return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: PARENT, batch_number: 'MIXC-20260618-A01', material_id: 'mat-1' }),
    })
    if (url.includes('parent_batch_id=eq')) return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: 'child-1', batch_number: 'MIXC-20260618-A01-C1', status: 'InProgress' }]),
    })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.goto('/log/mixing/MIXC-20260618-A01')   // exercises MixingWorkspace via wrapper
  await page.getByRole('button', { name: /Add Step/i }).click()

  // Unified form — quantity is pre-filled from ratio plan (no type-choice screen)
  await expect(page.getByPlaceholder('0.0')).toHaveValue('20')
})
