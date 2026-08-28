# Materials Management & Stock Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/materials` page for master-data management and stock visibility, thread a configurable `suffix` field through the sub-batch ID generation pipeline, and fix the `A01` → `AXX` sequence placeholder in the Create Sub-batch drawer.

**Architecture:** A DB migration adds `suffix TEXT` to `materials` and a `material_stock_totals` view (parent-batch stock per material). `useMaterials` widens its select to `*` and joins the view via a parallel SWR fetch, exposing a typed `Material` interface to all consumers. The `/materials` page is a new Next.js App Router client component with KPI cards, a data grid, and an inline Register/Edit modal. No new routes or wrappers are needed.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase JS client, SWR, Playwright for tests.

## Global Constraints

- Never query by `batch_number` as a primary key; always use UUID `id`.
- All Supabase calls use the anon client from `lib/supabase.ts` (RLS enforces role access).
- `npm test` must stay green before any push to `dev`.
- Mock all Supabase REST calls in Playwright tests with `page.route()` — never write to the live DB in tests.
- Do **not** mock `/rest/v1/users` — the auth context must resolve the real role.
- Catch-all mocks (`**supabase.co/rest/v1/**`) must never intercept `/rest/v1/users`.
- TypeScript: run `npx tsc --noEmit` after any type-touching change to confirm no regressions.
- Tailwind CSS v4: use inline `style` props for one-off hex colors not in the design system.
- Match the existing dark-theme component style: `bg-[#161616]`, `border-[#2a2a2a]`, `text-[#f5f5f5]` etc.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260629163236_add_materials_suffix_and_policies.sql` | Create | `suffix` column, updated RPC, stock view, RLS policies |
| `lib/hooks/useMaterials.ts` | Modify | Widen select to `*`, join stock view, export `Material` type |
| `components/icons.tsx` | Modify | Add `IconMaterials` |
| `components/sidebar.tsx` | Modify | Add Materials nav entry for all roles |
| `components/batches/create-subbatch-drawer.tsx` | Modify | `parentMaterialSuffix` prop, `AXX` placeholder |
| `app/batches/[id]/page.tsx` | Modify | Pass `suffix` from materials join to drawer |
| `components/log/generic-process-log.tsx` | Modify | Use `suffix` in child batch number at line 417 |
| `components/mixing/mixing-workspace.tsx` | Modify | Suffix-aware `checkPendingQC` lookup |
| `app/materials/page.tsx` | Create | Materials management page |
| `playwright.config.ts` | Modify | Register `sprint13` project |
| `tests/sprint13/materials-stock.spec.ts` | Create | Playwright tests for `/materials` |
| `tests/sprint5/subbatch-features.spec.ts` | Modify | Update `A01` → `AXX` assertion at line 122 |
| `tests/sprint3/main-batch-detail.spec.ts` | Modify | Update misleading test comment at line 137 |
| `docs/SESSION_LOG.md` | Modify | Session entry |
| `docs/FLINT_REFERENCE_21052026.md` | Modify | Phase/gap status updates |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260629163236_add_materials_suffix_and_policies.sql`

**Interfaces:**
- Produces: `materials.suffix TEXT` column; `material_stock_totals` view with `(material_id UUID, total_stock NUMERIC)`; updated `create_sub_batch` RPC that uses `suffix` before falling back to MT-strip.

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260629163236_add_materials_suffix_and_policies.sql

-- 1. Add suffix column to materials
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS suffix TEXT;

