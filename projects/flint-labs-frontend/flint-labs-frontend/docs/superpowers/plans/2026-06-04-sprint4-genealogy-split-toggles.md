# Sprint 4 — Genealogy, Split Integrity & Toggles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap three mock/local-only surfaces to live Supabase — the sub-batch genealogy panel (RPC read), the Create Sub-batch drawer (quantity deduct + audit + process-run persistence), and the recipe/machine active toggles + machine delete.

**Architecture:** Pure frontend wiring against an already-live Supabase schema. The genealogy panel becomes a self-fetching client component fed a UUID prop; the drawer's `handleSubmit` gains a guarded read→write sequence; the two toggle handlers become async PATCH/DELETE calls with optimistic UI and rollback.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, `@supabase/supabase-js`, Playwright (`@playwright/test`).

---

## Key verified facts (live DB `pewrwrqituidyxhfsner`, 2026-06-04)

- `trace_batch_genealogy` param is **`p_batch_id`** (confirmed `app/recall/page.tsx:162`).
- Route param `subId` **is the batch UUID** (`useBatch` does `.eq('id', params.subId)`), so `batch.id` is the UUID to trace.
- `batch_status_changes` cols: `batch_id`, `from_status`, `to_status`, `changed_by`, `changed_at` (default now), `reason`.
- `process_runs`: `process_id` NOT NULL, `operator_id` NOT NULL, `start_date`/`start_time`/`status` NOT NULL; `equipment_id`, `recipe_id`, `output_batch_id` nullable.
- `recipes.is_active`, `equipment.is_active` → `boolean NOT NULL`.
- `AuthUser` (`lib/auth-context.tsx`) exposes `id` → `user?.id` is valid.
- `Machine` type (`components/machines/types.ts`) exposes `id` (UUID).

## Test harness conventions (from `tests/sprint3/`)

- `const SB = 'https://pewrwrqituidyxhfsner.supabase.co'`; route pattern `` `**${SB}/rest/v1/<table>**` `` (RPC: `/rest/v1/rpc/<fn>`).
- Stateless mocks keyed on request URL/method — **no call counters**.
- Leave `/rest/v1/users` **unmocked** so the auth context resolves the Engineer role (the saved session in `tests/.auth/engineer.json` is Engineer).
- POST → `201`, PATCH → `204`, DELETE → `204`; GET `.single()` → object, GET list → array.

---

## File Structure

- **Modify** `components/subbatch/genealogy.tsx` — becomes `'use client'`, takes `{ subBatchId }`, fetches the RPC, renders loading/empty/tree.
- **Modify** `app/batches/[id]/[subId]/page.tsx` — pass `subBatchId={batch.id}`, delete the TODO comment.
- **Modify** `components/batches/create-subbatch-drawer.tsx` — rework `handleSubmit`.
- **Modify** `app/recipes/page.tsx` — async `flipActive` with PATCH.
- **Modify** `app/machines/page.tsx` — async toggle + delete with PATCH/DELETE.
- **Create** `tests/sprint4/genealogy.spec.ts`
- **Create** `tests/sprint4/recipes-toggle.spec.ts`
- **Create** `tests/sprint4/machines-toggle-delete.spec.ts`

---

## Task 1: Genealogy panel → live `trace_batch_genealogy`

**Files:**
- Modify: `components/subbatch/genealogy.tsx` (full rewrite)
- Modify: `app/batches/[id]/[subId]/page.tsx:95-96`
- Test: `tests/sprint4/genealogy.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/sprint4/genealogy.spec.ts`:

