# QC & Process Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce numeric QC acceptance criteria, add per-process parameter forms for Coating/Calendaring/Die Cut, and wire inline QC check steps into the mixing workflow.

**Architecture:** Three independent vertical slices that share no runtime state. Q1 modifies the QC wizard's pass/fail engine to use `acceptance_criteria_min/max` instead of text parsing. Q2 replaces the hardcoded `PARAMS_BY_CODE` in `GenericProcessLog` with a data-driven `PROCESS_LOG_FIELDS` config for three target processes. Q3 adds `qc_check` as a third mixing step type through the existing `AddStepModal` and `log_mixing_step` RPC. Each task has its own Playwright tests.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase JS, Playwright.

## Global Constraints

- **Stay in lane.** Only touch files under QC (`app/log/qc/`), process logging (`components/log/generic-process-log.tsx`), mixing (`components/mixing/`, `components/subbatch/add-step-modal.tsx`), sidebar, and `lib/constants.ts` / `lib/types.ts`. Flag any shared-file risk in the Phase 0 report.
- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 — match existing conventions.
- **No DB schema changes.** All persistence uses existing tables/columns.
- Query batches by UUID `id`; scan lookups use `WHERE batch_number = $1`.
- Use actual DB column names from `docs/FLINT_REFERENCE_21052026.md` schema corrections table.
- RLS is ON — no service-role workarounds in client code.
- Supabase REST base in tests: `https://pewrwrqituidyxhfsner.supabase.co/rest/v1/<table>`.
- Tests: mock all Supabase REST/RPC via `page.route()`; **stateless mocks** (no call counters); POST→201, PATCH→204, GET `.single()`→object, GET list→array; do **not** mock `/rest/v1/users`.
- `npm test` must be green before any push.
- Work on branch `feature/process-log-revamp` (current branch); never push to `main`/`dev`.
- Update `docs/SESSION_LOG.md` + `docs/FLINT_REFERENCE_21052026.md` before pushing.

## Pre-existing state: Sidebar nav entry — ALREADY DONE

The PR spec requests adding a Process Log sidebar entry. This is **already complete**:
- `components/sidebar.tsx:15` — `{ id: 'log', label: 'Process Log', Icon: IconClipboard, href: '/log' }`
- Visible to all roles via `VISIBLE_IDS` (lines 31-34)
- Test exists: `tests/sprint6/sidebar-process-log.spec.ts`
- **No work needed.** Note this in the post-implementation report as "pre-existing."

---

## Task 1: Q1 — Enforce numeric QC acceptance criteria

**Files:**
- Modify: `app/log/qc/page.tsx`
- Test: `tests/sprint7/qc-numeric-bounds.spec.ts`

**Interfaces:**
- Consumes: `qc_check_definitions` table columns `acceptance_criteria_min` (numeric, nullable) and `acceptance_criteria_max` (numeric, nullable); `method` enum values `VisualManual` / `ToolEquipment`.
- Produces: Updated `computePassed(def, enteredValue)` function that returns `boolean | null`. Existing behavior unchanged for `VisualManual` checks.

### Steps

- [ ] **Step 1: Write the failing test file**

Create `tests/sprint7/qc-numeric-bounds.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:   '11111111-1111-1111-1111-111111111111',
  batchNum:  'MIXC-20260601-A01-01',
  runId:     '22222222-2222-2222-2222-222222222222',
  procId:    '33333333-3333-3333-3333-333333333333',
  matId:     '44444444-4444-4444-4444-444444444444',
  defVisual: '55555555-5555-5555-5555-555555555555',
  defMinMax: '66666666-6666-6666-6666-666666666666',
  defMaxOnly:'77777777-7777-7777-7777-777777777777',
  outBatchId:  '88888888-8888-8888-8888-888888888888',
  outBatchNum: 'MIXC-20260602-A01-02',
}

async function setupMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/batches**`, route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: M.outBatchId, batch_number: M.outBatchNum }),
      })
    }
    if (route.request().method() === 'PATCH') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        id: M.batchId, batch_number: M.batchNum,
        material_id: M.matId, current_quantity: 100,
      }),
    })
  })

  await page.route(`**${SB}/rest/v1/process_run_inputs**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ process_run_id: M.runId }),
    })
  )

  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    if (route.request().method() !== 'GET')
      return route.fulfill({ status: 204, body: '' })
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: M.runId, process_id: M.procId }),
    })
  })

  await page.route(`**${SB}/rest/v1/processes**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: M.procId, requires_calibration: false }),
    })
  )

  await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        {
          id: M.defVisual,
          qc_item_name: 'Homogeneity',
          method: 'VisualManual',
          timing: 'EndOfRun',
          acceptance_criteria_text: 'No visible lumps',
          acceptance_criteria_min: null,
          acceptance_criteria_max: null,
        },
        {
          id: M.defMinMax,
          qc_item_name: 'Viscosity',
          method: 'ToolEquipment',
          timing: 'EndOfRun',
          acceptance_criteria_text: 'Within ± 2%',
          acceptance_criteria_min: 10,
          acceptance_criteria_max: 20,
        },
        {
          id: M.defMaxOnly,
          qc_item_name: 'Particle Size',
          method: 'ToolEquipment',
          timing: 'EndOfRun',
          acceptance_criteria_text: '< 50',
          acceptance_criteria_min: null,
          acceptance_criteria_max: 50,
        },
      ]),
    })
  )

  await page.route(`**${SB}/rest/v1/qc_check_results**`, route =>
    route.fulfill({ status: 201, body: '' })
  )

  await page.route(`**${SB}/rest/v1/batch_status_changes**`, route =>
    route.fulfill({ status: 201, body: '' })
  )
}

