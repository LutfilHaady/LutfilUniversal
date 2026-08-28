# Sprint 5 (Lutfil) — Recipe Amounts + Mixing Ratio Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-material `amount_kg` ratio field (default 1) to Mixing recipe parameters, then build a Mixing Ratio Calculator that uses those ratios to compute per-material quantities for a target batch size on the mixing operator page.

**Architecture:** Both features live entirely in the existing recipe-params JSONB pipeline (`recipes.params.mixing_steps[]`, already wired since 2026-06-02 — see `docs/FLINT_REFERENCE_21052026.md` §7.4). PR 1 extends the generic `ParamColumn`/`RecipeDraft` machinery with a `default` value so the Mixing recipe form gains an "Amount (kg)" column per material row. PR 2 adds a new presentational component that fetches the active Mixing recipe for a batch's process, reads `mixing_steps[].amount_kg` as ratio weights, and renders a live quantity table on `/log/mixing/[batchId]`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Supabase JS client, Playwright (`@playwright/test`).

---

## Scope notes — read first

This plan was written after auditing `dev` (fast-forwarded to `6df86ec`) against `sprint5_lutfil.md`:

- **L-1 `recipe-amounts-active`**: the **active-toggle half is already shipped** (`app/recipes/page.tsx` `flipActive()` PATCHes `recipes.is_active`; `tests/sprint4/recipes-toggle.spec.ts` covers it). This plan implements **only the remaining piece — per-material amounts**.
- **L-2 `log-run-closure`** and **L-3 `log-recipe-selector`**: confirmed already fully implemented and tested in `dev` (`app/log/process-step/page.tsx` writes `equipment_id`/`recipe_id`, has the calibration gate, stamps `end_date`/`end_time`/`AwaitingQC`, and fetches **all** `is_active` recipes for the process — `tests/sprint4/process-step-logging.spec.ts`). **No tasks for these in this plan** (per user decision 2026-06-11).
- **L-5 `log-mixing-step-qc`**: explicitly gated on confirming the QC/sub-batch model with Jonathan. **Not planned here** — plan separately once the model is confirmed.
- **Schema correction applied**: the sprint doc said amounts go via `recipe_parameters` (EAV). Per `docs/FLINT_REFERENCE_21052026.md` §7.4, the recipe write path uses `recipes.params` JSONB only — `recipe_parameters` is dead. This plan stores `amount_kg` inside `recipes.params.mixing_steps[]`, consistent with every other Mixing recipe field.

This plan covers two PRs:
- **PR 1 — `lutfil/recipe-amounts-active`** (do first, merge to `dev` before PR 2)
- **PR 2 — `lutfil/log-ratio-calculator`** (branch from `dev` after PR 1 is merged)

---

## File structure

| File | Change |
|---|---|
| `lib/types.ts` | Add optional `default?: string` to `ParamColumn` (PR 1) |
| `lib/constants.ts` | Add `amount_kg` column to Mixing's `mixing_steps` rows field (PR 1) |
| `lib/recipe-params.ts` | `emptyRow` / `initDraft` apply column `default` (PR 1) |
| `playwright.config.ts` | Add `sprint5` project (PR 1) |
| `tests/sprint5/recipe-amounts.spec.ts` | New — covers PR 1 |
| `components/log/mixing-ratio-calculator.tsx` | New — ratio calculator card (PR 2) |
| `components/mixing/mixing-operator-page.tsx` | Resolve `processId`, render calculator (PR 2) |
| `tests/sprint5/mixing-ratio-calculator.spec.ts` | New — covers PR 2 |
| `docs/SESSION_LOG.md` | Append session entries (both PRs) |
| `docs/FLINT_REFERENCE_21052026.md` | Targeted updates (both PRs) |

---

# PR 1 — `lutfil/recipe-amounts-active`

**Branch:** `git checkout dev && git pull && git checkout -b lutfil/recipe-amounts-active`

### Task 1: Add the `sprint5` Playwright project

**Files:**
- Modify: `playwright.config.ts:26-34`

