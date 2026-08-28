/**
 * Sprint 3 end-to-end workflows — sub-batch navigation, process timeline, and
 * the process-step logging wizard.
 *
 * History: these tests originally drove the **live** database (no mocks) by
 * clicking the *first* batch in whatever data happened to be live. That made
 * them order- and data-dependent — e.g. "Process Timeline Rendering" went red
 * once the first sub-batch in the live DB became a MIXC/MIXE batch (which
 * renders the Mixing Steps panel, not the Process Timeline). It also violated
 * the project rule that automated tests never touch the real DB.
 *
 * This rewrite mocks every Supabase REST + RPC call (stateless, keyed on the
 * request URL — no call counters) and navigates with fixed IDs, so the suite
 * is deterministic and independent of live data. `/rest/v1/users` is left real
 * so the auth context resolves the Engineer role.
 *
 * The former test #1 (Dashboard KPI Verification) is dropped here — it's fully
 * and deterministically covered by tests/sprint3/dashboard-kpis.spec.ts.
 */

import { test, expect, type Page } from '@playwright/test';

const SB = 'https://pewrwrqituidyxhfsner.supabase.co';

// Fixed fixtures — a non-mixing (CTGC) sub-batch under one parent.
const F = {
  parentId:  '11111111-1111-1111-1111-111111111111',
  parentNum: 'MTC1-20260608-A01',
  subId:     '22222222-2222-2222-2222-222222222222',
  subNum:    'CTGC-20260608-A01-01',
  matId:     '33333333-3333-3333-3333-333333333333',
  procId:    '44444444-4444-4444-4444-444444444444',
  runId:     '55555555-5555-5555-5555-555555555555',
};

const NOW = new Date().toISOString();

const PARENT_OBJ = {
  id: F.parentId, batch_number: F.parentNum, parent_batch_id: null,
  material_id: F.matId, status: 'InProgress',
  current_quantity: 100, original_quantity: 100, unit: 'kg',
  current_location: 'Shelf A1', created_at: NOW, updated_at: NOW,
  expiry_date: null, notes: null,
  material: { name: 'Cathode Electrode', code: 'MTC1' },
  parent_batch: null,
  intake: [],
};

const SUB_OBJ = {
  id: F.subId, batch_number: F.subNum, parent_batch_id: F.parentId,
  material_id: F.matId, status: 'InProgress',
  current_quantity: 40, original_quantity: 40, unit: 'kg',
  current_location: null, created_at: NOW, updated_at: NOW, notes: null,
  material: { name: 'Cathode Electrode', code: 'MTC1' },
  parent_batch: { id: F.parentId, batch_number: F.parentNum },
};

// Sub-batch row as the main-detail page selects it (no joins).
const SUB_ROW = {
  id: F.subId, batch_number: F.subNum, status: 'InProgress',
  current_quantity: 40, original_quantity: 40, unit: 'kg', current_location: null,
};

const PROCESS_STEPS = [
  { process_id: F.procId, code: 'CTGC', name: 'Coating & Oven Drying', sequence_hint: 2, requires_calibration: false },
];

const PROCESSES = [
  { code: 'CTGC', name: 'Coating & Oven Drying' },
  { code: 'MIXC', name: 'Mixing (Cathode)' },
];

const GENEALOGY = [
  { id: F.subId, batch_number: F.subNum, parent_batch_id: F.parentId, material_id: F.matId,
    status: 'InProgress', current_quantity: 40, unit: 'kg', depth: 0, direction: 'self' },
];

// One completed process run so the timeline has an expandable entry.
const TIMELINE_RUN = [
  {
    id: F.runId, output_batch_id: F.subId, process_id: F.procId, status: 'Passed',
    start_date: '2026-06-08', start_time: '08:00:00', end_date: '2026-06-08', end_time: '08:30:00',
    process: { name: 'Coating & Oven Drying', code: 'CTGC' },
    operator: { full_name: 'Dev Engineer' },
    equipment: null,
    process_run_parameters: [],
    process_run_inputs: [],
  },
];

