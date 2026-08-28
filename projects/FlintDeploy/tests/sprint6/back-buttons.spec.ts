import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

test('Batch detail has back button to /batches', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/batches*id=eq*`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'b1', batch_number: 'MIXC-20260618-A01', status: 'InProgress',
      material_id: 'm1', current_quantity: 100, original_quantity: 100, unit: 'kg',
      parent_batch_id: null, current_location: null, created_at: '2026-06-18',
      expiry_date: null,
      material: { code: 'MTC1', name: 'Material C1', type: 'Cathode Electrode' },
      batch_raw_material_intake: [], batch_status_changes: [],
    }),
  }))
  await page.route(`**${SB}/rest/v1/batches*parent_batch_id*`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/process_runs**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/alerts**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/alert_rules**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  for (const t of ['qc_check_results', 'equipment_maintenance']) {
    await page.route(`**${SB}/rest/v1/${t}**`, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([]),
    }))
  }

  await page.goto('/batches/b1')
  const backLink = page.getByRole('link', { name: /back to batches/i })
  await expect(backLink).toBeVisible()
  await expect(backLink).toHaveAttribute('href', '/batches')
})

test('Sub-batch detail has back button to parent batch', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/batches*id=eq*`, route => {
    const url = route.request().url()
    if (url.includes('id=eq.sb1')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: 'sb1', batch_number: 'MIXC-20260618-A01-01', status: 'InProgress',
          material_id: 'm1', current_quantity: 50, original_quantity: 50, unit: 'kg',
          parent_batch_id: 'b1', current_location: null, created_at: '2026-06-18',
          parent_batch: { batch_number: 'MIXC-20260618-A01' },
        }),
      })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: 'b1', batch_number: 'MIXC-20260618-A01', status: 'InProgress',
        material_id: 'm1', current_quantity: 100, original_quantity: 100, unit: 'kg',
        parent_batch_id: null, current_location: null, created_at: '2026-06-18',
      }),
    })
  })
  await page.route(`**${SB}/rest/v1/mixing_steps**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/process_runs**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/qc_check_results**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/rpc/trace_batch_genealogy**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/processes**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/materials**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/alerts**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/alert_rules**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/equipment_maintenance**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))

  await page.goto('/batches/b1/sb1')
  const backLink = page.getByRole('link', { name: /back to/i })
  await expect(backLink).toBeVisible()
  await expect(backLink).toHaveAttribute('href', '/batches/b1')
})

test('Lot detail has back button to /lots', async ({ page }) => {
  await page.route(`**${SB}/rest/v1/lots**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'lot-1', lot_number: 'LOT-001', status: 'Active',
      category: 'Cell', unit_count: 5, created_at: '2026-06-18',
      units: [], lot_sub_batches: [],
    }),
  }))
  await page.route(`**${SB}/rest/v1/alerts**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  await page.route(`**${SB}/rest/v1/alert_rules**`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }))
  for (const t of ['qc_check_results', 'equipment_maintenance', 'batches']) {
    await page.route(`**${SB}/rest/v1/${t}**`, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([]),
    }))
  }

  await page.goto('/lots/lot-1')
  const backLink = page.getByRole('link', { name: /back to lots/i })
  await expect(backLink).toBeVisible()
  await expect(backLink).toHaveAttribute('href', '/lots')
})
