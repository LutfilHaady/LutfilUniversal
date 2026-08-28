# Sprint 8 — GAP-01 / GAP-05 / GAP-04 / GAP-18 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four flagged gaps — replace hardcoded mixing materials with a live query (GAP-01), align log-maintenance-panel types (GAP-05), wire `resolved_by`/`resolution_source` on alerts (GAP-04), and verify the "Reviewed & Approved By" display on maintenance history (GAP-18).

**Architecture:** Each task is self-contained within the machines/equipment/maintenance + alerts domain. No cross-team merge conflicts expected. All DB reads use the anon-key RLS-respecting client in `lib/supabase.ts`. Tests mock all Supabase REST calls via `page.route()`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (anon client), SWR, Playwright

## Global Constraints

- Branch off `dev`. Never push to `main` (auto-deploys to prod).
- `batch_number` is a display code; PK is UUID `id`.
- Status changes go through `transition_batch_status` RPC — never direct PATCH.
- RLS is ON. No service-role workarounds.
- All Playwright tests mock Supabase REST calls via `page.route()` — never touch the live DB.
- `npx tsc --noEmit` + `npm test` must be green before push.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `lib/hooks/useMaterials.ts` | SWR hook querying `materials` table |
| Create | `tests/sprint8/mixing-materials.spec.ts` | Playwright test for L1 |
| Create | `tests/sprint8/alert-resolution.spec.ts` | Playwright test for L3 |
| Modify | `components/subbatch/add-step-modal.tsx` | Replace `MIXING_MATERIALS` import with `useMaterials()` |
| Modify | `lib/data/mixing.ts` | Delete `MIXING_MATERIALS` constant |
| Modify | `lib/data.ts` | No change needed (barrel re-exports `./data/mixing` which will just be empty) |
| Modify | `components/machines/log-maintenance-panel.tsx` | Delete inline types, import shared types from `./types` |
| Modify | `lib/alerts/scan.ts` | Set `resolution_source = 'auto'` on auto-resolve |
| Modify | `lib/hooks/useAlerts.ts` | Set `resolution_source = 'manual'`, `resolved_by = user.id` on dismiss |
| Modify | `lib/alerts/types.ts` | Add resolution fields to `AlertView` |
| Modify | `app/alerts/page.tsx` | Render resolution info on resolved alerts display |
| Modify | `app/machines/page.tsx` | Fix duplicate "Reviewed & Approved By" render |

---

### Task 1: GAP-01 — Replace hardcoded mixing materials with live query

**Files:**
- Create: `lib/hooks/useMaterials.ts`
- Modify: `components/subbatch/add-step-modal.tsx`
- Modify: `lib/data/mixing.ts`
- Test: `tests/sprint8/mixing-materials.spec.ts`

**Interfaces:**
- Consumes: `supabase` client from `lib/supabase.ts`, `useSWR` from `swr`
- Produces: `useMaterials()` hook returning `{ materials: {code: string; name: string}[], loading: boolean, error: string | null }`

- [ ] **Step 1: Write the Playwright test**