function json(route: import('@playwright/test').Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/**
 * One handler for every Supabase REST + RPC call the exercised pages make.
 * Discriminates by table + URL filters; leaves /rest/v1/users real.
 */
async function setupMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/**`, async (route) => {
    const req = route.request();
    const method = req.method();
    const url = decodeURIComponent(req.url());

    // Let the auth context resolve the real role.
    if (url.includes('/rest/v1/users')) return route.continue();

    // RPCs (POST /rest/v1/rpc/<fn>)
    if (url.includes('/rpc/get_process_route'))    return json(route, PROCESS_STEPS);
    if (url.includes('/rpc/trace_batch_genealogy')) return json(route, GENEALOGY);
    if (url.includes('/rpc/'))                      return json(route, []);

    // Writes — acknowledge without persisting.
    if (method !== 'GET') {
      return route.fulfill({ status: method === 'POST' ? 201 : 204, body: '' });
    }

    // GET reads
    if (url.includes('/rest/v1/batches')) {
      if (url.includes('batch_number=eq'))        return json(route, SUB_OBJ);   // manual QR lookup (.single)
      if (url.includes('parent_batch_id=eq'))     return json(route, [SUB_ROW]); // main-detail sub list
      if (url.includes('parent_batch_id=not.is.null')) return json(route, []);   // dashboard sub-batches
      if (url.includes('id=eq.')) {                                              // useBatch / autoLookup (.single / .maybeSingle)
        const id = url.match(/id=eq\.([0-9a-f-]+)/i)?.[1];
        return json(route, id === F.subId ? SUB_OBJ : id === F.parentId ? PARENT_OBJ : null);
      }
      if (url.includes('parent_batch_id=is.null')) return json(route, [PARENT_OBJ]); // batches list
      return json(route, []);
    }

    if (url.includes('/rest/v1/materials'))  return json(route, [{ id: F.matId, name: 'Cathode Electrode', code: 'MTC1' }]);
    if (url.includes('/rest/v1/processes'))  return json(route, PROCESSES);
    if (url.includes('/rest/v1/process_runs')) {
      return json(route, url.includes('output_batch_id=eq') ? TIMELINE_RUN : []);
    }

    // Everything else the pages touch (qc_check_results, mixing_steps, equipment,
    // recipes, alerts, batch_status_changes, …) → empty.
    return json(route, []);
  });
}

test.describe('Sprint 3 End-to-End Workflows', () => {

  test('2. Main Batch / Sub-batch Navigation', async ({ page }) => {
    await setupMocks(page);

    // Start on the main-batch detail page, then navigate into its sub-batch.
    await page.goto(`/batches/${F.parentId}`);
    await expect(page.getByRole('heading', { name: 'Sub-batches' })).toBeVisible();

    await page.getByRole('link', { name: F.subNum }).click();

    // Arrived at the sub-batch detail page.
    await expect(page.getByText('Parent:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show QR' })).toBeVisible();
  });

  test('3. Process Timeline Rendering', async ({ page }) => {
    await setupMocks(page);

    // A non-mixing (CTGC) sub-batch renders the Process Timeline panel.
    await page.goto(`/batches/${F.parentId}/${F.subId}`);
    await expect(page.getByText('Process Timeline')).toBeVisible();

    // The mocked run appears as a timeline entry; expanding it shows params.
    const entry = page.getByRole('button', { name: /Coating & Oven Drying/ });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page.getByText('No parameters')).toBeVisible();
  });

  test('4. Sub-Batch Log Process Step (Auto-fill Bypass)', async ({ page }) => {
    await setupMocks(page);

    await page.goto(`/batches/${F.parentId}/${F.subId}`);

    // The sub-batch is InProgress → the Log Process Step button is present and
    // carries ?subbatchId=, which auto-resolves the batch on the single-page log.
    await page.getByRole('button', { name: 'Log Process Step' }).click();

    // Section 1 collapses to the batch summary; section 2 reveals step dropdown inline.
    await expect(page.getByText(F.subNum).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('process-step-select')).toBeVisible({ timeout: 5000 });
  });

  test('5. Sub-Batch Log Process Step (Manual QR Scanner fallback)', async ({ page }) => {
    await setupMocks(page);

    await page.goto('/log/process-step');
    // Single-page section 1: Scan batch
    await expect(page.getByText('Scan batch')).toBeVisible();

    const input = page.getByPlaceholder('e.g. CTGC-20260601-A01');
    await expect(input).toBeVisible();
    await input.fill(F.subNum);

    // "Find batch" resolves section 1; section 2 reveals process step dropdown inline.
    await page.getByRole('button', { name: /find batch/i }).click();
    await expect(page.getByTestId('process-step-select')).toBeVisible({ timeout: 5000 });
  });

});