- [ ] **Step 1: Add a `sprint5` project block alongside `sprint4`**

In `playwright.config.ts`, after the `sprint4` project block (lines 26-34), add:

```ts
    {
      name: 'sprint4',
      testDir: './tests/sprint4',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'sprint5',
      testDir: './tests/sprint5',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/engineer.json',
      },
      dependencies: ['setup'],
    },
```

(i.e. insert a new `sprint5` object after the existing `sprint4` object, same shape.)

- [ ] **Step 2: Commit**

```bash
git add playwright.config.ts
git commit -m "test: add sprint5 Playwright project"
```

---

### Task 2: Write the failing test for per-material amounts

**Files:**
- Create: `tests/sprint5/recipe-amounts.spec.ts`

- [ ] **Step 1: Write the test file**

```ts
/**
 * Sprint 5 (Lutfil) — Recipe per-material amounts (L-1 remainder)
 *
 * Tests cover:
 *  - New Mixing recipe — adding a Material Step row defaults Amount to 1 kg
 *  - Saving persists the entered amount into recipes.params.mixing_steps[].amount_kg
 *  - Editing an existing recipe pre-fills Amount from saved params
 *  - Editing a legacy recipe missing amount_kg defaults the field to 1
 *
 * Supabase REST calls are mocked at the network layer — no test data written.
 * /rest/v1/users is left real so auth context resolves the Engineer role.
 */

import { test, expect, type Page, type Locator } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const PROCESSES = [
  { id: 'proc-mixc-id', name: 'Mixing (Cathode)' },
  { id: 'proc-mixe-id', name: 'Mixing (Electrolyte)' },
]

function fieldInput(page: Page, labelText: string): Locator {
  return page.locator('div.flex.flex-col.gap-1', { hasText: labelText }).locator('input')
}

async function mockProcesses(page: Page) {
  await page.route(`**${SB}/rest/v1/processes**`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROCESSES) })
  )
}

test('new Mixing recipe — Amount defaults to 1 kg and the entered value is saved', async ({ page }) => {
  await mockProcesses(page)

  await page.route(`**${SB}/rest/v1/recipes**`, async route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'new-recipe-id', name: 'Cathode Mix Test', version: '1.0',
          process_id: 'proc-mixc-id', created_by: null, parent_recipe_id: null,
          is_active: true, created_at: '2026-06-11', notes: null,
          params: { mixing_steps: [{ material: 'Cathode Material C1', amount_kg: 2, mixing_time_hr: 1, temperature_c: 1, internal_pressure_bar: 1, dispersion_rpm: 1, propeller_rpm: 1, target_viscosity_mpas: 1 }] },
        }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.goto('/recipes')
  await expect(page.getByText('No recipes found')).toBeVisible()

  await page.getByRole('button', { name: /New Recipe/i }).click()
  await page.getByPlaceholder('e.g. Standard Cathode Coat v4').fill('Cathode Mix Test')
  await page.getByRole('button', { name: /Next: Set Parameters/i }).click()

  await page.getByRole('button', { name: /Add Material Step/i }).click()

  // New row defaults Amount to 1
  await expect(fieldInput(page, 'Amount (kg)')).toHaveValue('1')

  await fieldInput(page, 'Material').fill('Cathode Material C1')
  await fieldInput(page, 'Mixing Time (hr)').fill('1')
  await fieldInput(page, 'Temperature (°C)').fill('1')
  await fieldInput(page, 'Internal Pressure (bar)').fill('1')
  await fieldInput(page, 'Dispersion RPM (rpm)').fill('1')
  await fieldInput(page, 'Propeller RPM (rpm)').fill('1')
  await fieldInput(page, 'Target Viscosity (mPa·s)').fill('1')
  await fieldInput(page, 'Amount (kg)').fill('2')

  const [postReq] = await Promise.all([
    page.waitForRequest(req => req.url().includes('/rest/v1/recipes') && req.method() === 'POST'),
    page.getByRole('button', { name: /Save Recipe/i }).click(),
  ])

  const body = JSON.parse(postReq.postData() ?? '{}')
  expect(body.params.mixing_steps[0].amount_kg).toBe(2)
  expect(body.params.mixing_steps[0].material).toBe('Cathode Material C1')
})

test('editing an existing recipe pre-fills Amount from saved params (defaults to 1 if missing)', async ({ page }) => {
  await mockProcesses(page)

  const ROW_WITH_AMOUNT = { material: 'Cathode Material C1', amount_kg: 5, mixing_time_hr: 2, temperature_c: 60, internal_pressure_bar: 1, dispersion_rpm: 1000, propeller_rpm: 500, target_viscosity_mpas: 2000 }
  const ROW_WITHOUT_AMOUNT = { material: 'Cathode Material C2', mixing_time_hr: 2, temperature_c: 60, internal_pressure_bar: 1, dispersion_rpm: 1000, propeller_rpm: 500, target_viscosity_mpas: 2000 }

  await page.route(`**${SB}/rest/v1/recipes**`, async route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'r1', name: 'Cathode Mix A', recipe_number: 'RCP-010', version: '1.0',
          process_id: 'proc-mixc-id', is_active: true, notes: null, created_at: '2026-06-01',
          created_by: null, parent_recipe_id: null,
          process: { name: 'Mixing (Cathode)', code: 'MIXC' },
          creator: { full_name: 'Dev Engineer' },
          params: { mixing_steps: [ROW_WITH_AMOUNT] },
        },
        {
          id: 'r2', name: 'Cathode Mix B', recipe_number: 'RCP-011', version: '1.0',
          process_id: 'proc-mixc-id', is_active: true, notes: null, created_at: '2026-06-01',
          created_by: null, parent_recipe_id: null,
          process: { name: 'Mixing (Cathode)', code: 'MIXC' },
          creator: { full_name: 'Dev Engineer' },
          params: { mixing_steps: [ROW_WITHOUT_AMOUNT] },
        },
      ]),
    })
  )

  // Recipe with amount_kg=5 saved
  await page.goto('/recipes')
  await page.getByText('Cathode Mix A').click()
  await page.getByRole('button', { name: /Edit Parameters/i }).click()
  await page.getByRole('button', { name: /Next: Set Parameters/i }).click()
  await expect(fieldInput(page, 'Amount (kg)')).toHaveValue('5')

  // Recipe with no amount_kg saved -> defaults to 1
  await page.goto('/recipes')
  await page.getByText('Cathode Mix B').click()
  await page.getByRole('button', { name: /Edit Parameters/i }).click()
  await page.getByRole('button', { name: /Next: Set Parameters/i }).click()
  await expect(fieldInput(page, 'Amount (kg)')).toHaveValue('1')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test tests/sprint5/recipe-amounts.spec.ts --project=sprint5`