-- 2. Update create_sub_batch to prefer the suffix column
-- Drop and recreate because we're adding a variable to the DECLARE block.
DROP FUNCTION IF EXISTS public.create_sub_batch(UUID, TEXT, TEXT, UUID, NUMERIC, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.create_sub_batch(
  p_parent_id           UUID,
  p_parent_batch_number TEXT,
  p_process_code        TEXT,
  p_material_id         UUID,
  p_quantity            NUMERIC,
  p_unit                TEXT,
  p_location            TEXT DEFAULT NULL,
  p_changed_by          UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining       NUMERIC;
  v_sub_id          UUID;
  v_material_code   TEXT;
  v_material_suffix TEXT;
  v_suffix          TEXT;
  v_date            TEXT;
  v_prefix          TEXT;
  v_count           INTEGER;
  v_seq             TEXT;
  v_batch_number    TEXT;
BEGIN
  SELECT current_quantity INTO v_remaining
    FROM public.batches
   WHERE id = p_parent_id
     FOR UPDATE;

  IF v_remaining IS NULL THEN
    RAISE EXCEPTION 'Parent batch not found';
  END IF;

  IF p_quantity > v_remaining THEN
    RAISE EXCEPTION 'Split quantity exceeds remaining (remaining %.4f %)', v_remaining, p_unit;
  END IF;

  SELECT code, suffix INTO v_material_code, v_material_suffix
    FROM public.materials
   WHERE id = p_material_id;

  IF v_material_code IS NULL THEN
    v_suffix := '';
  ELSE
    v_suffix := '-' || COALESCE(
      NULLIF(TRIM(v_material_suffix), ''),
      regexp_replace(v_material_code, '^MT', '')
    );
  END IF;

  v_date   := to_char(CURRENT_DATE, 'YYYYMMDD');
  v_prefix := p_process_code || '-' || v_date || '-';

  SELECT COUNT(*) INTO v_count
    FROM public.batches
   WHERE batch_number LIKE v_prefix || '%';

  v_seq          := 'A' || lpad((v_count + 1)::text, 2, '0');
  v_batch_number := v_prefix || v_seq || v_suffix;

  INSERT INTO public.batches (
    batch_number, parent_batch_id, material_id,
    status, current_quantity, original_quantity, unit, current_location
  ) VALUES (
    v_batch_number, p_parent_id, p_material_id,
    'InProgress', p_quantity, p_quantity, p_unit, p_location
  )
  RETURNING id INTO v_sub_id;

  UPDATE public.batches
     SET current_quantity = current_quantity - p_quantity
   WHERE id = p_parent_id;

  INSERT INTO public.batch_status_changes (
    batch_id, from_status, to_status, changed_by, reason
  ) VALUES (
    v_sub_id, 'InProgress', 'InProgress', p_changed_by,
    'Sub-batch created from ' || p_parent_batch_number
  );

  RETURN json_build_object('id', v_sub_id, 'batch_number', v_batch_number);
END;
$$;

-- 3. Material stock view (parent batches only — sub-batches are WIP, not inventory)
CREATE OR REPLACE VIEW public.material_stock_totals AS
SELECT
  material_id,
  COALESCE(SUM(current_quantity), 0)::NUMERIC AS total_stock
FROM public.batches
WHERE parent_batch_id IS NULL
  AND status IN ('InProgress', 'Released')
GROUP BY material_id;

-- 4. RLS write policies on materials
-- Check pg_policies first to avoid duplicates:
--   SELECT policyname FROM pg_policies WHERE tablename = 'materials';
-- If any policy below already exists, skip that statement.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'materials' AND policyname = 'materials_insert_engineer_admin'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY materials_insert_engineer_admin ON public.materials
        FOR INSERT
        TO authenticated
        WITH CHECK (get_my_role() IN ('Engineer', 'Admin'))
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'materials' AND policyname = 'materials_update_engineer_admin'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY materials_update_engineer_admin ON public.materials
        FOR UPDATE
        TO authenticated
        USING (get_my_role() IN ('Engineer', 'Admin'))
        WITH CHECK (get_my_role() IN ('Engineer', 'Admin'))
    $pol$;
  END IF;
END;
$do$;
```

- [ ] **Step 2: Hand migration to the user**

Tell the user: "Please run `supabase/migrations/20260629163236_add_materials_suffix_and_policies.sql` against the live DB. Confirm with a `SELECT column_name FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'suffix'` query. Continue once the column and view exist."

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260629163236_add_materials_suffix_and_policies.sql
git commit -m "feat: add materials suffix column, stock view, and updated create_sub_batch RPC"
```

---

## Task 2: Widen `useMaterials` hook

**Files:**
- Modify: `lib/hooks/useMaterials.ts`

**Interfaces:**
- Produces: `export interface Material { id, code, name, suffix, type, min_storage_threshold, shelf_life_days, first_process_id, total_stock }` and `export function useMaterials(): { materials: Material[], loading, error, mutate }`
- Consumes: nothing new — this replaces the narrower internal type

- [ ] **Step 1: Rewrite `lib/hooks/useMaterials.ts`**

```ts
'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'

export interface Material {
  id: string
  code: string
  name: string
  suffix: string | null
  type: string | null
  min_storage_threshold: number | null
  shelf_life_days: number | null
  first_process_id: string | null
  total_stock: number
}

async function fetchMaterials(): Promise<Material[]> {
  const [{ data: mats, error: matsErr }, { data: stocks, error: stockErr }] = await Promise.all([
    supabase.from('materials').select('*').order('code'),
    supabase.from('material_stock_totals').select('material_id, total_stock'),
  ])
  if (matsErr) throw matsErr
  if (stockErr) throw stockErr
  const stockMap = new Map(
    (stocks ?? []).map(s => [(s as { material_id: string }).material_id, (s as { total_stock: number }).total_stock])
  )
  return (mats ?? []).map(m => ({
    ...(m as Omit<Material, 'total_stock'>),
    total_stock: stockMap.get((m as { id: string }).id) ?? 0,
  }))
}

export function useMaterials() {
  const { data, isLoading, error, mutate } = useSWR('materials', fetchMaterials)
  return {
    materials: data ?? [] as Material[],
    loading: isLoading,
    error: (error as Error | null)?.message ?? null,
    mutate,
  }
}
```

- [ ] **Step 2: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```

Expected: no errors. If consumers that destructure `{ code, name }` from the old type complain, the widened type is backwards-compatible — only errors about the added `mutate` return would appear, which is a net addition. Fix any type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useMaterials.ts
git commit -m "feat: widen useMaterials to full Material type with stock totals"
```

---

## Task 3: Icon + Sidebar

**Files:**
- Modify: `components/icons.tsx` (add after existing exports)
- Modify: `components/sidebar.tsx`

**Interfaces:**
- Produces: `IconMaterials` export; `'materials'` nav item visible to all roles at `/materials`

- [ ] **Step 1: Add `IconMaterials` to `components/icons.tsx`**

Add after the last existing `export const Icon…` line:

```tsx
export const IconMaterials = (p: IconProps) => <Icon {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" /></Icon>;
```

- [ ] **Step 2: Update `components/sidebar.tsx`**

Add `IconMaterials` to the import:

```tsx
import {
  IconDashboard, IconBatches, IconLots, IconRecall,
  IconReports, IconRecipes, IconMachines, IconAdmin,
  IconClipboard, IconChevronLeft, IconChevronRight, IconMaterials,
} from '@/components/icons';
```

Add the nav entry after the `machines` entry:

```ts
const NAV = [
  { id: 'dashboard',  label: 'Dashboard',   Icon: IconDashboard,  href: '/dashboard' },
  { id: 'log',        label: 'Process Log', Icon: IconClipboard,  href: '/log' },
  { id: 'batches',    label: 'Batches',     Icon: IconBatches,    href: '/batches', mobileVisible: true },
  { id: 'lots',       label: 'Lots',        Icon: IconLots,       href: '/lots' },
  { id: 'recall',     label: 'Recall',      Icon: IconRecall,     href: '/recall' },
  { id: 'reports',    label: 'Reports',     Icon: IconReports,    href: '/reports', mobileVisible: true },
  { id: 'recipes',    label: 'Recipes',     Icon: IconRecipes,    href: '/recipes', mobileVisible: true },
  { id: 'machines',   label: 'Machines',    Icon: IconMachines,   href: '/machines' },
  { id: 'materials',  label: 'Materials',   Icon: IconMaterials,  href: '/materials', mobileVisible: true },
  { id: 'admin',      label: 'Admin',       Icon: IconAdmin,      href: '/admin' },
];
```

Add `'materials'` to all three role sets in `VISIBLE_IDS`:

```ts
const VISIBLE_IDS: Record<'Operator' | 'Engineer' | 'Admin', Set<string>> = {
  Operator: new Set(['dashboard', 'log', 'batches', 'lots', 'recipes', 'machines', 'materials']),
  Engineer: new Set(['dashboard', 'log', 'batches', 'lots', 'recall', 'reports', 'recipes', 'machines', 'materials']),
  Admin:    new Set(['dashboard', 'log', 'batches', 'lots', 'recall', 'reports', 'recipes', 'machines', 'materials', 'admin']),
};
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/icons.tsx components/sidebar.tsx
git commit -m "feat: add IconMaterials and Materials nav entry"
```

---

## Task 4: Sub-batch drawer — AXX placeholder + suffix prop

**Files:**
- Modify: `components/batches/create-subbatch-drawer.tsx`
- Modify: `tests/sprint5/subbatch-features.spec.ts` (line 122)
- Modify: `tests/sprint3/main-batch-detail.spec.ts` (line 137 comment)

**Interfaces:**
- Consumes: `parentMaterialSuffix?: string | null` new prop
- Produces: preview uses `AXX` placeholder; suffix order: `parentMaterialSuffix` → `parentMaterialCode.replace(/^MT/, '')` fallback

- [ ] **Step 1: Update `CreateSubBatchDrawerProps` in `create-subbatch-drawer.tsx`**

Find the `interface CreateSubBatchDrawerProps` block and add the new prop:

```ts
interface CreateSubBatchDrawerProps {
  parentId: string;
  parentBatchNumber: string;
  parentMaterialId: string;
  parentMaterialCode: string;
  parentMaterialSuffix?: string | null;   // ← add this line
  remaining: number;
  unit: string;
  onClose: () => void;
  onCreated: () => void;
}
```

- [ ] **Step 2: Update `idSuffix` and `previewId` derivation**

Find the existing two lines (around line 238–239):

```ts
const idSuffix = parentMaterialCode ? `-${parentMaterialCode.replace(/^MT/, '')}` : '';
const previewId = selectedProcess ? `${selectedProcess.code}-${todayCompact()}-A01${idSuffix}` : null;
```

Replace with:

```ts
const idSuffix = parentMaterialSuffix
  ? `-${parentMaterialSuffix}`
  : parentMaterialCode
  ? `-${parentMaterialCode.replace(/^MT/, '')}`
  : '';
const previewId = selectedProcess ? `${selectedProcess.code}-${todayCompact()}-AXX${idSuffix}` : null;
```

- [ ] **Step 3: Update the greyed-out fallback display in the JSX**

Find the line (around line 394):

```tsx
<span className="text-[#3a3a3a]">····</span>-{todayCompact()}-A01{idSuffix}
```

Replace with:

```tsx
<span className="text-[#3a3a3a]">····</span>-{todayCompact()}-AXX{idSuffix}
```

Also add `parentMaterialSuffix` to the destructured props in the function signature:

```ts
export function CreateSubBatchDrawer({
  parentId,
  parentBatchNumber,
  parentMaterialId,
  parentMaterialCode,
  parentMaterialSuffix,
  remaining,
  unit,
  onClose,
  onCreated,
}: CreateSubBatchDrawerProps) {
```

- [ ] **Step 4: Update sprint5 test assertion**

In `tests/sprint5/subbatch-features.spec.ts` at line 122, change:

```ts
await expect(page.getByText(/-A01-C1$/)).toBeVisible();
```

to:

```ts
await expect(page.getByText(/-AXX-C1$/)).toBeVisible();
```

- [ ] **Step 5: Update sprint3 test comment**

In `tests/sprint3/main-batch-detail.spec.ts` around line 137, change:

```ts
// Remaining = 100 − (40 + 20) = 40 kg
```

to:

```ts
// Remaining = current_quantity from DB (already deducted by create_sub_batch RPC) = 40 kg
```

- [ ] **Step 6: Run affected tests**

```bash
npx playwright test --project=sprint3 --project=sprint5
```

Expected: all tests in both projects pass.

- [ ] **Step 7: Commit**

```bash
git add components/batches/create-subbatch-drawer.tsx tests/sprint5/subbatch-features.spec.ts tests/sprint3/main-batch-detail.spec.ts
git commit -m "feat: AXX sequence placeholder and parentMaterialSuffix prop in sub-batch drawer"
```

---

## Task 5: Pass `suffix` from parent batch page to drawer

**Files:**
- Modify: `app/batches/[id]/page.tsx`

**Interfaces:**
- Consumes: `Material.suffix` from DB embed (Task 1 migration must be applied)
- Produces: `CreateSubBatchDrawer` receives `parentMaterialSuffix={batch.materialSuffix}`

- [ ] **Step 1: Add `suffix` to the materials embed in the load query**

Find the `supabase.from('batches').select(...)` call that fetches the parent batch (around line 102). Change:

```ts
material:materials(name, code),
```

to:

```ts
material:materials(name, code, suffix),
```

- [ ] **Step 2: Add `materialSuffix` to `MainBatchView` interface**

Find the `interface MainBatchView` block (around line 16). Add after `materialCode`:

```ts
materialSuffix: string | null;
```

- [ ] **Step 3: Populate `materialSuffix` in `setBatch`**

Inside the `setBatch({...})` call (around line 116), add after `materialCode`:

```ts
materialSuffix:    parent.material?.suffix ?? null,
```

- [ ] **Step 4: Pass the prop to `CreateSubBatchDrawer`**

Find the `<CreateSubBatchDrawer ... />` usage (around line 367). Add the new prop:

```tsx
<CreateSubBatchDrawer
  parentId={batch.id}
  parentBatchNumber={batch.batchNumber}
  parentMaterialId={batch.materialId}
  parentMaterialCode={batch.materialCode}
  parentMaterialSuffix={batch.materialSuffix}
  remaining={remaining}
  unit={batch.unit}
  onClose={() => setDrawerOpen(false)}
  onCreated={() => { setToast('Sub-batch created'); load(); }}
/>
```

- [ ] **Step 5: Type check and run tests**

```bash
npx tsc --noEmit
npx playwright test --project=sprint3 --project=sprint5
```

Expected: no type errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/batches/[id]/page.tsx
git commit -m "feat: thread material suffix through parent batch detail to sub-batch drawer"
```

---

## Task 6: `generic-process-log.tsx` — suffix-aware child batch number

**Files:**
- Modify: `components/log/generic-process-log.tsx` (line 417)

**Interfaces:**
- Consumes: `Material.suffix` from `useMaterials()` (already available at line 82: `const { materials } = useMaterials()`)
- Note: `mat` at line 339 is `materials.find(m => m.code === mixMaterialCode)` — after Task 2, `mat.suffix` is available.

- [ ] **Step 1: Update child batch number construction at line 417**

Find the line:

```ts
const childBatchNumber = `${resolvedBatch.batch_number}-${mat.code.replace(/^MT/, '')}`;
```

Replace with:

```ts
const childBatchNumber = `${resolvedBatch.batch_number}-${mat.suffix || mat.code.replace(/^MT/, '')}`;
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Run sprint11/sprint12 tests** (these cover the mixing inline flow in generic-process-log)

```bash
npx playwright test --project=sprint11 --project=sprint12
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add components/log/generic-process-log.tsx
git commit -m "fix: use material suffix column in mixing child batch number construction"
```

---

## Task 7: `mixing-workspace.tsx` — suffix-aware QC child-batch lookup

**Files:**
- Modify: `components/mixing/mixing-workspace.tsx`

**Interfaces:**
- Consumes: new `suffixMap` parameter in `checkPendingQC`
- Note: `mixing-workspace.tsx` does not use `useMaterials()`. Fetch suffix mapping inside `init()` and pass it to `checkPendingQC` directly (state updates are async; passing as an argument avoids stale-closure issues).

- [ ] **Step 1: Add `suffixMap` parameter to `checkPendingQC`**

Find the function signature (around line 85):

```ts
async function checkPendingQC(uuid: string, currentSteps: MixingStep[]) {
```

Change to:

```ts
async function checkPendingQC(uuid: string, currentSteps: MixingStep[], suffixMap: Record<string, string | null>) {
```

- [ ] **Step 2: Use `suffixMap` inside `checkPendingQC`**

Find the suffix derivation inside `checkPendingQC` (around line 92):

```ts
const suffix = matCode.replace(/^MT/, '');
```

Replace with:

```ts
const suffix = suffixMap[matCode] ?? matCode.replace(/^MT/, '');
```

- [ ] **Step 3: Fetch the suffix map inside `init()` and pass it through**

Inside the `init()` async function (around line 118, after the mixing steps fetch), add the suffix lookup and update the `checkPendingQC` call:

```ts
// Fetch material suffix map
const { data: matRows } = await supabase
  .from('materials')
  .select('code, suffix');
const suffixMap: Record<string, string | null> = {};
for (const m of (matRows ?? []) as { code: string; suffix: string | null }[]) {
  suffixMap[m.code] = m.suffix;
}
```

Then change the existing call (find `await checkPendingQC(uuid, mappedSteps)`):

```ts
await checkPendingQC(uuid, mappedSteps, suffixMap);
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Run mixing-related tests**

```bash
npx playwright test --project=sprint12
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/mixing/mixing-workspace.tsx
git commit -m "fix: use materials.suffix in mixing workspace pending QC batch lookup"
```

---

## Task 8: `/materials` page + sprint13 tests

**Files:**
- Create: `app/materials/page.tsx`
- Create: `tests/sprint13/materials-stock.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: `useMaterials()` → `Material[]`, `mutate`; `useAuth()` → `user.role`; `CATEGORIES` from `lib/constants.ts`; `supabase` for INSERT/UPDATE; `supabase.from('processes').select('id, code, name')` for First Process dropdown
- Produces: `/materials` route

- [ ] **Step 1: Write the failing tests first**

Create `tests/sprint13/materials-stock.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const MATERIALS_MOCK = [
  {
    id: 'mat-1', code: 'MTC1', name: 'Cathode Material C1',
    suffix: null, type: 'Cathode Electrode',
    min_storage_threshold: 100, shelf_life_days: 365, first_process_id: 'proc-1',
    total_stock: 250,
  },
  {
    id: 'mat-2', code: 'MTDW', name: 'DI Water',
    suffix: null, type: 'Electrolyte',
    min_storage_threshold: 50, shelf_life_days: null, first_process_id: null,
    total_stock: 30, // below threshold → Low Stock
  },
  {
    id: 'mat-3', code: 'MTB9', name: 'Material B9',
    suffix: 'B9', type: 'Cathode Electrode',
    min_storage_threshold: null, shelf_life_days: null, first_process_id: null,
    total_stock: 0,
  },
]

const STOCK_MOCK = [
  { material_id: 'mat-1', total_stock: 250 },
  { material_id: 'mat-2', total_stock: 30 },
]

const PROCESSES_MOCK = [
  { id: 'proc-1', code: 'MIXC', name: 'Mixing (Cathode)', sequence_hint: 1 },
]

async function setupMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/materials*`, async route => {
    const method = route.request().method()
    if (method === 'POST') return route.fulfill({ status: 201, body: '' })
    if (method === 'PATCH') return route.fulfill({ status: 204, body: '' })
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MATERIALS_MOCK),
    })
  })

  await page.route(`**${SB}/rest/v1/material_stock_totals*`, async route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(STOCK_MOCK),
    })
  )

  await page.route(`**${SB}/rest/v1/processes*`, async route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(PROCESSES_MOCK),
    })
  )

  // Catch-all for any other tables (never intercept /users)
  await page.route(`**${SB}/rest/v1/!(users)*`, async route => {
    const url = route.request().url()
    if (url.includes('/rest/v1/users')) return route.continue()
    if (url.includes('/rest/v1/materials')) return route.continue()
    if (url.includes('/rest/v1/material_stock_totals')) return route.continue()
    if (url.includes('/rest/v1/processes')) return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

test.describe('Materials page — /materials', () => {
  test('renders KPI cards', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await expect(page.getByTestId('materials-kpi-total')).toContainText('3')
    await expect(page.getByTestId('materials-kpi-low-stock')).toContainText('1')
  })

  test('renders materials grid with all rows', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await expect(page.getByText('MTC1')).toBeVisible()
    await expect(page.getByText('MTDW')).toBeVisible()
    await expect(page.getByText('MTB9')).toBeVisible()
  })

  test('low-stock row shows Low badge', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await expect(page.getByTestId('stock-badge-mat-2')).toContainText('Low')
  })

  test('ok-stock row shows OK badge', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await expect(page.getByTestId('stock-badge-mat-1')).toContainText('OK')
  })

  test('Register button opens modal for Engineer', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await page.getByTestId('register-material-btn').click()
    await expect(page.getByTestId('material-modal')).toBeVisible()
    await expect(page.getByLabel('Code')).toBeVisible()
    await expect(page.getByLabel('Name')).toBeVisible()
  })

  test('Register modal happy path — fills form and submits', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await page.getByTestId('register-material-btn').click()

    await page.getByLabel('Code').fill('MTB9')
    await page.getByLabel('Name').fill('Material B9')
    await page.getByLabel('Suffix').fill('B9')

    const postPromise = page.waitForRequest(
      req => req.url().includes('/rest/v1/materials') && req.method() === 'POST'
    )
    await page.getByRole('button', { name: 'Save material' }).click()
    const postReq = await postPromise
    const body = JSON.parse(postReq.postData() ?? '{}')
    expect(body.code).toBe('MTB9')
    expect(body.name).toBe('Material B9')
    expect(body.suffix).toBe('B9')
  })

  test('Edit button opens modal pre-filled with material data', async ({ page }) => {
    await setupMocks(page)
    await page.goto('/materials')
    await page.getByTestId('edit-material-mat-1').click()
    await expect(page.getByTestId('material-modal')).toBeVisible()
    await expect(page.getByLabel('Name')).toHaveValue('Cathode Material C1')
  })
})
```

- [ ] **Step 2: Register sprint13 in `playwright.config.ts`**

Add after the `sprint12` project block (before the closing `]`):

```ts
{
  name: 'sprint13',
  testDir: './tests/sprint13',
  use: {
    ...devices['Desktop Chrome'],
    storageState: 'tests/.auth/engineer.json',
  },
  dependencies: ['setup'],
},
```

- [ ] **Step 3: Run the tests to confirm they fail (no page yet)**

```bash
npx playwright test --project=sprint13
```

Expected: all 6 tests fail with navigation/element-not-found errors. This confirms the tests are wired up correctly before implementation.

- [ ] **Step 4: Create `app/materials/page.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Shell } from '@/components/shell';
import { useAuth } from '@/lib/auth-context';
import { useMaterials, type Material } from '@/lib/hooks/useMaterials';
import { CATEGORIES } from '@/lib/constants';
import supabase from '@/lib/supabase';

