/**
 * Task 2 — Process Timeline
 *
 * Covers the Process Timeline panel on the sub-batch detail page:
 *   - Timeline loads and renders process run entries
 *   - Timestamps are formatted in Singapore timezone (SGT = UTC+8)
 *   - Active (InProgress) runs show the "Live" indicator
 *   - QC results show PASSED (green) and FAILED (red) badges
 *
 * Auth: Engineer session (tests/.auth/engineer.json)
 * All Supabase REST calls are intercepted with stateless page.route() mocks.
 */

import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const MOCK = {
  parentId:       '10000000-1000-1000-1000-100000000000',
  subId:          '20000000-2000-2000-2000-200000000000',
  batchNum:       'ANOD-20260601-A01-01',
  parentBatchNum: 'ANOD-20260601-A01',
}

test.describe('Task 2 — Process Timeline', () => {

  test('timeline loads with SGT timestamps, Live indicator, and QC PASSED/FAILED badges', async ({ page }) => {

    // Sub-batch detail (useBatch hook)
    await page.route(`**${SB}/rest/v1/batches*`, async (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('id') === `eq.${MOCK.subId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id:              MOCK.subId,
            batch_number:    MOCK.batchNum,
            parent_batch_id: MOCK.parentId,
            material_id:     'material-uuid-123',
            status:          'InProgress',
            parent_batch: {
              id:           MOCK.parentId,
              batch_number: MOCK.parentBatchNum,
            },
            material: { name: 'Anode Electrode', code: 'ANODE' },
          }),
        })
      }
      return route.continue()
    })

    // Process runs (useProcessTimeline hook)
    // run-1: InProgress → should show "Live" + SGT 10:00 (UTC 02:00 + 8h)
    // run-2: Completed  → SGT 08:00 (UTC 00:00 + 8h), duration 30 min
    await page.route(`**${SB}/rest/v1/process_runs*`, async (route) => {
      const url = new URL(route.request().url())
      if (url.toString().includes(MOCK.subId)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id:         'run-1',
              process_id: 'proc-1',
              status:     'InProgress',
              start_date: '2026-06-03',
              start_time: '02:00:00',
              end_date:   null,
              end_time:   null,
              process:    { name: 'Coating', code: 'CTGC' },
              operator:   { id: 'user-1', full_name: 'John Doe' },
              equipment:  { name: 'Coater 1', equipment_code: 'C-100' },
            },
            {
              id:         'run-2',
              process_id: 'proc-2',
              status:     'Completed',
              start_date: '2026-06-03',
              start_time: '00:00:00',
              end_date:   '2026-06-03',
              end_time:   '00:30:00',
              process:    { name: 'Slitting', code: 'SLTS' },
              operator:   { id: 'user-2', full_name: 'Jane Smith' },
              equipment:  { name: 'Slitter 1', equipment_code: 'S-200' },
            },
          ]),
        })
      }
      return route.continue()
    })

    // QC results for the completed run
    // qc-1: numeric 22, criteria "20-25" → PASSED
    // qc-2: boolean false                 → FAILED
    await page.route(`**${SB}/rest/v1/qc_check_results*`, async (route) => {
      const url = new URL(route.request().url())
      if (url.toString().includes('process_run_id=in')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id:                    'qc-1',
              process_run_id:        'run-2',
              result_value_numeric:  22,
              result_value_boolean:  null,
              result_text:           '22',
              notes:                 null,
              created_at:            '2026-06-03T00:45:00Z',
              performed_by:          { full_name: 'Jane Smith' },
              qc_check_definitions:  { acceptance_criteria_text: '20-25', qc_item_name: 'Viscosity' },
            },
            {
              id:                    'qc-2',
              process_run_id:        'run-2',
              result_value_numeric:  null,
              result_value_boolean:  false,
              result_text:           'Fail',
              notes:                 null,
              created_at:            '2026-06-03T00:50:00Z',
              performed_by:          { full_name: 'Jane Smith' },
              qc_check_definitions:  { acceptance_criteria_text: 'No visible lumps', qc_item_name: 'Homogeneity' },
            },
          ]),
        })
      }
      return route.continue()
    })

    // Mixing steps — empty for a non-mixing batch
    await page.route(`**${SB}/rest/v1/mixing_steps*`, async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    await page.goto(`/batches/${MOCK.parentId}/${MOCK.subId}`)

    // Panel header
    await expect(page.getByText('Process Timeline')).toBeVisible()

    // Process run entries
    await expect(page.getByText('Coating')).toBeVisible()
    await expect(page.getByText('Live')).toBeVisible()
    await expect(page.getByText('John Doe')).toBeVisible()

    // UTC 02:00 → SGT 10:00
    await expect(page.getByText('03 Jun, 10:00 am')).toBeVisible()

    await expect(page.getByText('Slitting')).toBeVisible()
    await expect(page.getByText('Jane Smith').first()).toBeVisible()

    // UTC 00:00 → SGT 08:00
    await expect(page.getByText('03 Jun, 08:00 am')).toBeVisible()

    // QC badges
    await expect(page.getByText('PASSED')).toBeVisible()
    await expect(page.getByText('FAILED')).toBeVisible()
  })

})
