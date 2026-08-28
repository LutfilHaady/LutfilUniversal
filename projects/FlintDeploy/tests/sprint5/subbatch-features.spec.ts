import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  parentId:  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  parentNum: 'MTC1-20260521-A01',
  subId:     'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  subNum:    'MIXC-20260521-A01-C1',
  matId:     'cccccccc-cccc-cccc-cccc-cccccccccccc',
}

const SUB_BATCH = {
  id:               M.subId,
  batch_number:     M.subNum,
  parent_batch_id:  M.parentId,
  material_id:      M.matId,
  status:           'InProgress',
  current_quantity: 40,
  original_quantity: 40,
  unit:             'kg',
  current_location: 'Store A',
  notes:            'Test notes',
  created_at:       '2026-05-21T08:00:00Z',
  material:         { name: 'Cathode Electrode', code: 'MTC1' },
  parent_batch:     { id: M.parentId, batch_number: M.parentNum },
}

async function setupMocks(page: Page) {
  // Sub-batch detail fetch
  await page.route(`**${SB}/rest/v1/batches*`, async route => {
    const url = route.request().url();
    if (route.request().method() === 'GET') {
      if (url.includes('parent_batch_id=is.null')) {
        // Parent batch detail
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: M.parentId,
            batch_number: M.parentNum,
            material_id: M.matId,
            material: { name: 'Cathode Electrode', code: 'MTC1' },
            status: 'InProgress',
            original_quantity: 100,
            current_quantity: 100,
            unit: 'kg',
            created_at: '2026-05-21T08:00:00Z',
            intake: { supplier_name: 'Test Supplier' }
          }),
        });
      }
      if (url.includes('id=eq.' + M.subId)) {
        // Sub batch detail
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(SUB_BATCH),
        });
      }
      // other GETs (like sub-batches list)
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
    
    // PATCH for edit sub-batch
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }

    return route.continue();
  });

  // processes
  await page.route(`**${SB}/rest/v1/processes*`, async route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'p1', code: 'MIXC', name: 'Mixing (Cathode)', sequence_hint: 1 },
      ]),
    })
  );




  // empty lists for other relations
  const emptyTables = ['mixing_steps', 'batch_status_changes', 'process_runs', 'alerts', 'alert_rules', 'qc_check_results'];
  for (const table of emptyTables) {
    await page.route(`**${SB}/rest/v1/${table}*`, async route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
  }
  
  // RPCs
  await page.route(`**${SB}/rest/v1/rpc/*`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
}

test.describe('E-3: Sub-batch ID Suffix', () => {
  test('Sub-batch preview ID includes material code suffix', async ({ page }) => {
    await setupMocks(page);
    await page.goto(`/batches/${M.parentId}`);
    
    // Open create sub-batch drawer (first match = page-level opener, second = drawer submit)
    await page.getByRole('button', { name: 'Create sub-batch' }).first().click();
    
    // Select process
    await page.getByRole('button', { name: 'Select process step' }).click();
    await page.getByRole('button', { name: 'Mixing (Cathode)' }).click();
    
    // Wait for the preview ID to render, it should end with -C1 (from MTC1)
    await expect(page.getByText(/-AXX-C1$/)).toBeVisible();
  });
});

test.describe('E-5: Engineer-only Edit Sub-batch', () => {
  test('Edit details button opens drawer and allows updating', async ({ page }) => {
    await setupMocks(page);
    await page.goto(`/batches/${M.parentId}/${M.subId}`);
    
    // Click edit details
    await page.getByRole('button', { name: 'Edit details' }).click();
    
    // Ensure drawer is open
    await expect(page.getByRole('heading', { name: 'Edit sub-batch' })).toBeVisible();
    
    // Check initial values are loaded
    await expect(page.getByLabel('Current Quantity')).toHaveValue('40');
    await expect(page.getByLabel('Storage Location')).toHaveValue('Store A');
    await expect(page.getByLabel('Notes')).toHaveValue('Test notes');
    
    // Update values
    await page.getByLabel('Current Quantity').fill('35');
    await page.getByLabel('Storage Location').fill('Store B');
    
    // Capture the PATCH before clicking save
    const patchRequestPromise = page.waitForRequest(
      req => req.url().includes('/rest/v1/batches') && req.method() === 'PATCH'
    );

    // Save
    await page.getByRole('button', { name: 'Save changes' }).click();

    // Wait for the PATCH and verify its body
    const patchReq = await patchRequestPromise;
    const patchPayload = patchReq.postDataJSON();
    expect(patchPayload).toMatchObject({
      current_quantity: 35,
      current_location: 'Store B',
      notes: 'Test notes',
    });
  });
});