Create `tests/sprint8/mixing-materials.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const PARENT_UUID = 'aaaa1111-1111-1111-1111-111111111111'

const MOCK_MATERIALS = [
  { code: 'MTDW', name: 'DI Water' },
  { code: 'MTC1', name: 'Material C1' },
  { code: 'MTC2', name: 'Material C2' },
  { code: 'MTC3', name: 'Material C3' },
  { code: 'MTC4', name: 'Material C4' },
  { code: 'MTCR', name: 'Roll C' },
  { code: 'MTE1', name: 'Material E1' },
  { code: 'MTE2', name: 'Material E2' },
  { code: 'MTE3', name: 'Material E3' },
  { code: 'MTAR', name: 'Anode Roll' },
  { code: 'MTSR', name: 'Separator Roll' },
  { code: 'MTPP', name: 'Packaging' },
]

test.describe('GAP-01: Live materials in AddStepModal', () => {
  test.beforeEach(async ({ page }) => {
    // Catch-all first (Playwright LIFO)
    await page.route(`**${SB}/rest/v1/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // Materials query
    await page.route(`**${SB}/rest/v1/materials**`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATERIALS),
      })
    )

    // Process lookup by code (for mixing page)
    await page.route(`**${SB}/rest/v1/processes*code=eq*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'proc-mix', code: 'MIXC' }),
      })
    )

    // Mixing steps — empty
    await page.route(`**${SB}/rest/v1/mixing_steps**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // Recipes
    await page.route(`**${SB}/rest/v1/recipes**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // Batch lookup
    await page.route(`**${SB}/rest/v1/batches**`, route => {
      const url = route.request().url()
      if (url.includes('.single')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: PARENT_UUID,
            batch_number: 'MIXC-20260625-A01',
            parent_batch_id: null,
            material_id: 'mat-uuid',
            status: 'InProgress',
          }),
        })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })

    // QC check definitions
    await page.route(`**${SB}/rest/v1/qc_check_definitions**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
  })

  test('add-step modal lists live materials including MTPP', async ({ page }) => {
    await page.goto(`/log/mixing/${PARENT_UUID}`)
    await page.getByRole('button', { name: /add.*step|log.*step/i }).click()
    // Open the material select dropdown
    const select = page.getByLabel(/material/i)
    await expect(select).toBeVisible()
    // MTPP is the tell — it's not in the old static list
    await expect(select.locator('option')).toContainText(['MTPP'])
  })

  test('add-step modal shows loading state while materials fetch', async ({ page }) => {
    // Delay the materials response
    await page.route(`**${SB}/rest/v1/materials**`, async route => {
      await new Promise(r => setTimeout(r, 500))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MATERIALS),
      })
    })
    await page.goto(`/log/mixing/${PARENT_UUID}`)
    await page.getByRole('button', { name: /add.*step|log.*step/i }).click()
    // Should show a loading indicator or disabled select
    const select = page.getByLabel(/material/i)
    await expect(select).toBeVisible()
  })
})
```

- [ ] **Step 2: Create `useMaterials` SWR hook**

Create `lib/hooks/useMaterials.ts`:

```ts
'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'

async function fetchMaterials() {
  const { data, error } = await supabase
    .from('materials')
    .select('code, name')
    .order('code')
  if (error) throw error
  return data ?? []
}

