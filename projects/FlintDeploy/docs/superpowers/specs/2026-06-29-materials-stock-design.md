# Materials Management & Stock Dashboard — Design Spec

**Date:** 2026-06-29  
**Status:** Approved

---

## 1. Goal

Add a `/materials` page that serves two purposes:

1. **Master data management** — Engineers and Admins can register new materials, set the ID suffix, map the first process step, and tune the low-stock threshold. Operators have read-only access.
2. **Stock dashboard** — All roles see each material's current available stock (raw-material parent batches in InProgress or Released state) with visual warning when stock falls below `min_storage_threshold`.

Additionally: the sub-batch ID preview in the Create Sub-batch drawer changes from the fixed placeholder `A01` to `AXX`, and the new `suffix` column is threaded through the RPC and all suffix-construction call-sites.

---

## 2. Scope

### In scope
- DB migration: `suffix` column, updated RPC, `material_stock_totals` view, `materials` RLS write policies
- `useMaterials` hook: widens select to `*`, exports a `Material` type
- Sidebar: new Materials nav item (visible to all roles)
- New page: `app/materials/page.tsx` with KPI cards, materials grid, Register/Edit modal
- `create-subbatch-drawer.tsx`: `parentMaterialSuffix` prop, `AXX` placeholder
- `app/batches/[id]/page.tsx`: pass `suffix` from materials join to drawer
- `generic-process-log.tsx`: use `suffix` when constructing child batch number preview
- `mixing-workspace.tsx`: use `suffix` in `checkPendingQC` child-batch lookup
- Tests: update sprint5 suffix test (`AXX`), update sprint3 test comment, new sprint13 spec

### Out of scope
- Hard DELETE of materials (FK risk — Admin can zero the threshold instead)
- `is_active` soft-delete column on `materials` (schema change not needed for MVP)
- Real-time stock updates (SWR revalidation on focus is sufficient)

---

## 3. Database layer

### 3a. Migration: `20260629163236_add_materials_suffix_and_policies.sql`

**Step 1 — Add suffix column**
```sql
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS suffix TEXT;
```

**Step 2 — Update `create_sub_batch` RPC**

Replace the suffix-construction block:
```sql
-- old
v_suffix := '-' || regexp_replace(v_material_code, '^MT', '');

-- new
DECLARE v_material_suffix TEXT;
SELECT suffix INTO v_material_suffix FROM public.materials WHERE id = p_material_id;

v_suffix := '-' || COALESCE(
  NULLIF(TRIM(v_material_suffix), ''),
  regexp_replace(v_material_code, '^MT', '')
);
```

**Step 3 — `material_stock_totals` view**

Aggregates raw-material parent batches only (parent_batch_id IS NULL). Sub-batches represent WIP, not inventory stock.

```sql
CREATE OR REPLACE VIEW public.material_stock_totals AS
SELECT
  material_id,
  COALESCE(SUM(current_quantity), 0)::NUMERIC AS total_stock
FROM public.batches
WHERE parent_batch_id IS NULL
  AND status IN ('InProgress', 'Released')
GROUP BY material_id;
```

PostgREST infers the relationship through the `material_id` column. Embed in the hook as:
```ts
supabase.from('materials').select('*, material_stock_totals(total_stock)')
```

**Step 4 — RLS policies on `materials`**

Check existing policies before adding (Phase 5 already added 76 policies total). Use `DO $$ IF NOT EXISTS` guards or explicit policy names:
- `materials_insert_engineer_admin` — INSERT for Engineer and Admin roles
- `materials_update_engineer_admin` — UPDATE for Engineer and Admin roles

No DELETE policy — removing a material would orphan batch records. Admin must manually resolve FK dependents first.

---

## 4. Hook: `useMaterials.ts`

**Changes:**
- Change `select('code, name')` → `select('*, material_stock_totals(total_stock)')`
- Export a named `Material` interface
- Return type widens to `Material[]`

```ts
export interface Material {
  id: string;
  code: string;
  name: string;
  suffix: string | null;
  type: string | null;
  min_storage_threshold: number | null;
  shelf_life_days: number | null;
  first_process_id: string | null;
  material_stock_totals: { total_stock: number } | null;
}
```

**Consumer impact:** All existing consumers (`generic-process-log.tsx`, `add-step-modal.tsx`, `lib/data/mixing.ts`) only destructure `code` and `name` — adding fields is backwards-compatible. `generic-process-log.tsx` will additionally read `suffix`.

SWR key stays `'materials'` — mutating this key from the `/materials` page will revalidate all consumers.

---

## 5. Sidebar: `components/sidebar.tsx`

- Add `IconMaterials` (a box/package SVG) to `icons.tsx`
- Add nav entry:
  ```ts
  { id: 'materials', label: 'Materials', Icon: IconMaterials, href: '/materials', mobileVisible: true }
  ```
- Add `'materials'` to `VISIBLE_IDS` for **all three roles** (Operators get read-only access to the page itself; the write controls are gated in the page)

---

## 6. Page: `app/materials/page.tsx`

### 6a. Auth gate
All roles can view. Write controls (Register button, Edit buttons) render only for `role === 'Engineer' || role === 'Admin'`.

### 6b. KPI cards (3)
| Card | Value |
|------|-------|
| Total Materials | `materials.length` |
| Low Stock | Count where `total_stock < min_storage_threshold` (excludes materials with no threshold set) |
| Total Inventory | `SUM(total_stock)` across all materials, labelled with mixed units if >1 unit type |