Expected: Both tests FAIL — `fieldInput(page, 'Amount (kg)')` finds no matching element, because no `amount_kg` column exists yet in `PROCESS_PARAM_FIELDS['Mixing']`.

---

### Task 3: Implement the `amount_kg` column with a default value

**Files:**
- Modify: `lib/types.ts:129-134`
- Modify: `lib/constants.ts:104-112`
- Modify: `lib/recipe-params.ts:21-31` and `lib/recipe-params.ts:37-41`

- [ ] **Step 1: Add `default` to `ParamColumn`**

In `lib/types.ts`, replace lines 129-134:

```ts
export interface ParamColumn {
  key: string;                 // JSONB key inside each row object, e.g. 'mixing_time_hr'
  label: string;
  unit?: string;
  type?: 'number' | 'text';    // default 'number'; the material column is 'text'
}
```

with:

```ts
export interface ParamColumn {
  key: string;                 // JSONB key inside each row object, e.g. 'mixing_time_hr'
  label: string;
  unit?: string;
  type?: 'number' | 'text';    // default 'number'; the material column is 'text'
  default?: string;            // pre-filled value for new rows and legacy rows missing this key
}
```

- [ ] **Step 2: Add the `amount_kg` column to Mixing's `mixing_steps` rows field**

In `lib/constants.ts`, replace lines 104-112:

```ts
      columns: [
        { key: 'material',              label: 'Material',          type: 'text' },
        { key: 'mixing_time_hr',        label: 'Mixing Time',       unit: 'hr'    },
        { key: 'temperature_c',         label: 'Temperature',       unit: '°C'    },
        { key: 'internal_pressure_bar', label: 'Internal Pressure', unit: 'bar'   },
        { key: 'dispersion_rpm',        label: 'Dispersion RPM',    unit: 'rpm'   },
        { key: 'propeller_rpm',         label: 'Propeller RPM',     unit: 'rpm'   },
        { key: 'target_viscosity_mpas', label: 'Target Viscosity',  unit: 'mPa·s' },
      ],
```

with:

```ts
      columns: [
        { key: 'material',              label: 'Material',          type: 'text' },
        { key: 'amount_kg',             label: 'Amount',             unit: 'kg', default: '1' },
        { key: 'mixing_time_hr',        label: 'Mixing Time',       unit: 'hr'    },
        { key: 'temperature_c',         label: 'Temperature',       unit: '°C'    },
        { key: 'internal_pressure_bar', label: 'Internal Pressure', unit: 'bar'   },
        { key: 'dispersion_rpm',        label: 'Dispersion RPM',    unit: 'rpm'   },
        { key: 'propeller_rpm',         label: 'Propeller RPM',     unit: 'rpm'   },
        { key: 'target_viscosity_mpas', label: 'Target Viscosity',  unit: 'mPa·s' },
      ],
```

- [ ] **Step 3: Apply the column default in `emptyRow`**

In `lib/recipe-params.ts`, replace lines 37-41:

```ts
// A blank row with every column key present and empty.
export function emptyRow(columns: ParamColumn[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of columns) out[c.key] = '';
  return out;
}
```

with:

```ts
// A blank row with every column key present, pre-filled with its default (or empty).
export function emptyRow(columns: ParamColumn[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of columns) out[c.key] = c.default ?? '';
  return out;
}
```

- [ ] **Step 4: Apply the column default in `initDraft` for legacy rows**

In `lib/recipe-params.ts`, replace lines 21-31:

```ts
    } else {
      const rows = Array.isArray(params?.[f.key]) ? (params![f.key] as Record<string, unknown>[]) : [];
      draft[f.key] = rows.map(row => {
        const out: Record<string, string> = {};
        for (const c of f.columns) {
          const v = row?.[c.key];
          out[c.key] = v === undefined || v === null ? '' : String(v);
        }
        return out;
      });
    }
```

with:

```ts
    } else {
      const rows = Array.isArray(params?.[f.key]) ? (params![f.key] as Record<string, unknown>[]) : [];
      draft[f.key] = rows.map(row => {
        const out: Record<string, string> = {};
        for (const c of f.columns) {
          const v = row?.[c.key];
          out[c.key] = v === undefined || v === null ? (c.default ?? '') : String(v);
        }
        return out;
      });
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx playwright test tests/sprint5/recipe-amounts.spec.ts --project=sprint5`

Expected: Both tests PASS.

- [ ] **Step 6: Run the full suite to check for regressions**

Run: `npm test`