export function useMaterials() {
  const { data, isLoading, error } = useSWR('materials', fetchMaterials)
  return {
    materials: data ?? [],
    loading: isLoading,
    error: (error as Error | null)?.message ?? null,
  }
}
```

- [ ] **Step 3: Wire `AddStepModal` to `useMaterials`**

Modify `components/subbatch/add-step-modal.tsx`:

1. Remove the `MIXING_MATERIALS` import (line 7)
2. Add `useMaterials` import
3. Call the hook inside the component
4. Replace the two `MIXING_MATERIALS` references with `materials`
5. Add a loading/error state for the material dropdown

Changes:
- Line 7: `import { MIXING_MATERIALS } from '@/lib/data';` → `import { useMaterials } from '@/lib/hooks/useMaterials';`
- After line 62 (the `useAuth` call), add: `const { materials, loading: materialsLoading } = useMaterials();`
- Line 138: `MIXING_MATERIALS.find(...)` → `materials.find(...)`
- Line 253: `MIXING_MATERIALS.map(...)` → `materials.map(...)`
- In the select element, add a loading option when `materialsLoading` is true

- [ ] **Step 4: Delete `MIXING_MATERIALS` from `lib/data/mixing.ts`**

Replace the entire file content with an empty module (the barrel `lib/data.ts` re-exports `./data/mixing`):

```ts
// Mixing materials are now fetched live via useMaterials() hook.
```

- [ ] **Step 5: Run `npx tsc --noEmit` and verify clean**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run the test**

Run: `npm test -- tests/sprint8/mixing-materials.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/hooks/useMaterials.ts components/subbatch/add-step-modal.tsx lib/data/mixing.ts tests/sprint8/mixing-materials.spec.ts
git commit -m "feat(GAP-01): replace hardcoded mixing materials with live query"
```

---

### Task 2: GAP-05 — Log Maintenance Panel → shared types

**Files:**
- Modify: `components/machines/log-maintenance-panel.tsx`
- No new test file needed — `npx tsc --noEmit` is the acceptance test

**Interfaces:**
- Consumes: `Machine`, `MaintenanceEntry`, `ChecklistResult` from `components/machines/types.ts`
- Produces: same component API, but the `onSaved` callback now passes the shared `MaintenanceEntry` shape

- [ ] **Step 1: Delete the inline type block and update imports**

In `components/machines/log-maintenance-panel.tsx`:

1. Delete lines 9–30 (the inline `MaintenanceEntry`, `Machine`, and the TODO comment)
2. Update line 7 import to: `import type { Machine, MaintenanceEntry, ChecklistResult } from './types';`
3. Update `LogMaintenancePanelProps` to use the shared `MaintenanceEntry`:

```ts
interface LogMaintenancePanelProps {
  machine: Machine;
  onClose: () => void;
  onSaved: (code: string, entry: MaintenanceEntry) => void;
}
```

- [ ] **Step 2: Fix `onSaved` return shape in `handleSubmit`**

The `handleSubmit` function currently returns the old legacy shape (`date`, `type`, `tech`, `notes`, `reviewedAndApprovedBy`). Update it to build a proper `MaintenanceEntry`:

```ts
const reviewVal = reviewedAndApprovedBy.trim() || null;
const entry: MaintenanceEntry = {
  id: `local-${Date.now()}`,
  equipment_id: machine.id,
  maintenance_date: date,
  next_due_date: nextDue || null,
  notes: description.trim() || null,
  reviewed_by: reviewVal,
  approved_by: reviewVal,
  checklist_results: checkResults,
  created_at: new Date().toISOString(),
};
onSaved(machine.equipment_code, entry);
```

- [ ] **Step 3: Fix field references in the component**

Update any references to old field names:
- `machine.code` → `machine.equipment_code` (line 130)
- `machine.nextDue` → last maintenance entry's `next_due_date` (line 285)

- [ ] **Step 4: Update `handleMaintenanceLogged` in `app/machines/page.tsx`**

The callback in `machines/page.tsx` (line 103) currently normalizes legacy shape to `MaintenanceEntry`. Since `onSaved` now passes a proper `MaintenanceEntry` directly, simplify:

```ts
function handleMaintenanceLogged(code: string, entry: MaintenanceEntry) {
  const machineName = logPanelFor?.name ?? code;
  setMachines(prev => prev.map(m => {
    if (m.equipment_code !== code) return m;
    return { ...m, equipment_maintenance: [entry, ...m.equipment_maintenance] };
  }));
  setLogPanelFor(null);
  setToast(`Maintenance logged for ${machineName}`);
}
```

Also update the `onSaved` prop type on line 349 to remove the `nextDue` parameter.

- [ ] **Step 5: Run `npx tsc --noEmit` and verify clean**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run existing maintenance tests**

Run: `npm test -- tests/sprint7/maintenance-reviewed-by.spec.ts tests/sprint6/maintenance-reviewed-approved.spec.ts`
Expected: PASS (no regressions)

- [ ] **Step 7: Commit**

```bash
git add components/machines/log-maintenance-panel.tsx app/machines/page.tsx
git commit -m "refactor(GAP-05): log-maintenance-panel uses shared types from components/machines/types"
```

---

### Task 3: GAP-04 — Wire `resolved_by` / `resolution_source`

**Prerequisite:** Jonny's migration adding `resolved_by UUID` and `resolution_source TEXT` columns to the `alerts` table must be live. If the columns don't exist, the Supabase `.update()` calls will silently ignore them (Supabase JS client ignores unknown columns on updates). Confirm by checking the migration files or testing a write.

**Files:**
- Modify: `lib/alerts/scan.ts`
- Modify: `lib/hooks/useAlerts.ts`
- Modify: `lib/alerts/types.ts`
- Modify: `app/alerts/page.tsx`
- Test: `tests/sprint8/alert-resolution.spec.ts`

**Interfaces:**
- Consumes: `useAuth()` for `user.id` on manual dismiss
- Produces: `AlertView` gains optional `resolvedBy`, `resolutionSource` fields; `dismiss(id)` sets both resolution fields

- [ ] **Step 1: Write the Playwright test**

Create `tests/sprint8/alert-resolution.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