async function scanBatch(page: Page) {
  await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
  await page.getByRole('button', { name: /continue/i }).click()
  await expect(page.getByRole('heading', { name: 'Enter QC Results' })).toBeVisible()
}

test.describe('QC Numeric Bounds', () => {
  test('ToolEquipment check with min/max: 15 passes (10–20 range)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    // Spec display shows numeric range instead of text
    await expect(page.getByText('10 – 20')).toBeVisible()

    // Homogeneity (Visual) → Pass
    await page.getByRole('button', { name: 'Pass' }).click()

    // Viscosity → 15 (within 10–20) → auto-pass
    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.first().fill('15')
    await expect(page.getByText('✓ Pass').first()).toBeVisible()

    // Particle Size → 30 (≤ 50) → auto-pass
    await inputs.nth(1).fill('30')
  })

  test('ToolEquipment check: 9 fails (below min=10)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByRole('button', { name: 'Pass' }).click()
    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.first().fill('9')
    await expect(page.getByText('✗ Fail').first()).toBeVisible()
  })

  test('ToolEquipment check: 21 fails (above max=20)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByRole('button', { name: 'Pass' }).click()
    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.first().fill('21')
    await expect(page.getByText('✗ Fail').first()).toBeVisible()
  })

  test('Non-numeric entry on numeric check fails gracefully', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByRole('button', { name: 'Pass' }).click()
    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.first().fill('abc')
    await expect(page.getByText('✗ Fail').first()).toBeVisible()
  })

  test('max-only check: 50 passes (≤ 50)', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    await page.getByRole('button', { name: 'Pass' }).click()
    const inputs = page.getByPlaceholder('Enter measured value')
    await inputs.first().fill('15')   // Viscosity → pass
    await inputs.nth(1).fill('50')    // Particle Size → 50 ≤ 50 → pass
    await expect(page.getByText('✓ Pass').nth(1)).toBeVisible()
  })

  test('VisualManual checks still work as before', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/log/qc')
    await scanBatch(page)

    // Homogeneity is VisualManual — shows Pass/Fail buttons, not numeric input
    await expect(page.getByRole('button', { name: 'Pass' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fail' })).toBeVisible()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/sprint7/qc-numeric-bounds.spec.ts`
Expected: FAIL — `computePassed` doesn't accept a `def` object, and `acceptance_criteria_min`/`max` aren't fetched.

- [ ] **Step 3: Update `QCCheckDef` interface and `.select()` query**

In `app/log/qc/page.tsx`, update the interface (lines 12–18):

```ts
interface QCCheckDef {
  id: string;
  qc_item_name: string;
  method: 'VisualManual' | 'ToolEquipment';
  timing: 'Startup' | 'EndOfRun';
  acceptance_criteria_text: string;
  acceptance_criteria_min: number | null;
  acceptance_criteria_max: number | null;
}
```

Update the `.select()` call (line 134):

```ts
      const { data: defs } = await supabase
        .from('qc_check_definitions')
        .select('id, qc_item_name, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max')
        .eq('process_id', processId);
```

- [ ] **Step 4: Rewrite `computePassed` to use numeric bounds**

Replace the `computePassed` function (lines 25–33) with:

```ts
function computePassedFromText(value: string, criteria: string): boolean | null {
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  const ltMatch = criteria.match(/^<\s*([\d.]+)/);
  if (ltMatch) return num < parseFloat(ltMatch[1]);
  const gtMatch = criteria.match(/^>\s*([\d.]+)/);
  if (gtMatch) return num > parseFloat(gtMatch[1]);
  return null;
}

function computePassed(def: QCCheckDef, enteredValue: string): boolean | null {
  if (def.method === 'VisualManual') return null;

  const hasNumericBounds =
    def.acceptance_criteria_min != null || def.acceptance_criteria_max != null;

  if (hasNumericBounds) {
    const v = Number(enteredValue);
    if (Number.isNaN(v)) return false;
    if (def.acceptance_criteria_min != null && v < def.acceptance_criteria_min) return false;
    if (def.acceptance_criteria_max != null && v > def.acceptance_criteria_max) return false;
    return true;
  }

  return computePassedFromText(enteredValue, def.acceptance_criteria_text);
}
```

- [ ] **Step 5: Update the call site and spec display**

Update the `onChange` handler (around line 412–415) from:

```ts
const computed = computePassed(val, def.acceptance_criteria_text);
```

to:

```ts
const computed = computePassed(def, val);
```

Update the spec display (around line 382–384) from:

```tsx
<span className="text-[10px] text-amber-500/60 font-mono whitespace-nowrap">
  Spec: {def.acceptance_criteria_text}
</span>
```

to:

```tsx
<span className="text-[10px] text-amber-500/60 font-mono whitespace-nowrap">
  Spec: {def.acceptance_criteria_min != null && def.acceptance_criteria_max != null
    ? `${def.acceptance_criteria_min} – ${def.acceptance_criteria_max}`
    : def.acceptance_criteria_min != null
    ? `≥ ${def.acceptance_criteria_min}`
    : def.acceptance_criteria_max != null
    ? `≤ ${def.acceptance_criteria_max}`
    : def.acceptance_criteria_text}
</span>
```

- [ ] **Step 6: Run tests and verify they pass**

Run: `npm test -- tests/sprint7/qc-numeric-bounds.spec.ts`
Expected: ALL PASS.

Then run the full suite: `npm test`
Expected: ALL existing QC tests still pass (the existing tests don't send `acceptance_criteria_min`/`max` in mocks, so they'll be `undefined`/`null` — the code falls back to text parsing, preserving existing behavior).

- [ ] **Step 7: Commit**

```bash
git add app/log/qc/page.tsx tests/sprint7/qc-numeric-bounds.spec.ts
git commit -m "feat(qc): enforce numeric min/max acceptance criteria for ToolEquipment checks"
```

---

## Task 2: Q2 — Per-process step data forms (Coating, Calendaring, Die Cut)

**Files:**
- Modify: `lib/constants.ts` (add `PROCESS_LOG_FIELDS` config + types)
- Modify: `components/log/generic-process-log.tsx` (consume new config, add recipe comparison)
- Test: `tests/sprint7/process-log-fields.spec.ts`

**Interfaces:**
- Consumes: `PROCESS_LOG_FIELDS` config (from `lib/constants.ts`); `recipes.params` JSONB for recipe comparison; `process_run_parameters` table columns `parameter_key`, `parameter_value`, `is_modified_from_recipe`.
- Produces: `PROCESS_LOG_FIELDS` export keyed by process code. `GenericProcessLog` renders process-specific fields for CTGC/CALC/DICC/DICA, falls back to `PARAMS_BY_CODE` for all others.

### Steps

- [ ] **Step 1: Add `ProcessLogFieldDef` type and `PROCESS_LOG_FIELDS` to `lib/constants.ts`**

Append to the end of `lib/constants.ts`:

```ts
// ── Process log field config (operator logging forms) ────────────────

export type ProcessLogFieldDef =
  | { kind: 'scalar'; key: string; label: string; unit: string; placeholder?: string }
  | { kind: 'array';  key: string; label: string; unit: string; count: number; itemLabels: string[] };

export const PROCESS_LOG_FIELDS: Record<string, ProcessLogFieldDef[]> = {
  CTGC: [
    { kind: 'scalar', key: 'substrate_feeding_speed_mm_per_min', label: 'Substrate Feeding Speed', unit: 'mm/min', placeholder: '2.5' },
    { kind: 'scalar', key: 'coating_blade_gap_um', label: 'Coating Blade Gap', unit: 'µm', placeholder: '200' },
    { kind: 'scalar', key: 'transfer_gap_um', label: 'Transfer Gap', unit: 'µm', placeholder: '150' },
    { kind: 'scalar', key: 'coating_length_m', label: 'Coating Length', unit: 'm', placeholder: '50' },
    { kind: 'array', key: 'upper_oven_temps_c', label: 'Upper Oven RC', unit: '°C', count: 6,
      itemLabels: ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6'] },
    { kind: 'array', key: 'lower_oven_temps_c', label: 'Lower Oven RC', unit: '°C', count: 6,
      itemLabels: ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6'] },
  ],
  CALC: [
    { kind: 'scalar', key: 'force_kn', label: 'Force', unit: 'kN', placeholder: '50' },
    { kind: 'scalar', key: 'roller_gap_um', label: 'Roller Gap', unit: 'µm', placeholder: '120' },
    { kind: 'scalar', key: 'feed_rate_m_per_min', label: 'Feed Rate', unit: 'm/min', placeholder: '5' },
  ],
  DICC: [
    { kind: 'scalar', key: 'cutting_piston_travel_depth_mm', label: 'Piston Travel Depth', unit: 'mm', placeholder: '10' },
    { kind: 'scalar', key: 'distance_between_cuts_mm', label: 'Distance Between Cuts', unit: 'mm', placeholder: '50' },
    { kind: 'scalar', key: 'machine_feed_rate_mm_per_s', label: 'Machine Feed Rate', unit: 'mm/s', placeholder: '20' },
    { kind: 'scalar', key: 'pass_rate_pct', label: 'Pass Rate', unit: '%', placeholder: '95' },
  ],
  DICA: [
    { kind: 'scalar', key: 'cutting_piston_travel_depth_mm', label: 'Piston Travel Depth', unit: 'mm', placeholder: '10' },
    { kind: 'scalar', key: 'distance_between_cuts_mm', label: 'Distance Between Cuts', unit: 'mm', placeholder: '50' },
    { kind: 'scalar', key: 'machine_feed_rate_mm_per_s', label: 'Machine Feed Rate', unit: 'mm/s', placeholder: '20' },
    { kind: 'scalar', key: 'pass_rate_pct', label: 'Pass Rate', unit: '%', placeholder: '95' },
  ],
};
```

- [ ] **Step 2: Write the failing test file**

Create `tests/sprint7/process-log-fields.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchId:   '11111111-1111-1111-1111-111111111111',
  batchNum:  'CTGC-20260601-A01-01',
  matId:     '22222222-2222-2222-2222-222222222222',
  equipId:   '44444444-4444-4444-4444-444444444444',
  recipeId:  '55555555-5555-5555-5555-555555555555',
  runId:     '66666666-6666-6666-6666-666666666666',
}

function makeProcess(code: string, name: string, procId: string) {
  return { process_id: procId, code, name, sequence_hint: 1, requires_calibration: false }
}

async function setupMocks(page: Page, process: ReturnType<typeof makeProcess>) {
  await page.route(`**${SB}/rest/v1/**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  )

  await page.route(`**${SB}/rest/v1/batches**`, route => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 200, body: '[]' })
    if (route.request().url().includes('batch_number'))
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: M.batchId, batch_number: M.batchNum, material_id: M.matId }),
      })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([process]) })
  )

  await page.route(`**${SB}/rest/v1/equipment**`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: M.equipId, name: 'Machine A', equipment_code: 'MA', process_id: process.process_id, is_active: true }]),
    })
  )

  await page.route(`**${SB}/rest/v1/recipes**`, route => {
    if (route.request().url().includes('select=params'))
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ params: {} }) })
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{ id: M.recipeId, recipe_number: 'RCP-001', version: '1.0', params: {} }]),
    })
  })

  await page.route(`**${SB}/rest/v1/process_runs**`, route => {
    if (route.request().method() === 'POST')
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: M.runId }) })
    return route.fulfill({ status: 204, body: '' })
  })

  await page.route(`**${SB}/rest/v1/process_run_inputs**`, route =>
    route.fulfill({ status: 201, body: '' })
  )

  await page.route(`**${SB}/rest/v1/process_run_parameters**`, route =>
    route.fulfill({ status: 201, body: '' })
  )
}

async function scanAndSelectStep(page: Page) {
  await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
  await page.getByRole('button', { name: /continue/i }).click()
  // Step 2 — click the process step
  await page.getByRole('button').filter({ hasText: /step/i }).or(page.locator('[class*="rounded-xl"]').first()).click()
}

test.describe('Per-process step data forms', () => {
  test('Coating renders blade gap, oven temps, substrate speed', async ({ page }) => {
    const proc = makeProcess('CTGC', 'Coating & Oven Drying', '33333333-3333-3333-3333-333333333333')
    await setupMocks(page, proc)
    await page.goto('/log/process-step')

    await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
    await page.getByRole('button', { name: /continue/i }).click()
    // Select the Coating step
    await page.getByText('Coating & Oven Drying').click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Verify dedicated fields render
    await expect(page.getByText('Coating Blade Gap')).toBeVisible()
    await expect(page.getByText('Substrate Feeding Speed')).toBeVisible()
    await expect(page.getByText('Upper Oven RC')).toBeVisible()
    await expect(page.getByText('Zone 1')).toBeVisible()
  })

  test('Calendaring renders force and roller gap', async ({ page }) => {
    const proc = makeProcess('CALC', 'Calendaring', '33333333-3333-3333-3333-333333333334')
    await setupMocks(page, proc)
    await page.goto('/log/process-step')

    await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.getByText('Calendaring').click()
    await page.getByRole('button', { name: /continue/i }).click()

    await expect(page.getByText('Force')).toBeVisible()
    await expect(page.getByText('Roller Gap')).toBeVisible()
  })

  test('Die Cut renders piston travel and pass rate', async ({ page }) => {
    const proc = makeProcess('DICC', 'Die Cutting (Cathode)', '33333333-3333-3333-3333-333333333335')
    await setupMocks(page, proc)
    await page.goto('/log/process-step')

    await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.getByText('Die Cutting').click()
    await page.getByRole('button', { name: /continue/i }).click()

    await expect(page.getByText('Piston Travel Depth')).toBeVisible()
    await expect(page.getByText('Pass Rate')).toBeVisible()
  })

  test('parameter_key uses structured key in submit body', async ({ page }) => {
    const procId = '33333333-3333-3333-3333-333333333334'
    const proc = makeProcess('CALC', 'Calendaring', procId)
    await setupMocks(page, proc)

    let paramBodies: Record<string, unknown>[] = []
    await page.route(`**${SB}/rest/v1/process_run_parameters**`, route => {
      if (route.request().method() === 'POST') {
        paramBodies.push(JSON.parse(route.request().postData() || '{}'))
      }
      return route.fulfill({ status: 201, body: '' })
    })

    await page.goto('/log/process-step')
    await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.getByText('Calendaring').click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Fill Force field
    const forceInput = page.locator('input[type="number"]').nth(1) // after qty consumed
    await forceInput.fill('50')

    // Continue to confirm
    await page.getByRole('button', { name: /continue/i }).click()
    // Submit
    await page.getByRole('button', { name: /submit/i }).click()

    await expect.poll(() => paramBodies.length, { timeout: 10000 }).toBeGreaterThan(0)
    expect(paramBodies.some(b => b.parameter_key === 'force_kn')).toBe(true)
  })

  test('Cutting still uses generic form (untouched)', async ({ page }) => {
    const proc = makeProcess('CUTS', 'Cutting (Separator)', '33333333-3333-3333-3333-333333333336')
    await setupMocks(page, proc)
    await page.goto('/log/process-step')

    await page.getByPlaceholder(/e\.g\./i).fill(M.batchNum)
    await page.getByRole('button', { name: /continue/i }).click()
    await page.getByText('Cutting').click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Legacy PARAMS_BY_CODE fields render
    await expect(page.getByText('Cutting Distance')).toBeVisible()
    // Structured fields should NOT render
    await expect(page.getByText('Force')).not.toBeVisible()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/sprint7/process-log-fields.spec.ts`
Expected: FAIL — `PROCESS_LOG_FIELDS` doesn't exist yet in the component, labels won't match.

- [ ] **Step 4: Update `GenericProcessLog` to use `PROCESS_LOG_FIELDS`**

In `components/log/generic-process-log.tsx`:

**4a. Add imports** (top of file):

```ts
import { PROCESS_LOG_FIELDS, type ProcessLogFieldDef } from '@/lib/constants';
```

**4b. Add recipe defaults state** (after the `recipeList` state, around line 105):

```ts
const [recipeDefaults, setRecipeDefaults] = useState<Record<string, string>>({});
```

**4c. Add recipe params fetch effect** (after the equipment/recipe fetch effect, around line 147):

```ts
  useEffect(() => {
    if (!selectedRecipe) { setRecipeDefaults({}); return; }
    supabase
      .from('recipes')
      .select('params')
      .eq('id', selectedRecipe.id)
      .single()
      .then(({ data }) => {
        if (!data?.params) { setRecipeDefaults({}); return; }
        const defaults: Record<string, string> = {};
        const p = data.params as Record<string, unknown>;
        for (const [key, val] of Object.entries(p)) {
          if (typeof val === 'number' || typeof val === 'string') {
            defaults[key] = String(val);
          } else if (Array.isArray(val)) {
            (val as unknown[]).forEach((v, i) => { defaults[`${key}[${i}]`] = String(v); });
          }
        }
        setRecipeDefaults(defaults);
      });
  }, [selectedRecipe?.id]);
```

**4d. Replace the `params` variable** (around line 115):

```ts
  const processLogFields: ProcessLogFieldDef[] | null = selectedStep
    ? (PROCESS_LOG_FIELDS[selectedStep.code] ?? null)
    : null;
  const legacyParams = selectedStep && !processLogFields
    ? (PARAMS_BY_CODE[selectedStep.code] ?? [])
    : [];
```

**4e. Replace the parameter rendering in Step 4** (around lines 529–545). Replace the `{params.map(...)}` block and the `{params.length === 0 && (...)}` block with:

```tsx
            {/* Per-process fields (PROCESS_LOG_FIELDS) */}
            {processLogFields && processLogFields.map((field) => {
              if (field.kind === 'scalar') {
                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                      {field.label} <span className="text-[#3a3a3a]">({field.unit})</span>
                      {recipeDefaults[field.key] != null && (
                        <span className="text-[#3b82f6] ml-1.5 normal-case tracking-normal">
                          target: {recipeDefaults[field.key]}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={paramValues[field.key] ?? ''}
                      onChange={(e) => setParamValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className={fieldBase}
                    />
                  </div>
                );
              }
              return (
                <div key={field.key} className="flex flex-col gap-2">
                  <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                    {field.label} <span className="text-[#3a3a3a]">({field.unit})</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {field.itemLabels.map((il, i) => (
                      <div key={`${field.key}_${i}`} className="flex flex-col gap-1">
                        <span className="text-[9.5px] text-[#3a3a3a]">{il}</span>
                        <input
                          type="number"
                          value={paramValues[`${field.key}[${i}]`] ?? ''}
                          onChange={(e) => setParamValues((prev) => ({
                            ...prev,
                            [`${field.key}[${i}]`]: e.target.value,
                          }))}
                          className={fieldBase}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Legacy params (processes not yet in PROCESS_LOG_FIELDS) */}
            {!processLogFields && legacyParams.map((p) => (
              <div key={p.label} className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">
                  {p.label} <span className="text-[#3a3a3a]">({p.unit})</span>
                </label>
                <input
                  type="number"
                  value={paramValues[p.label] ?? ''}
                  onChange={(e) => setParamValues((prev) => ({ ...prev, [p.label]: e.target.value }))}
                  placeholder={p.placeholder}
                  className={fieldBase}
                />
              </div>
            ))}
            {!processLogFields && legacyParams.length === 0 && (
              <div className="text-[12px] text-[#5a5a5a] font-mono py-2">No additional parameters for this process step.</div>
            )}
```

**4f. Update `handleSubmit` to set `is_modified_from_recipe`** (around lines 252–263):

Replace the parameter write loop with:

```ts
    const paramEntries = Object.entries(paramValues).filter(([, v]) => v !== '');
    for (const [key, value] of paramEntries) {
      const recipeDefault = recipeDefaults[key];
      const isModified = recipeDefault != null && recipeDefault !== value;
      const { error: paramError } = await supabase
        .from('process_run_parameters')
        .insert({
          process_run_id:          run.id,
          parameter_key:           key,
          parameter_value:         value,
          is_modified_from_recipe: isModified,
        });
      if (paramError) { setSubmitError(paramError.message); setSubmitting(false); return; }
    }
```

**4g. Add `recipeDefaults` to the `resetWizard` function** (around line 290):

Add `setRecipeDefaults({});` to the reset function.

- [ ] **Step 5: Run tests and verify they pass**

Run: `npm test -- tests/sprint7/process-log-fields.spec.ts`
Expected: ALL PASS.

Then run: `npm test`
Expected: Full suite green. Existing `process-step-logging.spec.ts` tests continue passing — they use CALC which now uses `PROCESS_LOG_FIELDS`, but the fields have the same labels.

- [ ] **Step 6: Commit**

```bash
git add lib/constants.ts components/log/generic-process-log.tsx tests/sprint7/process-log-fields.spec.ts
git commit -m "feat(process-log): per-process parameter forms for Coating, Calendaring, Die Cut with recipe comparison"
```

---

## Task 3: Q3 — Inline QC step in the mixing workflow

**Files:**
- Modify: `lib/types.ts` (add `QcCheckStep` type)
- Modify: `components/subbatch/add-step-modal.tsx` (add QC Check section + submission)
- Modify: `components/mixing/mixing-workspace.tsx` (update `mapDbStep`, pass `processId`)
- Modify: `components/mixing/step-history.tsx` (render `qc_check` steps)
- Test: `tests/sprint7/mixing-qc-step.spec.ts`

**Interfaces:**
- Consumes: `log_mixing_step` RPC with `p_type: 'qc_check'`; `qc_check_definitions` table; `mixing_steps.type = 'qc_check'` (confirmed in reference doc §7.1a).
- Produces: `QcCheckStep` type; `AddStepModal` gains a "QC Check" section; `StepHistory` renders QC check steps inline.

**Dependency check:** The reference doc §7.1a confirms `mixing_steps.type` accepts `'qc_check'`. If Phase 0 SQL verification reveals the RPC rejects this value, **stop this task and mark it "blocked — needs Jon's backend enum change"** in the PR description.

### Steps

- [ ] **Step 1: Write the failing test file**

Create `tests/sprint7/mixing-qc-step.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/sprint7/mixing-qc-step.spec.ts`
Expected: FAIL — `qc_check` type not handled.

- [ ] **Step 3: Add `QcCheckStep` type to `lib/types.ts`**

Update `lib/types.ts`. Change `MixingStepType` (line 77):

```ts
export type MixingStepType = 'add_material' | 'mix_round' | 'qc_check';
```

Add `QcCheckParams` interface (after `MixRoundParams`, around line 93):

```ts
export interface QcCheckParams {
  checks: Array<{
    definitionId: string;
    itemName: string;
    method: 'VisualManual' | 'ToolEquipment';
    resultValue: string;
    passed: boolean;
  }>;
}
```

Add `QcCheckStep` interface (after `MixRoundStep`, around line 113):

```ts
export interface QcCheckStep extends MixingStepBase {
  type: 'qc_check';
  params: QcCheckParams;
}
```

Update the `MixingStep` union (line 115):

```ts
export type MixingStep = AddMaterialStep | MixRoundStep | QcCheckStep;
```

- [ ] **Step 4: Update `mapDbStep` in `mixing-workspace.tsx`**

In `components/mixing/mixing-workspace.tsx`, update the `mapDbStep` function (around lines 37–51):

```ts
function mapDbStep(row: DbMixingStep): MixingStep {
  const base = {
    id: row.id,
    stepNumber: row.step_number,
    label: row.label,
    displayRef: row.display_ref,
    status: row.status as MixingStepStatus,
    operator: row.operator,
    timestamp: row.created_at,
  };
  if (row.type === 'add_material') {
    return { ...base, type: 'add_material', params: row.params as unknown as AddMaterialParams };
  }
  if (row.type === 'qc_check') {
    return { ...base, type: 'qc_check', params: row.params as unknown as QcCheckParams };
  }
  return { ...base, type: 'mix_round', params: row.params as unknown as MixRoundParams };
}
```

Add `QcCheckParams` to the imports:

```ts
import type {
  MixingStep,
  MixRoundStep,
  AddMaterialParams,
  MixRoundParams,
  QcCheckParams,
  MixingStepStatus,
} from '@/lib/types';
```

Pass `processId` to `AddStepModal` (around line 388). Add the prop:

```tsx
        <AddStepModal
          mode="sheet"
          batchId={batchUuid!}
          parentBatchId={batchId}
          nextStepNumber={steps.filter((s) => s.status !== 'voided').length + 1}
          suggestedMaterial={nextPlanRow?.material}
          suggestedQuantity={nextPlanRow?.targetKg}
          recipeId={isFirstMaterial ? recipeId : null}
          processId={processId}
          onSubmit={handleAddStep}
          onClose={() => setShowAddStep(false)}
        />
```

- [ ] **Step 5: Add QC Check section to `AddStepModal`**

In `components/subbatch/add-step-modal.tsx`:

**5a. Add imports:**

```ts
import type { MixingStep, MixingStepStatus, AddMaterialStep, MixRoundStep, QcCheckStep, AddMaterialParams, MixRoundParams, QcCheckParams } from '@/lib/types';
import supabase from '@/lib/supabase'; // already imported
```

**5b. Add `processId` to Props interface:**

```ts
interface Props {
  batchId:        string;
  parentBatchId:  string;
  nextStepNumber: number;
  suggestedMaterial?: string;
  suggestedQuantity?: number;
  recipeId?: string | null;
  processId?: string | null;
  onSubmit: (steps: MixingStep[]) => void;
  onClose:  () => void;
  mode?: 'modal' | 'sheet';
}
```

**5c. Add QC state** (after the mix round fields, around line 48):

```ts
  // QC Check fields
  interface QcDef {
    id: string;
    qc_item_name: string;
    method: 'VisualManual' | 'ToolEquipment';
    acceptance_criteria_text: string;
    acceptance_criteria_min: number | null;
    acceptance_criteria_max: number | null;
  }
  const [qcDefs, setQcDefs]     = useState<QcDef[]>([]);
  const [qcValues, setQcValues] = useState<Record<string, { value: string; passed: boolean | null }>>({});
```

**5d. Fetch QC definitions** (add after the existing state declarations):

```ts
  useEffect(() => {
    if (!processId) return;
    supabase
      .from('qc_check_definitions')
      .select('id, qc_item_name, method, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max')
      .eq('process_id', processId)
      .then(({ data }) => {
        const defs = (data ?? []) as QcDef[];
        setQcDefs(defs);
        setQcValues(Object.fromEntries(defs.map(d => [d.id, { value: '', passed: null }])));
      });
  }, [processId]);
```

**5e. Add QC check computation and `canSubmit` update:**

```ts
  function computeQcPassed(def: QcDef, value: string): boolean | null {
    if (def.method === 'VisualManual') return null;
    const hasNumericBounds = def.acceptance_criteria_min != null || def.acceptance_criteria_max != null;
    if (hasNumericBounds) {
      const v = Number(value);
      if (Number.isNaN(v)) return false;
      if (def.acceptance_criteria_min != null && v < def.acceptance_criteria_min) return false;
      if (def.acceptance_criteria_max != null && v > def.acceptance_criteria_max) return false;
      return true;
    }
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    const lt = def.acceptance_criteria_text.match(/^<\s*([\d.]+)/);
    if (lt) return num < parseFloat(lt[1]);
    const gt = def.acceptance_criteria_text.match(/^>\s*([\d.]+)/);
    if (gt) return num > parseFloat(gt[1]);
    return null;
  }

  const qcFilled = qcDefs.length > 0 && Object.values(qcValues).every(v => v.passed !== null);
  const canSubmit = materialFilled || mixRoundFilled || qcFilled;
```

**5f. Add QC submit logic** in `handleSubmit` (after the mix round submit block, before `setSubmitting(false)`):

```ts
    if (qcFilled) {
      const params: QcCheckParams = {
        checks: qcDefs.map(def => ({
          definitionId: def.id,
          itemName: def.qc_item_name,
          method: def.method,
          resultValue: qcValues[def.id].value,
          passed: qcValues[def.id].passed!,
        })),
      };
      const row = await callRpc('qc_check', 'QC Check', params);
      if (!row) { setSubmitting(false); return; }
      logged.push({
        id:         row.id,
        type:       'qc_check',
        stepNumber: row.step_number,
        label:      row.label,
        displayRef: row.display_ref,
        status:     row.status as MixingStepStatus,
        params,
        operator:   uname,
        timestamp:  row.created_at,
      } as QcCheckStep);
    }
```

**5g. Add QC Check section to the modal body** (after the Mix Round section `</div>`, before the closing `</div>` of the body):

```tsx
          {qcDefs.length > 0 && (
            <>
              <div className="h-px bg-[#1e1e1e]" />
              <div className="flex flex-col gap-3">
                <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#f59e0b]">QC Check</div>
                {qcDefs.map(def => (
                  <div key={def.id} className="flex flex-col gap-2 rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12px] font-medium text-[#f5f5f5]">{def.qc_item_name}</span>
                      <span className="text-[9.5px] font-mono text-[#3a3a3a]">
                        {def.method === 'VisualManual' ? 'Visual' : 'Tool'}
                      </span>
                    </div>
                    {def.method === 'VisualManual' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setQcValues(prev => ({ ...prev, [def.id]: { value: 'pass', passed: true } }))}
                          className={`flex-1 h-8 rounded-md text-[11.5px] font-medium border transition-colors ${
                            qcValues[def.id]?.passed === true
                              ? 'bg-[rgba(34,197,94,0.12)] border-[rgba(34,197,94,0.4)] text-[#22c55e]'
                              : 'bg-[#111] border-[#2a2a2a] text-[#888888]'
                          }`}
                        >Pass</button>
                        <button
                          type="button"
                          onClick={() => setQcValues(prev => ({ ...prev, [def.id]: { value: 'fail', passed: false } }))}
                          className={`flex-1 h-8 rounded-md text-[11.5px] font-medium border transition-colors ${
                            qcValues[def.id]?.passed === false
                              ? 'bg-[rgba(239,68,68,0.12)] border-[rgba(239,68,68,0.4)] text-[#ef4444]'
                              : 'bg-[#111] border-[#2a2a2a] text-[#888888]'
                          }`}
                        >Fail</button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Enter measured value"
                          value={qcValues[def.id]?.value ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            const computed = computeQcPassed(def, v);
                            setQcValues(prev => ({ ...prev, [def.id]: { value: v, passed: computed } }));
                          }}
                          className={inputCls}
                        />
                        {qcValues[def.id]?.value !== '' && qcValues[def.id]?.passed !== null && (
                          <span className={`text-[10px] font-mono ${qcValues[def.id]?.passed ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                            {qcValues[def.id]?.passed ? '✓ Pass' : '✗ Fail'}
                          </span>
                        )}
                        {qcValues[def.id]?.value !== '' && qcValues[def.id]?.passed === null && (
                          <div className="flex gap-2">
                            <button type="button"
                              onClick={() => setQcValues(prev => ({ ...prev, [def.id]: { ...prev[def.id], passed: true } }))}
                              className="flex-1 h-7 rounded text-[10.5px] border border-[#2a2a2a] text-[#888888] hover:text-[#22c55e]"
                            >Pass</button>
                            <button type="button"
                              onClick={() => setQcValues(prev => ({ ...prev, [def.id]: { ...prev[def.id], passed: false } }))}
                              className="flex-1 h-7 rounded text-[10.5px] border border-[#2a2a2a] text-[#888888] hover:text-[#ef4444]"
                            >Fail</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
```

- [ ] **Step 6: Update `StepHistory` to render QC check steps**

In `components/mixing/step-history.tsx`:

Update `stepSummary` (lines 11–16):

```ts
function stepSummary(step: MixingStep): string {
  if (step.type === 'add_material') {
    return `${step.params.materialName}  ${step.params.quantity} ${step.params.unit}`;
  }
  if (step.type === 'qc_check') {
    const checks = (step.params as { checks?: Array<{ passed: boolean }> }).checks;
    return checks ? `${checks.length} checks` : 'QC';
  }
  return `${step.params.durationMinutes} min`;
}
```

Update the step type label in the render (line 54):

```tsx
<div className={`text-[13px] font-medium ${voided ? 'line-through text-[#5a5a5a]' : 'text-[#f5f5f5]'}`}>
  {step.type === 'add_material' ? 'Add Material' : step.type === 'qc_check' ? 'QC Check' : 'Mix Round'}
</div>
```

Add `QcCheckParams` import:

```ts
import type { MixingStep, MixingStepStatus, QcCheckParams } from '@/lib/types';
```

- [ ] **Step 7: Run tests and verify they pass**

Run: `npm test -- tests/sprint7/mixing-qc-step.spec.ts`
Expected: ALL PASS.

Then run: `npm test`
Expected: Full suite green. Existing mixing tests still pass — they don't create QC check steps.

- [ ] **Step 8: Commit**

```bash
git add lib/types.ts components/subbatch/add-step-modal.tsx components/mixing/mixing-workspace.tsx components/mixing/step-history.tsx tests/sprint7/mixing-qc-step.spec.ts
git commit -m "feat(mixing): add inline QC check step type to mixing workflow"
```

---

## Post-implementation checklist

After all tasks are complete:

- [ ] Run full test suite: `npm test` — all pass
- [ ] Update `docs/SESSION_LOG.md` with changes made
- [ ] Update `docs/FLINT_REFERENCE_21052026.md`:
  - §12 gap "Per-item QC checks (§4)": flip to 🟡 (numeric bounds done; per-item still partial)
  - §12 gap "Per-process parameter forms (§5.3–5.8)": update to note Coating/Calendaring/Die Cut done
  - §12 gap "QC integration into mixing operator workflow": flip to ✅ (qc_check step type done)
- [ ] Write `PHASE0_REPORT_LUTFIL.md` with confirmed file paths, schema verification, and per-task status
- [ ] Push branch, open PR into `dev` — **do not merge**
- [ ] Write `REPORT_LUTFIL.md` per the PR template