```ts
/**
 * Sub-batch genealogy panel (components/subbatch/genealogy.tsx)
 *
 * Verifies the panel reads trace_batch_genealogy (p_batch_id) and renders
 * ancestor / self / descendant nodes, plus the empty state when the RPC
 * returns only the self row. Supabase REST/RPC mocked statelessly; /rest/v1/users
 * left real so the auth context resolves the Engineer role.
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  parentId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  parentNum: 'MTC1-20260521-A01',
  matId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  subId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  subNum: 'MIXC-20260521-A01',
  childId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  childNum: 'CTGC-20260521-A01',
}

// Shared sub-batch row so the page (useBatch) resolves and renders the panel.
function batchRow() {
  return {
    id: M.subId, batch_number: M.subNum, parent_batch_id: M.parentId,
    material_id: M.matId, status: 'InProgress', current_quantity: 40,
    original_quantity: 40, unit: 'kg', current_location: 'Shelf B2',
    created_at: '2026-05-21T09:00:00Z',
    material: { name: 'Cathode Electrode', code: 'MTC1' },
    parent_batch: { id: M.parentId, batch_number: M.parentNum },
  }
}

async function baseMocks(page: Page) {
  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const url = route.request().url()
    if (url.includes(`id=eq.${M.subId}`) || url.includes(`id=eq.${M.parentId}`)) {
      const isParent = url.includes(`id=eq.${M.parentId}`)
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(isParent
          ? { ...batchRow(), id: M.parentId, batch_number: M.parentNum, parent_batch_id: null, parent_batch: null }
          : batchRow()),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route(`**${SB}/rest/v1/mixing_steps**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/rpc/get_process_route**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/materials**`, r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{ id: M.matId, name: 'Cathode Electrode' }]),
  }))
}

test.describe('Genealogy panel', () => {
  test('renders ancestor, self and descendant nodes from the RPC', async ({ page }) => {
    await baseMocks(page)
    await page.route(`**${SB}/rest/v1/rpc/trace_batch_genealogy**`, route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: M.parentId, batch_number: M.parentNum, parent_batch_id: null, material_id: M.matId, status: 'Released', current_quantity: 100, unit: 'kg', depth: -1, direction: 'ancestor' },
        { id: M.subId, batch_number: M.subNum, parent_batch_id: M.parentId, material_id: M.matId, status: 'InProgress', current_quantity: 40, unit: 'kg', depth: 0, direction: 'self' },
        { id: M.childId, batch_number: M.childNum, parent_batch_id: M.subId, material_id: M.matId, status: 'InProgress', current_quantity: 10, unit: 'kg', depth: 1, direction: 'descendant' },
      ]),
    }))

    await page.goto(`/batches/${M.parentId}/${M.subId}`)

    const panel = page.getByText('Material Genealogy').locator('xpath=ancestor::div[1]')
    await expect(page.getByText('Material Genealogy')).toBeVisible()
    await expect(page.getByText(M.parentNum)).toBeVisible()
    await expect(page.getByText(M.childNum)).toBeVisible()
    // Self node is flagged "current"
    await expect(page.getByText('current')).toBeVisible()
  })

  test('shows the empty state when the RPC returns only the self row', async ({ page }) => {
    await baseMocks(page)
    await page.route(`**${SB}/rest/v1/rpc/trace_batch_genealogy**`, route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        { id: M.subId, batch_number: M.subNum, parent_batch_id: M.parentId, material_id: M.matId, status: 'InProgress', current_quantity: 40, unit: 'kg', depth: 0, direction: 'self' },
      ]),
    }))

    await page.goto(`/batches/${M.parentId}/${M.subId}`)
    await expect(page.getByText('No parent or child batches recorded yet.')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/sprint4/genealogy.spec.ts`
Expected: FAIL — the panel still renders mock data; "current" / `CTGC-...` / the empty-state string are not present.

- [ ] **Step 3: Rewrite the genealogy component**

Replace the entire contents of `components/subbatch/genealogy.tsx` with:

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { IconLink } from '@/components/icons';
import supabase from '@/lib/supabase';

interface GenealogyRow {
  id: string;
  batch_number: string;
  parent_batch_id: string | null;
  material_id: string;
  status: string;
  current_quantity: number;
  unit: string;
  depth: number;
  direction: string;
}

const STATUS_DOT: Record<string, string> = {
  Released:   '#22c55e',
  InProgress: '#3b82f6',
  OnHold:     '#f59e0b',
  Quarantine: '#a855f7',
  Scrapped:   '#ef4444',
};

function hrefFor(row: GenealogyRow): string {
  // Sub-batches link to /batches/<parent>/<id>; root batches to /batches/<id>.
  return row.parent_batch_id
    ? `/batches/${encodeURIComponent(row.parent_batch_id)}/${encodeURIComponent(row.id)}`
    : `/batches/${encodeURIComponent(row.id)}`;
}