interface Process { id: string; code: string; name: string }

// ── helpers ────────────────────────────────────────────────────────────────

function stockBadge(mat: Material): { label: string; color: string } {
  const { total_stock, min_storage_threshold } = mat;
  if (min_storage_threshold == null) return { label: '—', color: '#5a5a5a' };
  if (total_stock === 0) return { label: 'Empty', color: '#ef4444' };
  if (total_stock < min_storage_threshold) return { label: 'Low', color: '#f59e0b' };
  return { label: 'OK', color: '#22c55e' };
}

const inputCls =
  'h-10 px-3 rounded-md bg-[#161616] border border-[#2a2a2a] text-[13px] text-[#e0e0e0] ' +
  'placeholder:text-[#555] focus:outline-none focus:border-[#22c55e]/60 focus:ring-1 focus:ring-[#22c55e]/30 transition-colors w-full';

// ── Modal ──────────────────────────────────────────────────────────────────

function MaterialModal({
  initial,
  processes,
  onClose,
  onSaved,
}: {
  initial: Material | null;
  processes: Process[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = initial !== null;
  const [code, setCode]       = useState(initial?.code ?? '');
  const [name, setName]       = useState(initial?.name ?? '');
  const [suffix, setSuffix]   = useState(initial?.suffix ?? '');
  const [type, setType]       = useState(initial?.type ?? '');
  const [threshold, setThreshold] = useState(String(initial?.min_storage_threshold ?? ''));
  const [shelfLife, setShelfLife] = useState(String(initial?.shelf_life_days ?? ''));
  const [processId, setProcessId] = useState(initial?.first_process_id ?? '');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!isEdit && !code.trim()) { setError('Code is required.'); return; }
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name:                    name.trim(),
      suffix:                  suffix.trim() || null,
      type:                    type || null,
      min_storage_threshold:   threshold ? parseFloat(threshold) : null,
      shelf_life_days:         shelfLife ? parseInt(shelfLife, 10) : null,
      first_process_id:        processId || null,
    };

    let err;
    if (isEdit) {
      ({ error: err } = await supabase
        .from('materials')
        .update(payload)
        .eq('id', initial!.id));
    } else {
      payload.code = code.trim().toUpperCase();
      ({ error: err } = await supabase.from('materials').insert(payload));
    }

    setSaving(false);
    if (err) {
      if (err.code === '23505') setError('A material with that code already exists.');
      else setError(err.message);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        data-testid="material-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit material' : 'Register material'}
        className="relative z-10 w-[480px] max-w-[92vw] bg-[#0a0a0a] border border-[#363636] rounded-xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-[16px] font-semibold text-[#f5f5f5]">{isEdit ? 'Edit material' : 'Register material'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {error && (
            <div className="px-4 py-2.5 rounded-md bg-[rgba(239,68,68,.12)] border border-[rgba(239,68,68,.3)] text-[12px] text-[#fca5a5] font-mono">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mat-code" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">Code</label>
            <input
              id="mat-code"
              aria-label="Code"
              className={inputCls + (isEdit ? ' opacity-50 cursor-not-allowed' : '')}
              placeholder="e.g. MTB9"
              value={code}
              readOnly={isEdit}
              onChange={e => setCode(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mat-name" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">Name</label>
            <input
              id="mat-name"
              aria-label="Name"
              className={inputCls}
              placeholder="e.g. Material B9"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mat-suffix" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
              Suffix <span className="text-[10px] text-[#5a5a5a] font-mono normal-case tracking-normal">optional</span>
            </label>
            <input
              id="mat-suffix"
              aria-label="Suffix"
              className={inputCls}
              placeholder="e.g. B9 (defaults to stripping MT prefix)"
              value={suffix}
              onChange={e => setSuffix(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mat-type" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
              Category <span className="text-[10px] text-[#5a5a5a] font-mono normal-case tracking-normal">optional</span>
            </label>
            <select
              id="mat-type"
              aria-label="Category"
              className={inputCls + ' bg-[#161616]'}
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="">— Select category —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label htmlFor="mat-threshold" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
                Min Threshold <span className="text-[10px] text-[#5a5a5a] font-mono normal-case tracking-normal">optional</span>
              </label>
              <input
                id="mat-threshold"
                aria-label="Min Threshold"
                className={inputCls}
                placeholder="0"
                inputMode="decimal"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label htmlFor="mat-shelf" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
                Shelf Life (days) <span className="text-[10px] text-[#5a5a5a] font-mono normal-case tracking-normal">optional</span>
              </label>
              <input
                id="mat-shelf"
                aria-label="Shelf Life Days"
                className={inputCls}
                placeholder="365"
                inputMode="numeric"
                value={shelfLife}
                onChange={e => setShelfLife(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mat-process" className="text-[11px] uppercase tracking-[0.12em] text-[#888888] font-medium">
              First Process <span className="text-[10px] text-[#5a5a5a] font-mono normal-case tracking-normal">optional</span>
            </label>
            <select
              id="mat-process"
              aria-label="First Process"
              className={inputCls + ' bg-[#161616]'}
              value={processId}
              onChange={e => setProcessId(e.target.value)}
            >
              <option value="">— Select process —</option>
              {processes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-[#2a2a2a] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-md border border-[#2a2a2a] bg-[#161616] text-[#888888] hover:text-[#f5f5f5] text-[12.5px] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save material'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function MaterialsPage() {
  const { user } = useAuth();
  const { materials, loading, error, mutate } = useMaterials();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [modalMaterial, setModalMaterial] = useState<Material | 'new' | null>(null);

  const canWrite = user?.role === 'Engineer' || user?.role === 'Admin';

  useEffect(() => {
    supabase.from('processes').select('id, code, name').order('sequence_hint')
      .then(({ data }) => setProcesses((data ?? []) as Process[]));
  }, []);

  // KPIs
  const totalCount  = materials.length;
  const lowStockCount = materials.filter(
    m => m.min_storage_threshold != null && m.total_stock < m.min_storage_threshold
  ).length;
  const totalInventory = materials.reduce((sum, m) => sum + m.total_stock, 0);

  function handleSaved() { mutate(); }

  return (
    <Shell>
      <main className="flex-1 min-h-0 px-6 py-6 overflow-y-auto flex flex-col gap-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold text-[#f5f5f5]">Materials</h1>
            <p className="text-[12.5px] text-[#888888] mt-0.5">Raw material master data and current stock levels</p>
          </div>
          {canWrite && (
            <button
              data-testid="register-material-btn"
              onClick={() => setModalMaterial('new')}
              className="h-9 px-4 rounded-md bg-[#22c55e] hover:bg-emerald-500 text-black text-[12.5px] font-semibold transition-colors"
            >
              + Register material
            </button>
          )}
        </div>

        {/* ── KPI cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <div data-testid="materials-kpi-total" className="bg-[#161616] border border-[#2a2a2a] rounded-md px-5 py-4 flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">Total Materials</div>
            <div className="text-[28px] leading-none font-semibold font-mono tabular-nums text-[#f5f5f5]">{loading ? '—' : totalCount}</div>
          </div>
          <div data-testid="materials-kpi-low-stock" className="bg-[#161616] border border-[#2a2a2a] rounded-md px-5 py-4 flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">Low Stock Alerts</div>
            <div className="text-[28px] leading-none font-semibold font-mono tabular-nums" style={{ color: lowStockCount > 0 ? '#f59e0b' : '#22c55e' }}>
              {loading ? '—' : lowStockCount}
            </div>
          </div>
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-md px-5 py-4 flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#888888] font-medium">Total Inventory</div>
            <div className="text-[28px] leading-none font-semibold font-mono tabular-nums text-[#f5f5f5]">
              {loading ? '—' : totalInventory.toLocaleString()}
            </div>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-md border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-5 py-4 text-[12.5px] text-[#fca5a5]">
            {error}
          </div>
        )}

        {/* ── Materials grid ─────────────────────────────────────────── */}
        <section className="bg-[#161616] border border-[#2a2a2a] rounded-md flex flex-col">
          <div className="px-5 pt-4 pb-3 border-b border-[#2a2a2a]">
            <h2 className="text-[14px] font-semibold text-[#f5f5f5]">All materials</h2>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-[12px] font-mono text-[#5a5a5a]">Loading…</div>
          ) : materials.length === 0 ? (
            <div className="px-5 py-12 text-center text-[12px] font-mono text-[#5a5a5a]">No materials configured.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-[0.12em] text-[#5a5a5a] font-medium">
                    <th className="pl-5 pr-3 py-2.5">Code</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Suffix</th>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">Stock</th>
                    <th className="px-3 py-2.5">Min Threshold</th>
                    <th className="px-3 py-2.5">Status</th>
                    {canWrite && <th className="pr-5 px-3 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {materials.map(mat => {
                    const badge = stockBadge(mat);
                    return (
                      <tr key={mat.id} className="border-t border-[#2a2a2a] hover:bg-[#1c1c1c] transition-colors">
                        <td className="pl-5 pr-3 py-3 font-mono text-[12px] text-[#22c55e]">{mat.code}</td>
                        <td className="px-3 py-3 text-[13px] text-[#f5f5f5]">{mat.name}</td>
                        <td className="px-3 py-3 font-mono text-[12px] text-[#888888]">{mat.suffix ?? <span className="text-[#5a5a5a]">auto</span>}</td>
                        <td className="px-3 py-3 text-[12.5px] text-[#888888]">{mat.type ?? '—'}</td>
                        <td className="px-3 py-3 font-mono text-[12.5px] text-[#f5f5f5] tabular-nums">{mat.total_stock.toLocaleString()}</td>
                        <td className="px-3 py-3 font-mono text-[12.5px] text-[#888888] tabular-nums">
                          {mat.min_storage_threshold != null ? mat.min_storage_threshold.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            data-testid={`stock-badge-${mat.id}`}
                            className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold font-mono"
                            style={{ color: badge.color, background: `${badge.color}22`, border: `1px solid ${badge.color}66` }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        {canWrite && (
                          <td className="pr-5 px-3 py-3 text-right">
                            <button
                              data-testid={`edit-material-${mat.id}`}
                              onClick={() => setModalMaterial(mat)}
                              className="text-[11.5px] text-[#888888] hover:text-[#f5f5f5] transition-colors"
                            >
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {modalMaterial !== null && (
        <MaterialModal
          initial={modalMaterial === 'new' ? null : modalMaterial}
          processes={processes}
          onClose={() => setModalMaterial(null)}
          onSaved={handleSaved}
        />
      )}
    </Shell>
  );
}
```

- [ ] **Step 5: Run the sprint13 tests**

```bash
npx playwright test --project=sprint13
```

Expected: all 6 tests pass.

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add app/materials/page.tsx tests/sprint13/materials-stock.spec.ts playwright.config.ts
git commit -m "feat: add /materials page with stock dashboard and register/edit modal"
```

---

## Task 9: Full test suite + docs

**Files:**
- Modify: `docs/SESSION_LOG.md`
- Modify: `docs/FLINT_REFERENCE_21052026.md`

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all existing 220+ tests pass plus the 6 new sprint13 tests. If any test fails, fix it before proceeding.

- [ ] **Step 2: Update `docs/SESSION_LOG.md`**

Append:

```
## [2026-06-29] — Materials management page, suffix column, stock view, AXX placeholder

- What changed:
  - supabase/migrations/20260629163236_add_materials_suffix_and_policies.sql: suffix column on materials, updated create_sub_batch RPC (suffix → MT-strip fallback), material_stock_totals view, RLS INSERT/UPDATE policies
  - lib/hooks/useMaterials.ts: widened to Material interface with full select + parallel stock fetch; exports mutate
  - components/icons.tsx: IconMaterials added
  - components/sidebar.tsx: Materials nav item for all roles
  - components/batches/create-subbatch-drawer.tsx: parentMaterialSuffix prop, AXX placeholder
  - app/batches/[id]/page.tsx: suffix in materials embed, passed to drawer
  - components/log/generic-process-log.tsx: suffix-aware child batch number at line 417
  - components/mixing/mixing-workspace.tsx: suffix-aware checkPendingQC via suffixMap param
  - app/materials/page.tsx: new page (KPI cards, grid, Register/Edit modal)
  - playwright.config.ts: sprint13 project added
  - tests/sprint13/materials-stock.spec.ts: 6 tests
  - tests/sprint5/subbatch-features.spec.ts: A01 → AXX assertion
  - tests/sprint3/main-batch-detail.spec.ts: corrected misleading remaining-qty comment
- Gaps closed: Materials management page, suffix configuration, stock tracking dashboard
- New gaps found: None
- Ref doc updated: yes
```

- [ ] **Step 3: Update `docs/FLINT_REFERENCE_21052026.md`**

In the **Last updated** line at the top, prepend the new entry. In the **Implemented pages & features** table, add:

```
| `/materials` | Materials master-data management + stock dashboard | ✅ Built (2026-06-29) |
```

In the **Not built at all** gap table, remove or mark done any materials-management gap entry if present.

- [ ] **Step 4: Final commit**

```bash
git add docs/SESSION_LOG.md docs/FLINT_REFERENCE_21052026.md
git commit -m "docs: session log and reference update for materials sprint"
```

- [ ] **Step 5: Push to dev**

```bash
git push origin dev
```