### 6c. Materials grid

Columns: Code (mono), Name, Suffix, Category (type), First Process, Stock, Min Threshold, Status badge.

**Status badge logic:**
- `OK` (green) — `total_stock >= min_storage_threshold` or no threshold set
- `Low` (amber) — `total_stock < min_storage_threshold && total_stock > 0`
- `Empty` (red) — `total_stock === 0 && min_storage_threshold != null`

### 6d. Register / Edit modal

Fields:
| Field | Input | Notes |
|-------|-------|-------|
| Code | Text | Read-only on edit; pattern `MT[A-Z0-9]+` validated client-side |
| Name | Text | Required |
| Suffix | Text | Optional; if blank, RPC falls back to stripping `MT` prefix |
| Category | Dropdown | Uses `CATEGORIES` from `lib/constants.ts` |
| Min Storage Threshold | Number | Optional; unit label shown beside input |
| Shelf Life Days | Number | Optional |
| First Process | Dropdown | Optional; fetched from `processes` table |

On save: `INSERT` (new) or `UPDATE` (edit) via the anon client (RLS policy gates access). Handle 23505 on Code for duplicate registration.

SWR `mutate('materials')` on success to revalidate all consumers.

---

## 7. Sub-batch drawer: `components/batches/create-subbatch-drawer.tsx`

**Prop addition:**
```ts
parentMaterialSuffix?: string | null;
```

**Preview ID suffix logic:**
```ts
const idSuffix = parentMaterialSuffix
  ? `-${parentMaterialSuffix}`
  : parentMaterialCode
  ? `-${parentMaterialCode.replace(/^MT/, '')}`
  : '';
```

**Sequence placeholder:** Change `A01` → `AXX` in both the live preview string and the greyed-out fallback display.

---

## 8. Parent batch detail: `app/batches/[id]/page.tsx`

**Changes:**
- Add `suffix` to the materials embed in the initial load query: `material:materials(name, code, suffix)`
- Add `materialSuffix: string | null` to `MainBatchView`
- Pass `parentMaterialSuffix={batch.materialSuffix}` to `<CreateSubBatchDrawer>`

**Double-deduction bug:** Already fixed in the current code (`remaining = batch.currentQty`). No logic change needed. Only the sprint3 test comment ("Remaining = 100 − (40 + 20) = 40 kg") needs updating to reflect that `current_quantity` in the DB is already the post-deduction value.

---

## 9. Process log: `components/log/generic-process-log.tsx`

In the section that constructs the output child batch number (displayed for reference on the success screen or log), use the suffix field:

```ts
// mat comes from useMaterials(), which now returns Material[]
const mat = materials.find(m => m.code === resolvedBatch.material_code);
const idSuffix = mat?.suffix || mat?.code.replace(/^MT/, '') || '';
```

This is display-only — the RPC generates the authoritative batch number server-side.

---

## 10. Mixing workspace: `components/mixing/mixing-workspace.tsx`

In `checkPendingQC`, the child-batch lookup pattern uses `like('batch_number', \`%-${suffix}\`)`. This suffix is currently derived from `matCode.replace(/^MT/, '')`. After this change it should also check the material's `suffix` field.

Since `mixing-workspace.tsx` already queries `batches` for material data, fetch `suffix` alongside:
```ts
supabase.from('batches').select('id, material_id, material:materials(code, suffix)')
```
Then in `checkPendingQC`:
```ts
const suffix = matSuffix || matCode.replace(/^MT/, '');
```

---

## 11. Tests

### 11a. `tests/sprint5/subbatch-features.spec.ts` — line 122
```ts
// before
await expect(page.getByText(/-A01-C1$/)).toBeVisible();
// after
await expect(page.getByText(/-AXX-C1$/)).toBeVisible();
```

The mock for the `materials` endpoint (if it exists in that spec's `setupMocks`) must also return `suffix: null` so the fallback `replace(/^MT/, '')` produces `C1`.

### 11b. `tests/sprint3/main-batch-detail.spec.ts`
Update the comment on line 137:
```ts
// before: // Remaining = 100 − (40 + 20) = 40 kg
// after: // Remaining = current_quantity from DB (already deducted by RPC) = 40 kg
```
No mock data change required; `current_quantity: 40` is already correct.

### 11c. `tests/sprint13/materials-stock.spec.ts` — new file
Covers:
- Page renders KPI cards (Total Materials, Low Stock, Total Inventory)
- Materials grid rows visible
- Low-stock row shows amber "Low" badge
- Register modal opens for Engineer; fields render
- Register modal is not accessible to Operator (write button hidden)
- Happy-path: fill form → POST → success → SWR revalidates (mock INSERT returns 201)

---

## 12. Roll-out & verification

1. Run migration in Supabase (confirm existing `materials` RLS policies won't conflict — check `pg_policies` before applying)
2. Deploy to `dev` preview URL
3. Load `/materials` as Engineer — confirm KPI cards, grid, Register modal
4. Load `/materials` as Operator — confirm no Register/Edit buttons
5. Create sub-batch from `/batches/[id]` — confirm `AXX` placeholder in preview
6. Verify that batch number generated by RPC still uses correct suffix (no regression)
7. `npm test` — all 220+ tests + new sprint13 tests must pass