Expected: All previously-passing tests still pass (sprint3 + sprint4 + sprint5), no new failures. `tests/sprint4/recipes-toggle.spec.ts` and any recipe-panel tests should be unaffected since `amount_kg` is additive.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/constants.ts lib/recipe-params.ts tests/sprint5/recipe-amounts.spec.ts
git commit -m "feat(recipes): per-material amount (default 1kg) for Mixing recipes"
```

---

### Task 4: Update docs and push

**Files:**
- Modify: `docs/SESSION_LOG.md`
- Modify: `docs/FLINT_REFERENCE_21052026.md`

- [ ] **Step 1: Append a session log entry**

Append to `docs/SESSION_LOG.md`:

```markdown
## [2026-06-11] — Sprint 5 (Lutfil) L-1: per-material recipe amounts
- What changed: `lib/types.ts` (`ParamColumn.default`), `lib/constants.ts` (added `amount_kg` column to Mixing `mixing_steps`, default '1'), `lib/recipe-params.ts` (`emptyRow`/`initDraft` apply column defaults), `playwright.config.ts` (new `sprint5` project), `tests/sprint5/recipe-amounts.spec.ts` (2 tests).
- Gaps closed: L-1 per-material amounts (recipe-amounts-active) — active-toggle half was already done in dev.
- New gaps found: none.
- Ref doc updated: yes
```

- [ ] **Step 2: Update the reference doc**

In `docs/FLINT_REFERENCE_21052026.md`, update the **Last updated** line at the top of the file (line 6) to prepend a new entry, e.g. change:

```
**Last updated:** 2026-06-09 — Camera init fix: ...
```

to:

```
**Last updated:** 2026-06-11 — Sprint 5 (Lutfil) L-1: Mixing recipes gain a per-material `amount_kg` field (default 1) in `recipes.params.mixing_steps[]` — `ParamColumn` gained an optional `default`, applied by `emptyRow`/`initDraft` in `lib/recipe-params.ts`; `tests/sprint5/recipe-amounts.spec.ts` (2 tests). Recipe active-toggle (the other half of L-1) was already shipped 2026-06-05. — Prior: 2026-06-09 — Camera init fix: ...
```

(i.e. prepend the new bullet and keep the existing text after it, joined with " — Prior: ".)

- [ ] **Step 3: Commit docs and push the branch**

```bash
git add docs/SESSION_LOG.md docs/FLINT_REFERENCE_21052026.md
git commit -m "docs: log sprint5 L-1 recipe amounts session"
git push -u origin lutfil/recipe-amounts-active
```

Open a PR into `dev` titled `feat(recipes): material amounts + active-toggle` (the active-toggle half is already merged in `dev` — note this in the PR description so reviewers aren't confused by the title vs. diff).

---

# PR 2 — `lutfil/log-ratio-calculator`

**Branch (after PR 1 is merged into `dev`):** `git checkout dev && git pull && git checkout -b lutfil/log-ratio-calculator`

### Task 1: Write the failing test for the ratio calculator

**Files:**
- Create: `tests/sprint5/mixing-ratio-calculator.spec.ts`

- [ ] **Step 1: Write the test file**

```ts
/**
 * Sprint 5 (Lutfil) — Mixing Ratio Calculator (L-4)
 *
 * Tests cover:
 *  - Calculator renders on /log/mixing/[batchId] and is collapsed by default
 *  - Expanding it shows the active recipe's material ratios
 *  - Entering a total batch size computes per-material quantities from the ratios
 *
 * Supabase REST calls are mocked at the network layer — no test data written.
 * /rest/v1/users is left real so auth context resolves the Engineer role.
 */

import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  batchUuid: '11111111-1111-1111-1111-111111111111',
  batchNum:  'MIXC-20260601-A01',
  procId:    '33333333-3333-3333-3333-333333333333',
  recipeId:  '55555555-5555-5555-5555-555555555555',
}

const RECIPE_ROWS = [
  { material: 'Cathode Material C1', amount_kg: 1, mixing_time_hr: 1, temperature_c: 1, internal_pressure_bar: 1, dispersion_rpm: 1, propeller_rpm: 1, target_viscosity_mpas: 1 },
  { material: 'DI Water',            amount_kg: 2, mixing_time_hr: 1, temperature_c: 1, internal_pressure_bar: 1, dispersion_rpm: 1, propeller_rpm: 1, target_viscosity_mpas: 1 },
  { material: 'Material E1',         amount_kg: 3, mixing_time_hr: 1, temperature_c: 1, internal_pressure_bar: 1, dispersion_rpm: 1, propeller_rpm: 1, target_viscosity_mpas: 1 },
]