function Node({
  row, materialName, isCurrent,
}: { row: GenealogyRow; materialName: string; isCurrent: boolean }) {
  const dot = STATUS_DOT[row.status] ?? '#5a5a5a';
  return (
    <div className={
      'rounded-lg border px-3 py-2.5 flex items-center justify-between gap-2 ' +
      (isCurrent ? 'border-[#22c55e]/50 bg-[rgba(34,197,94,0.05)]' : 'border-[#1e1e1e] bg-[#0e0e0e]')
    }>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
          {isCurrent ? (
            <span className="font-mono text-[12px] text-[#22c55e] truncate">{row.batch_number}</span>
          ) : (
            <Link href={hrefFor(row)} className="font-mono text-[12px] text-[#93c5fd] hover:text-white transition-colors truncate">
              {row.batch_number}
            </Link>
          )}
          {isCurrent && (
            <span className="text-[9.5px] font-mono text-[#22c55e] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.3)] px-1.5 py-0.5 rounded shrink-0">
              current
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#5a5a5a] mt-0.5 truncate">
          {materialName} · {row.current_quantity} {row.unit}
        </div>
      </div>
      <StatusBadge status={row.status} />
    </div>
  );
}

export function Genealogy({ subBatchId }: { subBatchId: string }) {
  const [rows, setRows] = useState<GenealogyRow[]>([]);
  const [materialMap, setMaterialMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subBatchId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: rpcErr } = await supabase
        .rpc('trace_batch_genealogy', { p_batch_id: subBatchId });
      if (cancelled) return;

      if (rpcErr) {
        setError(rpcErr.message);
        setLoading(false);
        return;
      }

      const result = (data ?? []) as GenealogyRow[];
      setRows(result);

      const materialIds = [...new Set(result.map(r => r.material_id).filter(Boolean))];
      if (materialIds.length > 0) {
        const { data: mats } = await supabase
          .from('materials').select('id, name').in('id', materialIds);
        if (!cancelled) {
          setMaterialMap(Object.fromEntries(
            (mats ?? []).map((m: { id: string; name: string }) => [m.id, m.name]),
          ));
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [subBatchId]);

  const ancestors   = rows.filter(r => r.depth < 0).sort((a, b) => a.depth - b.depth);
  const self        = rows.find(r => r.depth === 0) ?? null;
  const descendants = rows.filter(r => r.depth > 0).sort((a, b) => a.depth - b.depth);
  const isEmpty = !loading && !error && ancestors.length === 0 && descendants.length === 0;

  const label = (text: string) => (
    <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#5a5a5a] mb-2">{text}</div>
  );

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#111111] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a]">
        <span className="text-[13px] font-semibold text-[#f5f5f5]">Material Genealogy</span>
        <IconLink size={14} className="text-[#5a5a5a]" />
      </div>

      <div className="flex-1 px-5 py-4 flex flex-col gap-4">
        {loading && (
          <div className="flex items-center gap-3 py-6 justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-[#22c55e] border-t-transparent animate-spin" />
            <span className="text-[12px] text-[#5a5a5a]">Tracing genealogy…</span>
          </div>
        )}

        {error && (
          <div className="px-3 py-2 rounded-md bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.3)] text-[12px] text-[#fca5a5] font-mono">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {ancestors.length > 0 && (
              <div>
                {label('Ancestors')}
                <div className="flex flex-col gap-1.5">
                  {ancestors.map(r => (
                    <Node key={r.id} row={r} materialName={materialMap[r.material_id] ?? r.batch_number} isCurrent={false} />
                  ))}
                </div>
              </div>
            )}

            {self && (
              <div>
                {label('Current Sub-batch')}
                <Node row={self} materialName={materialMap[self.material_id] ?? self.batch_number} isCurrent />
              </div>
            )}

            {descendants.length > 0 && (
              <div>
                {label('Descendants')}
                <div className="flex flex-col gap-1.5">
                  {descendants.map(r => (
                    <Node key={r.id} row={r} materialName={materialMap[r.material_id] ?? r.batch_number} isCurrent={false} />
                  ))}
                </div>
              </div>
            )}

            {isEmpty && (
              <div className="text-[12px] text-[#5a5a5a] italic">No parent or child batches recorded yet.</div>
            )}
          </>
        )}

        {/* Finished Lot — static placeholder until lot assignment is wired */}
        <div>
          {label('Finished Lot')}
          <div className="rounded-lg border border-[#1e1e1e] bg-[#0e0e0e] px-3 py-2.5">
            <span className="text-[12px] text-[#5a5a5a] italic">Not yet assigned</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire the prop in the sub-batch detail page**

In `app/batches/[id]/[subId]/page.tsx`, replace lines 95-96:

```tsx
                {/* TODO: wire genealogy to trace_batch_genealogy RPC */}
                <Genealogy />
```

with:

```tsx
                <Genealogy subBatchId={batch.id} />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test tests/sprint4/genealogy.spec.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors (note: `SUBBATCH_DETAIL`/`MAIN_BATCHES` are no longer imported here).

- [ ] **Step 7: Commit**

```bash
git add components/subbatch/genealogy.tsx "app/batches/[id]/[subId]/page.tsx" tests/sprint4/genealogy.spec.ts
git commit -m "$(cat <<'EOF'
feat(genealogy): wire sub-batch panel to trace_batch_genealogy RPC

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Sub-batch split integrity

**Files:**
- Modify: `components/batches/create-subbatch-drawer.tsx:264-301` (`handleSubmit`)
- Test: `tests/sprint4/genealogy.spec.ts` is separate; split behaviour is covered by extending `tests/sprint3/main-batch-detail.spec.ts` patterns inline here via a new spec is unnecessary — instead assert the network calls in a focused spec below.

> Split persistence is verified by asserting the outbound PATCH to `batches` and the POST to `process_runs` fire on submit. Add these assertions to a new `tests/sprint4/split-integrity.spec.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/sprint4/split-integrity.spec.ts`:

```ts
/**
 * Create Sub-batch drawer — split integrity (Task 2)
 *
 * Asserts that submitting the drawer: reads the parent quantity, inserts the
 * child (returning select), PATCHes the parent current_quantity, writes a
 * batch_status_changes audit row, and inserts a process_runs row.
 * Stateless mocks; /rest/v1/users left real (Engineer role).
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'

const M = {
  parentId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  parentNum: 'MTC1-20260521-A01',
  matId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  mixcId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  newSubId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
}

const PROCESSES = [
  { id: M.mixcId, code: 'MIXC', name: 'Mixing (Cathode)', sequence_hint: 1, requires_calibration: false },
]

async function setupMocks(page: Page, calls: { patchedParent: boolean; auditRow: boolean; processRun: boolean }) {
  await page.route(`**${SB}/rest/v1/batches**`, async route => {
    const method = route.request().method()
    const url = route.request().url()

    // Child insert (POST) → returning select yields the new row
    if (method === 'POST') {
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: M.newSubId, batch_number: `MIXC-x-A01` }),
      })
    }
    // Parent quantity deduct (PATCH)
    if (method === 'PATCH') {
      calls.patchedParent = true
      return route.fulfill({ status: 204, body: '' })
    }
    // Drawer next-sequence lookup
    if (url.includes('batch_number=like')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    // Parent pre-guard read (.single → object) and main-batch page read
    if (url.includes(`id=eq.${M.parentId}`) || url.includes('parent_batch_id=is.null')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          id: M.parentId, batch_number: M.parentNum, parent_batch_id: null,
          material_id: M.matId, status: 'InProgress', current_quantity: 100,
          original_quantity: 100, unit: 'kg', current_location: 'Shelf A1',
          created_at: '2026-05-21T08:00:00Z',
          material: { name: 'Cathode Electrode', code: 'MTC1' },
          intake: [{ supplier_name: 'Targray' }],
        }),
      })
    }
    if (url.includes('parent_batch_id=eq')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  await page.route(`**${SB}/rest/v1/processes**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROCESSES) }))
  await page.route(`**${SB}/rest/v1/equipment**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/recipes**`, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route(`**${SB}/rest/v1/process_runs**`, async route => {
    if (route.request().method() === 'POST') { calls.processRun = true; return route.fulfill({ status: 201, body: '' }) }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route(`**${SB}/rest/v1/batch_status_changes**`, async route => {
    if (route.request().method() === 'POST') { calls.auditRow = true; return route.fulfill({ status: 201, body: '' }) }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
}

test('submitting a split deducts parent qty, writes audit row and process run', async ({ page }) => {
  const calls = { patchedParent: false, auditRow: false, processRun: false }
  await setupMocks(page, calls)
  await page.goto(`/batches/${M.parentId}`)

  await page.getByRole('button', { name: /create sub-batch/i }).click()
  const drawer = page.getByRole('dialog', { name: 'Create sub-batch' })
  await drawer.getByRole('button', { name: 'Select process step' }).click()
  await page.getByRole('button', { name: 'Mixing (Cathode)' }).click()
  await drawer.getByPlaceholder('0').fill('25')
  await drawer.getByRole('button', { name: /create sub-batch/i }).click()

  await expect.poll(() => calls.patchedParent).toBe(true)
  await expect.poll(() => calls.auditRow).toBe(true)
  await expect.poll(() => calls.processRun).toBe(true)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/sprint4/split-integrity.spec.ts`
Expected: FAIL — the current `handleSubmit` only inserts the child; no PATCH, no audit row, no process run.

- [ ] **Step 3: Rewrite `handleSubmit`**

In `components/batches/create-subbatch-drawer.tsx`, replace the whole `handleSubmit` function (lines 264-301) with:

```tsx
  async function handleSubmit() {
    if (!selectedProcess) { setError('Select a process step.'); return; }
    if (!hasQty) { setError('Enter a valid quantity.'); return; }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Pre-guard: read the parent's live quantity before any write.
      //    TODO: non-atomic — there is no client transaction and no deduct RPC;
      //    a concurrent split could over-allocate between this read and the PATCH.
      const { data: parent, error: parentErr } = await supabase
        .from('batches')
        .select('current_quantity')
        .eq('id', parentId)
        .single();

      if (parentErr) {
        setError(parentErr.message || 'Could not read parent quantity');
        setSubmitting(false);
        return;
      }

      const current = parent?.current_quantity ?? 0;
      if ((qtyNum as number) > current) {
        setError(`Split exceeds available — only ${Math.round(current * 100) / 100} ${unit} remaining`);
        setSubmitting(false);
        return;
      }

      // 2. Insert the child batch, returning its id for the audit + run rows.
      const batchNumber = await nextBatchNumber(selectedProcess.code);
      const { data: newSubBatch, error: insertErr } = await supabase
        .from('batches')
        .insert({
          batch_number:      batchNumber,
          parent_batch_id:   parentId,
          material_id:       parentMaterialId,
          status:            'InProgress',
          current_quantity:  qtyNum,
          original_quantity: qtyNum,
          unit,
          current_location:  location.trim() || null,
        })
        .select('id, batch_number')
        .single();

      if (insertErr || !newSubBatch) {
        setError(
          insertErr?.code === '23505'
            ? 'A sub-batch with that generated ID already exists — try again.'
            : insertErr?.message || `DB error (${insertErr?.code})`,
        );
        setSubmitting(false);
        return;
      }

      // 3. Deduct the parent quantity (critical — surface failures).
      const { error: deductErr } = await supabase
        .from('batches')
        .update({ current_quantity: current - (qtyNum as number) })
        .eq('id', parentId);

      if (deductErr) {
        setError(`Sub-batch created but parent quantity could not be updated: ${deductErr.message}`);
        setSubmitting(false);
        return;
      }

      // 4. Audit row (best-effort — do not roll back a successful split).
      const { error: auditErr } = await supabase.from('batch_status_changes').insert({
        batch_id:    newSubBatch.id,
        changed_by:  user?.id ?? null,
        from_status: 'InProgress',
        to_status:   'InProgress',
        reason:      `Split from ${parentBatchNumber}`,
      });
      // TODO: best-effort — surfaces only to the console for the POC.
      if (auditErr) console.error('[CreateSubBatch] audit row failed', auditErr);

      // 5. Process run capturing machine/recipe/operator (best-effort).
      const now = new Date();
      const { error: runErr } = await supabase.from('process_runs').insert({
        process_id:     selectedProcess.id,
        equipment_id:   machineId || null,
        recipe_id:      recipeId || null,
        operator_id:    operatorId || user?.id,
        status:         'InProgress',
        start_date:     now.toISOString().slice(0, 10),
        start_time:     now.toTimeString().slice(0, 8),
        output_batch_id: newSubBatch.id,
      });
      // TODO: best-effort — surfaces only to the console for the POC.
      if (runErr) console.error('[CreateSubBatch] process_runs row failed', runErr);

      onCreated();
      onClose();
    } catch (err) {
      console.error('[CreateSubBatch] unexpected error', err);
      setError(err instanceof Error ? err.message : 'Unexpected error — check console');
      setSubmitting(false);
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test tests/sprint4/split-integrity.spec.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add components/batches/create-subbatch-drawer.tsx tests/sprint4/split-integrity.spec.ts
git commit -m "$(cat <<'EOF'
feat(batches): split integrity — deduct parent qty, audit row, process run

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3a: Recipe active toggle → Supabase PATCH

**Files:**
- Modify: `app/recipes/page.tsx:71-79` (`flipActive`) + imports
- Test: `tests/sprint4/recipes-toggle.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/sprint4/recipes-toggle.spec.ts`:

```ts
/**
 * Recipe active toggle (app/recipes/page.tsx) — Task 3a
 * Asserts the toggle issues a PATCH to /rest/v1/recipes and flips the UI.
 * Stateless mocks; /rest/v1/users left real (Engineer role can edit).
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const RECIPE_ID = '11111111-1111-1111-1111-111111111111'

async function setupMocks(page: Page, calls: { patched: boolean }) {
  await page.route(`**${SB}/rest/v1/recipes**`, async route => {
    if (route.request().method() === 'PATCH') { calls.patched = true; return route.fulfill({ status: 204, body: '' }) }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: RECIPE_ID, process_id: 'p1', name: 'Cathode Mix A', version: '1.0',
        recipe_number: 'RCP-001', is_active: true, notes: null, params: {},
        created_at: '2026-05-21', created_by: null, parent_recipe_id: null,
        process: { name: 'Mixing (Cathode)', code: 'MIXC' },
        creator: { full_name: 'Dev Engineer' },
      }]),
    })
  })
}

test('toggling a recipe active state PATCHes Supabase', async ({ page }) => {
  const calls = { patched: false }
  await setupMocks(page, calls)
  await page.goto('/recipes')

  await expect(page.getByText('Cathode Mix A')).toBeVisible()
  // The active toggle is the only button in the Active column; click the first row's toggle.
  const row = page.getByRole('row', { name: /Cathode Mix A/ })
  await row.getByRole('button').last().click()

  await expect.poll(() => calls.patched).toBe(true)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/sprint4/recipes-toggle.spec.ts`
Expected: FAIL — `flipActive` only mutates local state; no PATCH is sent.

- [ ] **Step 3: Add the supabase import**

In `app/recipes/page.tsx`, add after the existing imports (the file currently has no `supabase` import):

```tsx
import supabase from '@/lib/supabase';
```

- [ ] **Step 4: Make `flipActive` persist**

Replace `flipActive` (lines 71-79) with:

```tsx
  async function flipActive(id: string) {
    const base = recipes.find(r => r.id === id);
    if (!base) return;
    const next = !base.is_active;

    const { error } = await supabase
      .from('recipes')
      .update({ is_active: next })
      .eq('id', id);

    if (error) {
      showToast('Could not update recipe — try again');
      return;
    }

    const updated = { ...base, is_active: next };
    setLocalRecipes(prev => {
      const exists = prev.find(r => r.id === id);
      return exists ? prev.map(r => r.id === id ? updated : r) : [...prev, updated];
    });
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test tests/sprint4/recipes-toggle.spec.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add app/recipes/page.tsx tests/sprint4/recipes-toggle.spec.ts
git commit -m "$(cat <<'EOF'
feat(recipes): persist active toggle to Supabase

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3b: Machine active toggle + delete → Supabase

**Files:**
- Modify: `app/machines/page.tsx` — add `supabase` import; rewrite the toggle `onChange` (lines 154-161) and `handleDelete` (lines 63-72); update the delete call site (line 210)
- Test: `tests/sprint4/machines-toggle-delete.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/sprint4/machines-toggle-delete.spec.ts`:

```ts
/**
 * Machine active toggle + delete (app/machines/page.tsx) — Task 3b
 * Admin role required. Asserts toggle PATCHes /rest/v1/equipment, delete with
 * 204 removes the row, and delete returning a 23503 FK error keeps the row and
 * shows the "in use" message.
 *
 * NOTE: the saved Playwright session is the Engineer account, but the machines
 * page gates the toggle/delete on Admin. This spec stubs the /rest/v1/users
 * lookup to return an Admin role for the signed-in id (the one case where we
 * mock users — required to exercise the Admin-gated controls).
 */
import { test, expect, type Page } from '@playwright/test'

const SB = 'https://pewrwrqituidyxhfsner.supabase.co'
const EQ_ID = '22222222-2222-2222-2222-222222222222'

async function adminUser(page: Page) {
  // Force the auth context to resolve Admin so the gated controls render.
  await page.route(`**${SB}/rest/v1/users**`, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ full_name: 'Dev Admin', role_id: 'r-admin', roles: { name: 'Admin' } }),
  }))
}

async function equipmentMock(page: Page, opts: { deleteStatus: number; calls: { patched: boolean; deleted: boolean } }) {
  await page.route(`**${SB}/rest/v1/equipment**`, async route => {
    const method = route.request().method()
    if (method === 'PATCH') { opts.calls.patched = true; return route.fulfill({ status: 204, body: '' }) }
    if (method === 'DELETE') {
      opts.calls.deleted = true
      if (opts.deleteStatus === 204) return route.fulfill({ status: 204, body: '' })
      return route.fulfill({
        status: 409, contentType: 'application/json',
        body: JSON.stringify({ code: '23503', message: 'update or delete on table "equipment" violates foreign key constraint' }),
      })
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([{
        id: EQ_ID, equipment_code: 'MIX-01', name: 'Cathode Mixer', process_id: 'p1',
        supplier_info: 'Ross', is_active: true, created_at: '2026-05-21',
        process: { name: 'Mixing (Cathode)', code: 'MIXC' }, equipment_maintenance: [],
      }]),
    })
  })
}

test('toggling a machine active state PATCHes Supabase', async ({ page }) => {
  const calls = { patched: false, deleted: false }
  await adminUser(page)
  await equipmentMock(page, { deleteStatus: 204, calls })
  await page.goto('/machines')

  await expect(page.getByText('Cathode Mixer')).toBeVisible()
  const row = page.getByRole('row', { name: /MIX-01/ })
  await row.getByRole('checkbox').click()
  await expect.poll(() => calls.patched).toBe(true)
})

test('deleting a machine DELETEs and removes the row', async ({ page }) => {
  const calls = { patched: false, deleted: false }
  await adminUser(page)
  await equipmentMock(page, { deleteStatus: 204, calls })
  page.on('dialog', d => d.accept())
  await page.goto('/machines')

  await page.getByRole('row', { name: /MIX-01/ }).click() // expand
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect.poll(() => calls.deleted).toBe(true)
  await expect(page.getByText('Cathode Mixer')).toHaveCount(0)
})

test('delete blocked by FK shows the in-use message and keeps the row', async ({ page }) => {
  const calls = { patched: false, deleted: false }
  await adminUser(page)
  await equipmentMock(page, { deleteStatus: 409, calls })
  page.on('dialog', d => d.accept())
  await page.goto('/machines')

  await page.getByRole('row', { name: /MIX-01/ }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Cannot delete — equipment is in use')).toBeVisible()
  await expect(page.getByText('Cathode Mixer')).toBeVisible()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/sprint4/machines-toggle-delete.spec.ts`
Expected: FAIL — toggle/delete only mutate local state; no PATCH/DELETE; no "in use" message.

- [ ] **Step 3: Add the supabase import**

In `app/machines/page.tsx`, add after the existing imports:

```tsx
import supabase from '@/lib/supabase';
```

- [ ] **Step 4: Rewrite `handleDelete` to take the machine and call Supabase**

Replace `handleDelete` (lines 63-72) with:

```tsx
  async function handleDelete(machine: Machine) {
    const code = machine.equipment_code;
    if (!confirm(`Delete machine ${code}? This cannot be undone.`)) return;

    const { error } = await supabase.from('equipment').delete().eq('id', machine.id);

    if (error) {
      if (error.code === '23503') {
        setToast('Cannot delete — equipment is in use');
      } else {
        setToast(`Could not delete ${code} — ${error.message}`);
      }
      return;
    }

    setMachines(prev => prev.filter(m => m.equipment_code !== code));
    setExpanded(prev => {
      const copy = new Set(prev);
      copy.delete(code);
      return copy;
    });
    setToast(`Equipment ${code} deleted`);
  }
```

- [ ] **Step 5: Update the delete call site**

In `app/machines/page.tsx`, the Delete button (currently line ~210) calls `handleDelete(m.equipment_code)`. Change it to pass the machine:

```tsx
                                      onClick={e => { e.stopPropagation(); handleDelete(m); }}
```

- [ ] **Step 6: Persist the active toggle**

Replace the checkbox `onChange` (lines 154-161) with an async handler that PATCHes and rolls back on error:

```tsx
                                  onChange={async e => {
                                    const next = e.target.checked;
                                    setMachines(prev => prev.map(x =>
                                      x.equipment_code === m.equipment_code ? { ...x, is_active: next } : x
                                    ));
                                    const { error } = await supabase
                                      .from('equipment')
                                      .update({ is_active: next })
                                      .eq('id', m.id);
                                    if (error) {
                                      setMachines(prev => prev.map(x =>
                                        x.equipment_code === m.equipment_code ? { ...x, is_active: !next } : x
                                      ));
                                      setToast(`Could not update ${m.equipment_code}`);
                                    }
                                  }}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx playwright test tests/sprint4/machines-toggle-delete.spec.ts`
Expected: PASS (all three tests).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 9: Commit**

```bash
git add app/machines/page.tsx tests/sprint4/machines-toggle-delete.spec.ts
git commit -m "$(cat <<'EOF'
feat(machines): persist active toggle + delete with FK-error handling

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Full verification + docs

**Files:**
- Modify: `docs/SESSION_LOG.md`, `docs/FLINT_REFERENCE_21052026.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all specs green — existing `tests/sprint3/*` plus the four new `tests/sprint4/*`.

- [ ] **Step 2: Final typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Confirm only the intended files changed**

Run: `git diff --name-only main...HEAD`
Expected: exactly — `components/subbatch/genealogy.tsx`, `app/batches/[id]/[subId]/page.tsx`, `components/batches/create-subbatch-drawer.tsx`, `app/recipes/page.tsx`, `app/machines/page.tsx`, `tests/sprint4/*.spec.ts`, plus the two docs from Step 4 and the spec/plan docs.

- [ ] **Step 4: Update the docs (required before push by CLAUDE.md)**

Append a session entry to `docs/SESSION_LOG.md`:

```markdown
## [2026-06-04] — Sprint 4: genealogy, split integrity & toggles
- What changed: genealogy panel wired to trace_batch_genealogy (p_batch_id); Create Sub-batch drawer now deducts parent current_quantity (guarded), writes a batch_status_changes audit row, and inserts a process_runs row (output_batch_id = sub-batch); recipe active toggle PATCHes recipes.is_active; machine active toggle PATCHes equipment.is_active and Delete DELETEs with 23503 FK handling. Added tests/sprint4/ (genealogy, split-integrity, recipes-toggle, machines-toggle-delete).
- Gaps closed: Gap 2 (genealogy panel), Gap 4 (split integrity), Gap 6 (toggles).
- New gaps found: split is non-atomic (no client transaction / no deduct RPC) — candidate for a backend RPC. SUBBATCH_DETAIL / MAIN_BATCHES now have no live importers — delete from lib/data.ts in cleanup.
- Ref doc updated: yes
```

In `docs/FLINT_REFERENCE_21052026.md`: bump **Last updated** to 2026-06-04 (append a one-line note to the Status line); in §11 flip "Recipe active toggle" backend to ✅, "Machine add/edit/deactivate" toggle/delete to ✅, and note the genealogy panel + split persistence are wired.

- [ ] **Step 5: Commit the docs**

```bash
git add docs/SESSION_LOG.md docs/FLINT_REFERENCE_21052026.md
git commit -m "$(cat <<'EOF'
docs(sprint4): session log + reference update for genealogy/split/toggles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Task 1 (genealogy panel, p_batch_id, loading/empty/tree, mock imports removed, page prop + TODO removal) → Plan Task 1 ✅
- Task 2 (pre-guard, child returning select, parent deduct, audit row, process_runs) → Plan Task 2 ✅
- Task 3a (recipes toggle PATCH, canEdit gate kept) → Plan Task 3a ✅ (gate unchanged — button still only renders under `canEdit`)
- Task 3b (machine toggle PATCH, delete DELETE, 23503 handling, isAdmin gate kept) → Plan Task 3b ✅
- Tests in tests/sprint4/ → genealogy, split-integrity, recipes-toggle, machines-toggle-delete ✅
- tsc + npm test + file-scope check → Plan Task 4 ✅

**Placeholder scan:** No TBD/TODO-as-instruction; the two `// TODO` comments in shipped code are intentional (documented race + best-effort failures), per the spec.

**Type consistency:** `GenealogyRow` (Task 1) matches the RPC shape used in `recall/page.tsx`. `handleDelete(machine: Machine)` signature change is reflected at its call site (Task 3b Step 5). `flipActive` keeps its `(id: string)` signature. `Machine.id` and `AuthUser.id` both verified present.
