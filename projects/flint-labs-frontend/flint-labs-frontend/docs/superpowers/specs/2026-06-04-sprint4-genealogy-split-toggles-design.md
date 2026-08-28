# Sprint 4 — Genealogy, split integrity & toggles

**Date:** 2026-06-04
**Branch:** `feat/lutfil-genealogy-split-toggles`
**Audit gaps closed:** Gap 2 (genealogy panel), Gap 4 (split integrity), Gap 6 (toggles)

## Goal

Swap three mock/local-only surfaces to live Supabase writes & reads:

1. The sub-batch genealogy panel reads the `trace_batch_genealogy` RPC instead of mock data.
2. The Create Sub-batch drawer deducts parent quantity, writes an audit row, and persists the captured machine/recipe/operator.
3. The recipe and machine "active" toggles (and machine delete) persist to Supabase.

## Scope

**Files edited:**

- `components/subbatch/genealogy.tsx`
- `components/batches/create-subbatch-drawer.tsx`
- `app/recipes/page.tsx`
- `app/machines/page.tsx`
- `app/batches/[id]/[subId]/page.tsx` — prop wiring + TODO removal only (cleared with the sprint owner; no teammate is touching this file this sprint)
- `tests/sprint4/*.spec.ts` — new Playwright specs (required by CLAUDE.md; new folder, no collision risk)

Anything noticed elsewhere is left untouched and marked with a `// TODO` comment only.

## Verified facts (live DB `pewrwrqituidyxhfsner`, checked 2026-06-04)

- `trace_batch_genealogy` takes **`p_batch_id`** (not `batch_id` as the sprint draft showed) — confirmed in `app/recall/page.tsx:162`.
- The route param `subId` **is the batch UUID** — `useBatch` queries `.eq('id', params.subId)`. So the genealogy RPC can be called with `batch.id` directly.
- `batch_status_changes` columns: `batch_id`, `from_status`, `to_status`, `changed_by`, `changed_at` (default now), `reason`.
- `process_runs` columns & nullability: `process_id` NOT NULL, `operator_id` NOT NULL, `start_date` NOT NULL, `start_time` NOT NULL, `status` NOT NULL; `equipment_id`, `recipe_id`, `output_batch_id`, `run_number`, `params` nullable.
- `batches.current_quantity` is numeric, nullable.
- `recipes.is_active` and `equipment.is_active` are both `boolean NOT NULL`.
- The `Machine` type (`components/machines/types.ts`) exposes `id` (UUID) even though the page keys its UI off `equipment_code` — so PATCH/DELETE by `id` work.
- No client-side transaction support and no quantity-deduct RPC exists (only `transition_batch_status`, `generate_lot`, `trace_batch_genealogy`, `get_process_route`, `log_mixing_step`, `update_mixing_step_status`). The split must do read→guard→write best-effort.

## Task 1 — Sub-batch genealogy panel (Gap 2)

`components/subbatch/genealogy.tsx` becomes a `'use client'` component with signature:

```ts
export function Genealogy({ subBatchId }: { subBatchId: string })
```

On mount (and whenever `subBatchId` changes) it:

1. Calls `supabase.rpc('trace_batch_genealogy', { p_batch_id: subBatchId })`.
2. Fetches `materials(id, name)` for the `material_id`s in the result to label nodes (mirror `recall/page.tsx`).
3. Renders one of three states:
   - **Loading** — spinner / skeleton inside the existing panel chrome.
   - **Empty** — RPC returns nothing, or only the self row with no ancestors/descendants → an italic "No genealogy recorded yet" line.
   - **Tree** — rows grouped by `direction` (`ancestor` / `self` / `descendant`), ordered by `depth`. Ancestors above self, descendants below. The self node is highlighted (green) and labelled "current". Other nodes link to `/batches/<parent_batch_id>/<id>` when they are sub-batches, matching the existing link pattern. Reuse `StatusBadge` and the existing dark node styling.

Removes the `SUBBATCH_DETAIL` / `MAIN_BATCHES` imports. Keep the "Finished Lot — not yet assigned" footer block as-is (still mock-free; it is a static placeholder).

In `app/batches/[id]/[subId]/page.tsx`: pass `subBatchId={batch.id}` and delete the `// TODO: wire genealogy to trace_batch_genealogy RPC` comment.

**Note for cleanup PR:** after this change `SUBBATCH_DETAIL` and `MAIN_BATCHES` have no live importers and can be deleted from `lib/data.ts`.

## Task 2 — Sub-batch split integrity (Gap 4)

Rework `handleSubmit` in `components/batches/create-subbatch-drawer.tsx`. Order is chosen so the over-allocation check fails before any write, and the critical writes (child + parent deduct) happen before the best-effort audit/run rows.

1. **Pre-guard.** Read the parent's live quantity:
   ```ts
   const { data: parent } = await supabase
     .from('batches').select('current_quantity').eq('id', parentId).single()
   const current = parent?.current_quantity ?? 0
   if (qtyNum! > current) { setError(`Split exceeds available — only ${current} ${unit} remaining`); setSubmitting(false); return }
   ```