async function setupMocks(page: Page) {
  // Batch lookup by batch_number
  await page.route(`**${SB}/rest/v1/batches**`, async route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: M.batchUuid, batch_number: M.batchNum }),
    })
  )

  // Mixing steps — none yet
  await page.route(`**${SB}/rest/v1/mixing_steps**`, async route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  )

  // Process lookup by code (MIXC)
  await page.route(`**${SB}/rest/v1/processes**`, async route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: M.procId }),
    })
  )

  // Active recipe for this process, with mixing_steps ratios
  await page.route(`**${SB}/rest/v1/recipes**`, async route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: M.recipeId, recipe_number: 'RCP-020', version: '1.0', params: { mixing_steps: RECIPE_ROWS } },
      ]),
    })
  )
}

test('ratio calculator computes per-material quantities from recipe ratios', async ({ page }) => {
  await setupMocks(page)

  await page.goto(`/log/mixing/${M.batchNum}`)

  const header = page.getByRole('button', { name: /Mixing Ratio Calculator/i })
  await expect(header).toBeVisible()

  // Table not visible until expanded
  await expect(page.getByText('Total Batch Size (kg)')).not.toBeVisible()

  await header.click()
  await expect(page.getByText('Total Batch Size (kg)')).toBeVisible()

  await page.getByPlaceholder('0.0').fill('6')

  const rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('Cathode Material C1')
  await expect(rows.nth(0)).toContainText('1.00')
  await expect(rows.nth(1)).toContainText('DI Water')
  await expect(rows.nth(1)).toContainText('2.00')
  await expect(rows.nth(2)).toContainText('Material E1')
  await expect(rows.nth(2)).toContainText('3.00')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/sprint5/mixing-ratio-calculator.spec.ts --project=sprint5`

Expected: FAIL — `getByRole('button', { name: /Mixing Ratio Calculator/i })` finds nothing, since the component doesn't exist yet.

---

### Task 2: Create the `MixingRatioCalculator` component

**Files:**
- Create: `components/log/mixing-ratio-calculator.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';

interface RatioRow {
  material: string;
  amountKg: number;
}

interface RecipeOption {
  id: string;
  recipe_number: string | null;
  version: string;
  rows: RatioRow[];
}

interface Props {
  processId: string | null;
}

function toRatioRows(params: Record<string, unknown> | null | undefined): RatioRow[] {
  const steps = Array.isArray(params?.mixing_steps) ? (params!.mixing_steps as Record<string, unknown>[]) : [];
  return steps
    .map(s => ({ material: String(s.material ?? ''), amountKg: Number(s.amount_kg ?? 0) }))
    .filter(r => r.material !== '' && r.amountKg > 0);
}

export function MixingRatioCalculator({ processId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [totalSize, setTotalSize] = useState('');

  useEffect(() => {
    if (!processId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('recipes')
      .select('id, recipe_number, version, params')
      .eq('process_id', processId)
      .eq('is_active', true)
      .then(({ data }) => {
        if (cancelled) return;
        const opts = (data ?? []).map(r => ({
          id: r.id as string,
          recipe_number: r.recipe_number as string | null,
          version: r.version as string,
          rows: toRatioRows(r.params as Record<string, unknown> | null),
        }));
        setRecipes(opts);
        setSelectedId(opts[0]?.id ?? '');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [processId]);

  const selected = recipes.find(r => r.id === selectedId) ?? null;
  const ratioSum = selected ? selected.rows.reduce((sum, r) => sum + r.amountKg, 0) : 0;
  const total = parseFloat(totalSize);
  const hasTotal = totalSize.trim() !== '' && !Number.isNaN(total) && total > 0;

  return (
    <div className="mx-5 mt-3 rounded-xl border border-[#1e1e1e] bg-[#0e0e0e] shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[12.5px] font-semibold text-[#f5f5f5]">Mixing Ratio Calculator</span>
        <span className="text-[11px] font-mono text-[#5a5a5a]">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {loading ? (
            <div className="text-[12px] text-[#5a5a5a]">Loading recipe…</div>
          ) : recipes.length === 0 ? (
            <div className="text-[12px] text-[#5a5a5a]">No active recipe configured for this process.</div>
          ) : (
            <>
              {recipes.length > 1 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">Recipe</label>
                  <select
                    value={selectedId}
                    onChange={e => setSelectedId(e.target.value)}
                    className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e]"
                  >
                    {recipes.map(r => (
                      <option key={r.id} value={r.id}>{r.recipe_number ?? r.id} v{r.version}</option>
                    ))}
                  </select>
                </div>
              )}

              {ratioSum === 0 ? (
                <div className="text-[12px] text-[#5a5a5a]">Recipe has no per-material ratios configured.</div>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#5a5a5a]">
                      Total Batch Size (kg)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={totalSize}
                      onChange={e => setTotalSize(e.target.value)}
                      placeholder="0.0"
                      className="h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[13px] text-[#f5f5f5] outline-none focus:border-[#22c55e]"
                    />
                  </div>

                  <div className="rounded-lg border border-[#1e1e1e] overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[#111]">
                          <th className="px-3 py-2 text-[10px] font-mono text-[#5a5a5a]">Material</th>
                          <th className="px-3 py-2 text-[10px] font-mono text-[#5a5a5a]">Ratio (kg)</th>
                          <th className="px-3 py-2 text-[10px] font-mono text-[#5a5a5a]">Quantity (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected!.rows.map((r, i) => {
                          const qty = hasTotal ? (r.amountKg / ratioSum) * total : null;
                          return (
                            <tr key={i} className="border-t border-[#1a1a1a]">
                              <td className="px-3 py-2 text-[12px] text-[#f5f5f5]">{r.material}</td>
                              <td className="px-3 py-2 text-[12px] font-mono text-[#888888]">{r.amountKg}</td>
                              <td className="px-3 py-2 text-[12px] font-mono text-[#f5f5f5]">
                                {qty === null ? '—' : qty.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/log/mixing-ratio-calculator.tsx
git commit -m "feat(log): add MixingRatioCalculator component"
```

---

### Task 3: Wire the calculator into the mixing operator page

**Files:**
- Modify: `components/mixing/mixing-operator-page.tsx`

- [ ] **Step 1: Import the component**

In `components/mixing/mixing-operator-page.tsx`, after line 8:

```ts
import { AddStepModal } from '@/components/subbatch/add-step-modal';
```

add:

```ts
import { MixingRatioCalculator } from '@/components/log/mixing-ratio-calculator';
```

- [ ] **Step 2: Add `processId` state**

After line 62:

```ts
  const [actionError, setActionError] = useState<string | null>(null);
```

add:

```ts
  const [processId, setProcessId] = useState<string | null>(null);
```

- [ ] **Step 3: Resolve the process id from the batch number prefix**

In the `init()` function, after line 99 (`setBatchUuid(uuid);`), insert a process lookup before `await fetchSteps(uuid);`:

Replace:

```ts
      const uuid = (batch as { id: string }).id;
      setBatchUuid(uuid);
      await fetchSteps(uuid);
      if (!cancelled) setLoading(false);
```

with:

```ts
      const uuid = (batch as { id: string }).id;
      setBatchUuid(uuid);

      const code = batchId.slice(0, 4);
      const { data: proc } = await supabase
        .from('processes')
        .select('id')
        .eq('code', code)
        .single();
      if (!cancelled && proc) setProcessId((proc as { id: string }).id);

      await fetchSteps(uuid);
      if (!cancelled) setLoading(false);
```

- [ ] **Step 4: Render the calculator below the header**

The header block currently ends and the error banner begins like this (around lines 178-196):

```tsx
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1a1a] shrink-0">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#f5f5f5] hover:bg-[#161616] transition-colors"
          >
            <IconChevronLeft size={22} />
          </button>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Mixing Log</div>
            <div className="text-[15px] font-semibold text-[#f5f5f5] font-mono">{batchId}</div>
          </div>
        </div>

        {/* Error banner */}
        {actionError && (
```

Insert `<MixingRatioCalculator processId={processId} />` between the header `</div>` and the error banner comment:

```tsx
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1a1a] shrink-0">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#f5f5f5] hover:bg-[#161616] transition-colors"
          >
            <IconChevronLeft size={22} />
          </button>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a]">Mixing Log</div>
            <div className="text-[15px] font-semibold text-[#f5f5f5] font-mono">{batchId}</div>
          </div>
        </div>

        <MixingRatioCalculator processId={processId} />

        {/* Error banner */}
        {actionError && (
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test tests/sprint5/mixing-ratio-calculator.spec.ts --project=sprint5`

Expected: PASS.

- [ ] **Step 6: Run the full suite to check for regressions**

Run: `npm test`

Expected: All previously-passing tests still pass (sprint3 + sprint4 + sprint5).

- [ ] **Step 7: Commit**

```bash
git add components/mixing/mixing-operator-page.tsx
git commit -m "feat(log): show mixing ratio calculator on the mixing operator page"
```

---

### Task 4: Update docs and push

**Files:**
- Modify: `docs/SESSION_LOG.md`
- Modify: `docs/FLINT_REFERENCE_21052026.md`

- [ ] **Step 1: Append a session log entry**

Append to `docs/SESSION_LOG.md`:

```markdown
## [2026-06-11] — Sprint 5 (Lutfil) L-4: mixing ratio calculator
- What changed: `components/log/mixing-ratio-calculator.tsx` (new) — fetches the active recipe for the batch's process, reads `params.mixing_steps[].amount_kg` ratios, computes per-material quantities for an operator-entered total batch size; wired into `components/mixing/mixing-operator-page.tsx` (resolves `processId` from the batch_number's process code, e.g. MIXC/MIXE); `tests/sprint5/mixing-ratio-calculator.spec.ts` (1 test).
- Gaps closed: L-4 mixing ratio calculator (depends on L-1 amount_kg, merged earlier this sprint).
- New gaps found: none — recipe selector only shown when >1 active recipe exists for the process; calculator hides its table if the recipe has no configured ratios.
- Ref doc updated: yes
```

- [ ] **Step 2: Update the reference doc**

In `docs/FLINT_REFERENCE_21052026.md`, prepend to the **Last updated** line at the top of the file (line 6):

```
**Last updated:** 2026-06-11 — Sprint 5 (Lutfil) L-4: Mixing Ratio Calculator added (`components/log/mixing-ratio-calculator.tsx`, shown on `/log/mixing/[batchId]`) — fetches the active recipe for the batch's process and computes per-material quantities from `recipes.params.mixing_steps[].amount_kg` ratios against an operator-entered total batch size; `tests/sprint5/mixing-ratio-calculator.spec.ts`. — Prior: 2026-06-11 — Sprint 5 (Lutfil) L-1: ...
```

(i.e. prepend the new bullet, keeping the L-1 entry and everything after it joined with " — Prior: ").

Also add a row to the §11 feature table (around line 604, "Mixing operator page" row) — after that row, add:

```
| Mixing Ratio Calculator | ✅ | ✅ | Added 2026-06-11 — `/log/mixing/[batchId]` shows a collapsible card that reads the active recipe's `mixing_steps[].amount_kg` ratios and computes per-material quantities for an entered total batch size |
```

- [ ] **Step 3: Commit docs and push the branch**

```bash
git add docs/SESSION_LOG.md docs/FLINT_REFERENCE_21052026.md
git commit -m "docs: log sprint5 L-4 ratio calculator session"
git push -u origin lutfil/log-ratio-calculator
```

Open a PR into `dev` titled `feat(log): mixing ratio calculator`.

---

## Follow-up (not in this plan)

- **L-5 `log-mixing-step-qc`**: confirm with Jonathan whether each material mix becomes its own real sub-batch + `process_run`, or QC rows linked to `mixing_steps` via the existing `'qc_check'` step type — then write a separate plan.