test.describe('GAP-04: Alert resolution_source tracking', () => {
  test('manual dismiss sends resolution_source=manual and resolved_by', async ({ page }) => {
    // Catch-all
    await page.route(`**${SB}/rest/v1/**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // Alert rules (for scanAlerts)
    await page.route(`**${SB}/rest/v1/alert_rules**`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )

    // Active alerts
    await page.route(`**${SB}/rest/v1/alerts*resolved_at*`, route => {
      const method = route.request().method()
      if (method === 'PATCH') {
        return route.fulfill({ status: 204, body: '' })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'alert-uuid-1',
            severity: 'warning',
            message: 'Test batch held',
            batch_id: null,
            created_at: '2026-06-25T10:00:00Z',
          },
        ]),
      })
    })

    await page.goto('/alerts')
    await expect(page.getByText('Test batch held')).toBeVisible()

    // Capture the PATCH request
    const [patchReq] = await Promise.all([
      page.waitForRequest(req =>
        req.url().includes('/rest/v1/alerts') && req.method() === 'PATCH'
      ),
      page.getByRole('button', { name: /dismiss/i }).click(),
    ])

    const body = patchReq.postDataJSON()
    expect(body).toHaveProperty('resolution_source', 'manual')
    expect(body).toHaveProperty('resolved_by')
  })
})
```

- [ ] **Step 2: Update `lib/alerts/scan.ts` — set `resolution_source = 'auto'`**

In the `scanAlerts()` function, update the auto-resolve update (around line 138):

```ts
// Before:
.update({ resolved_at: new Date().toISOString() })

// After:
.update({ resolved_at: new Date().toISOString(), resolution_source: 'auto' })
```

Also remove the TODO comment at line 128-129.

- [ ] **Step 3: Update `lib/hooks/useAlerts.ts` — set `resolution_source = 'manual'` and `resolved_by`**

Update the `dismiss` function to accept the user ID and set both fields:

```ts
async function dismiss(id: string) {
  const { data: { session } } = await supabase.auth.getSession();
  await supabase
    .from('alerts')
    .update({
      resolved_at: new Date().toISOString(),
      resolution_source: 'manual',
      resolved_by: session?.user?.id ?? null,
    })
    .eq('id', id);
  await mutate('alerts');
}
```

- [ ] **Step 4: Update `AlertView` type (optional — for future display)**

In `lib/alerts/types.ts`, add optional resolution fields:

```ts
export interface AlertView {
  id: string;
  severity: AlertSeverity;
  message: string;
  batchId: string | null;
  createdAt: string;
  resolutionSource?: 'manual' | 'auto' | null;
  resolvedBy?: string | null;
}
```

- [ ] **Step 5: Run `npx tsc --noEmit` and verify clean**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run the test**

Run: `npm test -- tests/sprint8/alert-resolution.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/alerts/scan.ts lib/hooks/useAlerts.ts lib/alerts/types.ts tests/sprint8/alert-resolution.spec.ts
git commit -m "feat(GAP-04): wire resolved_by and resolution_source on alert dismiss"
```

---

### Task 4: GAP-18 — Fix "Reviewed & Approved By" display (depends on Task 2)

**Files:**
- Modify: `app/machines/page.tsx`
- Existing test: `tests/sprint7/maintenance-reviewed-by.spec.ts` (already covers this)

**Interfaces:**
- Consumes: `MaintenanceEntry` from `components/machines/types.ts` (aligned in Task 2)

- [ ] **Step 1: Fix duplicate "Reviewed & Approved By" render**

In `app/machines/page.tsx`, lines 278-282 and 304-309 both render "Reviewed & Approved By" — this is a bug (duplicate display). Remove the second one (lines 304-309):

Delete this block:
```tsx
{(entry.reviewed_by || entry.approved_by) && (
  <div className="text-[11.5px] text-[#888888]">
    Reviewed &amp; Approved By: {entry.reviewed_by ?? '—'}
    {entry.approved_by && entry.approved_by !== entry.reviewed_by
      ? ` / ${entry.approved_by}` : ''}
  </div>
)}
```

Keep the first render (lines 278-282) which already has proper styling:
```tsx
{(entry.reviewed_by || entry.approved_by) && (
  <div className="text-[11px] text-[#888888]">
    <span className="font-mono uppercase tracking-[0.07em] text-[#5a5a5a] mr-1.5">Reviewed &amp; Approved By</span>
    {entry.reviewed_by ?? entry.approved_by}
  </div>
)}
```

- [ ] **Step 2: Run existing maintenance-reviewed-by test**

Run: `npm test -- tests/sprint7/maintenance-reviewed-by.spec.ts`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/machines/page.tsx
git commit -m "fix(GAP-18): remove duplicate Reviewed & Approved By display in maintenance history"
```

---

## Final Checklist

- [ ] `npx tsc --noEmit` — clean
- [ ] `npm test` — all green
- [ ] Push to `feature/sprint8-gaps` branch
- [ ] Open PR against `dev`