2. **Insert child** with a returning select:
   ```ts
   const { data: newSubBatch, error: insertErr } = await supabase
     .from('batches')
     .insert({ /* existing fields */ })
     .select('id, batch_number')
     .single()
   ```
   Keep the existing `23505` duplicate-id handling.
3. **Deduct parent** quantity:
   ```ts
   await supabase.from('batches').update({ current_quantity: current - qtyNum! }).eq('id', parentId)
   ```
   If this errors, surface it (hard error) — the child exists but the deduct failed.
4. **Audit row** (best-effort):
   ```ts
   await supabase.from('batch_status_changes').insert({
     batch_id: newSubBatch.id, changed_by: user?.id ?? null,
     from_status: 'InProgress', to_status: 'InProgress',
     reason: `Split from ${parentBatchNumber}`,
   })
   ```
5. **Process run** capturing machine/recipe/operator (best-effort):
   ```ts
   const now = new Date()
   await supabase.from('process_runs').insert({
     process_id: processId,
     equipment_id: machineId || null,
     recipe_id: recipeId || null,
     operator_id: operatorId || user?.id,
     status: 'InProgress',
     start_date: now.toISOString().slice(0, 10),
     start_time: now.toTimeString().slice(0, 8),
     output_batch_id: newSubBatch.id,
   })
   ```

Steps 4–5 are wrapped so a failure logs `console.error` and is recorded with a `// TODO`, but does not roll back the successful batch creation. A `// TODO` above the sequence documents the non-atomic race (no client transaction / no deduct RPC). On success, call `onCreated()` + `onClose()` as today.

## Task 3 — Toggles (Gap 6)

### 3a — `app/recipes/page.tsx`

`flipActive` becomes async and persists before/with local state:

```ts
async function flipActive(id: string) {
  const base = recipes.find(r => r.id === id); if (!base) return
  const next = !base.is_active
  const { error } = await supabase.from('recipes').update({ is_active: next }).eq('id', id)
  if (error) { showToast('Could not update recipe'); return }
  setLocalRecipes(prev => { /* upsert updated row */ })
}
```

Keep the existing `canEdit` gate on the toggle button.

### 3b — `app/machines/page.tsx`

- **Toggle** (`onChange`): optimistic flip, then `await supabase.from('equipment').update({ is_active: next }).eq('id', m.id)`; revert + toast on error.
- **Delete** (`handleDelete`): keep `window.confirm`; on confirm `await supabase.from('equipment').delete().eq('id', id)`. Catch `23503` FK violation → toast "Cannot delete — equipment is in use" and do not remove from local state. On success remove from local state + collapse the row. Keep the `isAdmin` gate.

`handleDelete` signature changes to receive the machine (so it has both `id` and `equipment_code`), or looks the `id` up from local state by code.

## Tests (`tests/sprint4/`)

Stateless mocked-Supabase specs following `tests/sprint3/` conventions (route pattern `**https://pewrwrqituidyxhfsner.supabase.co/rest/v1/<table>**`, no call counters, leave `/rest/v1/users` real):

- `genealogy.spec.ts` — mock `rpc/trace_batch_genealogy` + `materials`: asserts the tree renders ancestor/self/descendant nodes and the self node shows "current"; asserts the empty state when the RPC returns only the self row.
- `recipes-toggle.spec.ts` — asserts clicking the active toggle issues a PATCH to `/rest/v1/recipes` and the UI reflects the new state.
- `machines-toggle-delete.spec.ts` — asserts toggle issues a PATCH to `/rest/v1/equipment`; delete with a `204` removes the row; delete returning `409`/`23503` shows the "in use" message and keeps the row.

Verification gate: `npx tsc --noEmit` zero errors, and full `npm test` green (existing sprint3 specs included).

## Definition of done

- [ ] Genealogy panel reads `trace_batch_genealogy` (`p_batch_id`); mock imports removed; page passes `subBatchId` and TODO deleted
- [ ] Parent `current_quantity` deducted on split; over-allocation guarded before any write
- [ ] Initial `batch_status_changes` row written for the new sub-batch
- [ ] Drawer machine/recipe/operator persisted to a `process_runs` row (`output_batch_id` = sub-batch)
- [ ] `recipes.is_active` toggle PATCHes Supabase
- [ ] Machine active toggle PATCHes; Delete DELETEs with `23503` FK-error handling
- [ ] `npx tsc --noEmit` passes; `tests/sprint4/` added and `npm test` green
- [ ] Only the listed files changed

## Out of scope / KIV

- Atomic split via a DB RPC (would replace the read→guard→write race) — note as a backend follow-up.
- Deleting `SUBBATCH_DETAIL` / `MAIN_BATCHES` from `lib/data.ts` — left for the cleanup PR.
- Persisting `notes` from the drawer (no column captured this sprint).
