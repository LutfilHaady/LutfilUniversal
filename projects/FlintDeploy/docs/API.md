# Flint Traceability — API Layer Reference

**Last updated:** 2026-06-24  
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL 17)  
**Supabase project:** `pewrwrqituidyxhfsner` · Region: Tokyo (`ap-northeast-1`)

---

## Architecture Overview

There is **no custom REST API**. The frontend communicates directly with Supabase using three mechanisms:

| Layer | What it is | Where |
|---|---|---|
| **SWR hooks** | Read-side data fetching with cache/revalidation | `lib/hooks/` |
| **Supabase RPCs** | Write-side PostgreSQL functions (atomic, SECURITY DEFINER) | Called via `supabase.rpc()` |
| **Utility functions** | Cross-cutting operations (search, alerts scan, PDF export) | `lib/global-search.ts`, `lib/alerts/scan.ts`, `lib/reports/pdf-export.ts` |
| **Admin actions** | Inline async functions in the Admin page using the service-role client | `app/admin/page.tsx` |

```
Browser component
  └── SWR hook (lib/hooks/)
        └── supabase.from('table').select(...)   ← reads, RLS-respecting anon key
        └── supabase.rpc('function', {...})       ← writes, SECURITY DEFINER
```

### Supabase client

```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!   // legacy JWT eyJ… key — NOT sb_publishable_*
)
```

> ⚠️ Always use the **legacy JWT anon key** from Dashboard → Settings → API. The `sb_publishable_*` format causes silent hangs with `createBrowserClient`.

### Auth & roles

All queries run under the logged-in user's JWT. RLS is **ON** on all 24 tables.  
Roles: `Operator` · `Engineer` · `Admin` — stored in `public.users.role_id`.  
The `get_my_role()` STABLE SECURITY DEFINER helper resolves the caller's role inside RLS policies.

---

## SWR Data Hooks

All hooks live in `lib/hooks/`. They use `useSWR` from the `swr` package. Each returns `{ data, loading, error }`. Errors are normalised to `string | null`.

### Key SWR cache keys

| Key | Hook | Invalidated by |
|---|---|---|
| `['batches', role, deepHistory]` | `useBatches` | Batch create/status change |
| `['batch', id]` | `useBatch` | Sub-batch edit |
| `'lots'` | `useLots` | Lot generation, EditLotDrawer |
| `['lot', id]` | `useLot` | EditLotDrawer mutations |
| `'machines'` | `useMachines` | Add/Edit/Delete equipment |
| `'recipes'` | `useRecipes` | Recipe create/edit/toggle |
| `'alerts'` | `useAlerts` | `dismiss()`, `scanAlerts()` |
| `['dashboard', role]` | `useDashboard` | — (no manual invalidation) |
| `['yield-trend', period]` | `useYieldTrend` | — |
| `['process-route', materialId]` | `useProcessRoute` | — |
| `['process-timeline', subBatchId]` | `useProcessTimeline` | — |

To manually revalidate from outside a hook: `import { mutate } from 'swr'; mutate('key')`.

---

### `useBatches(deepHistory?: boolean)`

**File:** `lib/hooks/useBatches.ts`

Fetches all main (parent) batches with their sub-batches. Applies a date window filter based on the logged-in user's role.

**Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `deepHistory` | `boolean` | `false` | If `true` (Engineer/Admin only), expands date window to 30 days. `Operator` is always capped at 7 days regardless. |

**Returns:**

```ts
{
  batches: MainBatch[]   // parent batches with embedded sub_batches[]
  loading: boolean
  error: string | null
}
```

**Date window logic:**
- `Operator` → last **7 days** of sub-batch activity (always, ignores `deepHistory`)
- `Engineer` / `Admin`, `deepHistory=false` → last **7 days**
- `Engineer` / `Admin`, `deepHistory=true` → last **30 days**

The filter applies to sub-batch `created_at`/`updated_at`, not the parent's `created_at`. A parent created 6 weeks ago still appears if it has a recently-updated sub-batch.

**Supabase query (simplified):**
```ts
supabase.from('batches')
  .select('*, material:materials(name, code, type), intake:batch_raw_material_intake(...), sub_batches:batches!parent_batch_id(...)')
  .is('parent_batch_id', null)
  .order('created_at', { ascending: false })
```

---

### `useBatch(id: string)`

**File:** `lib/hooks/useBatch.ts`

Fetches a single batch (main or sub) by UUID, with material and parent-batch joins.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | UUID of the batch (`batches.id`) — never use `batch_number` as a key |

**Returns:**

```ts
{
  batch: SubBatchDetail | null   // null while loading or if not found
  loading: boolean
  error: string | null
}

interface SubBatchDetail extends SubBatch {
  material: { name: string; code: string } | null
  parent_batch: { id: string; batch_number: string } | null
}
```

SWR key is `null` when `id` is falsy — the query is skipped.

---

### `useBatchByNumber(batchNumber: string | null)`

**File:** `lib/hooks/useBatchByNumber.ts`

Looks up a batch by its human-facing `batch_number` (e.g. `MIXC-20260430-A01`). Used after a QR scan. Uses `useEffect`/`useState` instead of SWR (no caching — each scan should be a fresh fetch).

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `batchNumber` | `string \| null` | The scanned or typed batch number. `null`/empty → no query fires. |

**Returns:**

```ts
{
  batch: SubBatch | null
  loading: boolean
  error: 'not_found' | string | null   // 'not_found' = PGRST116, no match
}
```

**Note:** `batch_number` has a unique constraint in the DB — `.single()` is safe here.

---

### `useLots()`

**File:** `lib/hooks/useLots.ts`

Fetches all lots ordered newest-first, with their linked sub-batch IDs.

**Returns:**

```ts
{
  lots: Lot[]
  loading: boolean
  error: string | null
}
```

**Supabase query:**
```ts
supabase.from('lots').select('*, lot_sub_batches(sub_batch_id)').order('created_at', { ascending: false })
```

---

### `useLot(id: string)`

**File:** `lib/hooks/useLot.ts`

Fetches a single lot by UUID, with full joins: sub-batches (including their `batch_number`) and serialised units.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | UUID of the lot (`lots.id`) |

**Returns:**

```ts
{
  lot: Lot | null
  loading: boolean
  error: string | null
}
```

The `Lot` type includes:
- `lot_sub_batches[].sub_batch.batch_number` — human-readable sub-batch code
- `units[].sub_batch.batch_number` — source sub-batch for each unit

SWR key: `['lot', id]`. Invalidate with `mutate(['lot', id])` after EditLotDrawer mutations.

---

### `useMachines()`

**File:** `lib/hooks/useMachines.ts`

Fetches all equipment rows with their linked process and full maintenance history, sorted by most recent maintenance entry first.

**Returns:**

```ts
{
  machines: Machine[]
  loading: boolean
  error: string | null
}
```

**Note:** Types come from `components/machines/types.ts` (not `lib/types.ts`) — see GAP-05 in the gap analysis.

**Supabase query:**
```ts
supabase.from('equipment')
  .select('*, process:processes(name, code), equipment_maintenance(*)')
  .order('equipment_code')
```

---

### `useRecipes()`

**File:** `lib/hooks/useRecipes.ts`

Fetches all recipes ordered newest-first, with their linked process and creator name.

**Returns:**

```ts
{
  recipes: Recipe[]
  loading: boolean
  error: string | null
}
```

`Recipe.params` is a `JSONB` column (not EAV rows). The `recipe_parameters` table is not read by the frontend.

---

### `useAlerts()`

**File:** `lib/hooks/useAlerts.ts`

Fetches all unresolved alerts. **Triggers `scanAlerts()` on every read** to generate new alerts and auto-resolve stale ones before returning data.

**Returns:**

```ts
{
  alerts: AlertView[]
  loading: boolean
  error: string | null
  dismiss: (id: string) => Promise<void>
}

interface AlertView {
  id: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  batchId: string | null
  createdAt: string
}
```

**`dismiss(id)`** — Sets `resolved_at = now()` on the alert row and revalidates the `'alerts'` SWR cache. Available to Engineer/Admin roles (enforced in the UI, not the DB).

**Used on:** `/alerts` page · dashboard banner · dashboard alert panel · header bell icon.

---

### `useDashboard()`

**File:** `lib/hooks/useDashboard.ts`

Aggregates dashboard KPI data in a single parallel fetch. Applies the Operator 7-day cap.

**Returns:**

```ts
{
  subBatches: SubBatch[]         // active sub-batches (role-filtered)
  alerts: DbAlert[]              // unresolved alerts (raw DB shape)
  qcPassRateSevenDay: number     // 0–100, rolling 7-day QC pass rate
  firstPassYield: number | null  // 0–100, % of process runs with all QC passed
  topDefect: string | null       // most common failed QC item name (7d)
  activeAlertCount: number       // count of unresolved alerts
  loading: boolean
  error: string | null
}
```

**KPI calculations (all computed client-side):**
- `qcPassRateSevenDay` — `(passed checks / total checks) * 100` over last 7 days
- `firstPassYield` — % of `process_run_id` groups where all `qc_check_results.passed = true` in last 7 days
- `topDefect` — mode of `qc_check_definitions.qc_item_name` among `passed=false` rows in last 7 days

---

### `useYieldTrend(period: '7d' | '14d' | '30d')`

**File:** `lib/hooks/useYieldTrend.ts`

Builds a day-by-day yield percentage series for the trend chart.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `period` | `'7d' \| '14d' \| '30d'` | Rolling date window |

**Returns:**

```ts
{
  points: YieldPoint[]   // [{ day: 'Jun 22', yield: 94.6 }, ...]
  loading: boolean
  error: string | null
}
```

Yield per day = `(Released sub-batches / total completed sub-batches) * 100`. Queries sub-batches with status `Released`, `Scrapped`, or `Quarantine`.

---

### `useProcessRoute(materialId: string | null)`

**File:** `lib/hooks/useProcessRoute.ts`

Calls the `get_process_route` RPC to return the ordered list of process steps for a given material. Used to drive the dynamic process stepper on sub-batch detail and the process log page.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `materialId` | `string \| null` | UUID of the material (`materials.id`). `null` → query skipped. |

**Returns:**

```ts
{
  steps: ProcessStep[]
  loading: boolean
  error: string | null
}

interface ProcessStep {
  process_id: string
  code: string              // e.g. 'MIXC', 'CTGC'
  name: string              // e.g. 'Mixing - Cathode'
  sequence_hint: number     // ordering index
  requires_calibration: boolean
}
```

---

### `useProcessTimeline(subBatchId: string | null)`

**File:** `lib/hooks/useProcessTimeline.ts`

Fetches and merges process runs + QC check results for a sub-batch into a single chronological timeline. Deduplicates entries, computes QC pass/fail client-side.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `subBatchId` | `string \| null` | UUID of the sub-batch. `null` → skipped. |

**Returns:**

```ts
{
  timeline: ProcessRunTimeline[]   // sorted newest-first, type: 'process' | 'qc'
  loading: boolean
  error: string | null
}
```

**QC pass/fail computation** (in `computeQCPassed`): reads `acceptance_criteria_text` from `qc_check_definitions` and parses formats: `"X-Y"` (range), `"≥X"`, `"≤X"`, exact value. Falls back to `false` if criteria cannot be parsed.

---

## Supabase RPCs

All RPCs are PostgreSQL functions defined in `supabase/migrations/`. Call via `supabase.rpc('name', params)`. All write-path RPCs are `SECURITY DEFINER` — they run as the function owner, not the caller, so they can bypass RLS for atomic writes while still enforcing business rules.

---

### `log_mixing_step`

Creates a new immutable mixing step with transaction-safe auto-incrementing `step_number`.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `p_batch_id` | `UUID` | UUID of the MIXC/MIXE batch |
| `p_type` | `TEXT` | `'add_material'` \| `'mix_round'` \| `'qc_check'` |
| `p_label` | `TEXT` | Human-readable step name e.g. `'Add DI Water'` |
| `p_params` | `JSONB` | Step-specific payload (see shapes below) |
| `p_operator` | `UUID` | UUID of the logged-in user |

**`p_params` shapes by type:**

```ts
// add_material
{ material_code: string; materialName: string; quantity: number; unit: 'kg' | 'L' | 'g' | 'mL' }

// mix_round
{ durationMinutes: number; temperatureCelsius: number; internalPressureBar: number; dispersionRpm: number; propellerRpm: number }

// qc_check
{ checks: Array<{ definitionId: string; itemName: string; method: 'VisualManual' | 'ToolEquipment'; resultValue: string; passed: boolean }> }
```

**Returns:** Full `mixing_steps` row including auto-generated `step_number` and `display_ref`.

`display_ref` format: `"MIXC-20260430-A01 / Add DI Water · Step 01"`

**Usage:**
```ts
const { data, error } = await supabase.rpc('log_mixing_step', {
  p_batch_id: batchId,
  p_type: 'add_material',
  p_label: 'Add DI Water',
  p_params: { material_code: 'MTDW', materialName: 'DI Water', quantity: 5.2, unit: 'kg' },
  p_operator: userId,
})
```

---

### `update_mixing_step_status`

Marks a mixing step as `completed` or `voided`. Stamps `completed_at`. Steps cannot be deleted.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `p_step_id` | `UUID` | UUID of the `mixing_steps` row |
| `p_status` | `TEXT` | `'completed'` \| `'voided'` |

**Returns:** Updated `mixing_steps` row with `completed_at` stamped.  
**Throws:** If the step is not found or the status value is invalid.

---

### `transition_batch_status`

**⚠️ Always use this RPC for status changes — never a direct PATCH on `batches`.**

Validates the state machine transition, updates `batches.status`, and atomically inserts a `batch_status_changes` audit row in a single transaction.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `p_batch_id` | `UUID` | UUID of the batch |
| `p_new_status` | `TEXT` | Target status (must be a valid `batch_status` enum) |
| `p_reason` | `TEXT` | Human-readable reason for the change |
| `p_user_id` | `UUID` | UUID of the user making the change |

**Returns:** Updated `batches` row.  
**Throws:** If the transition is not valid for the current status.

**Valid transitions:**
```
InProgress  → Released | OnHold | Quarantine | Scrapped
OnHold      → Released | Quarantine | Scrapped
Quarantine  → Released | Scrapped
(no backward transitions)
```

**Usage:**
```ts
const { data, error } = await supabase.rpc('transition_batch_status', {
  p_batch_id: batchId,
  p_new_status: 'Released',
  p_reason: 'End-of-run QC passed',
  p_user_id: userId,
})
```

---

### `trace_batch_genealogy`

Recursive CTE that returns all ancestors and descendants of a batch, including the batch itself.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `p_batch_id` | `UUID` | UUID of the batch to trace from |

**Returns:** Array of rows:

```ts
{
  id: string
  batch_number: string
  parent_batch_id: string | null
  material_id: string
  status: BatchStatus
  current_quantity: number | null
  unit: string | null
  depth: number          // negative = ancestor, 0 = self, positive = descendant
  direction: 'ancestor' | 'self' | 'descendant'
}[]
```

**Usage:**
```ts
const { data, error } = await supabase.rpc('trace_batch_genealogy', { p_batch_id: batchId })
// Filter: data.filter(r => r.direction === 'ancestor')
```

---

### `get_process_route`

Returns the ordered list of process steps for a given material, using `materials.first_process_id` + `processes.sequence_hint`.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `p_material_id` | `UUID` | UUID of the material (`materials.id`) |

**Returns:**
```ts
{ process_id: string; code: string; name: string; sequence_hint: number; requires_calibration: boolean }[]
```

Ordered by `sequence_hint` ascending.

---

### `generate_lot`

Atomically creates a lot, links sub-batches via `lot_sub_batches`, and creates serialised unit rows.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `p_lot_number` | `TEXT` | Human-facing lot code e.g. `'LOT-20260521-001'` |
| `p_category` | `TEXT` | Lot category e.g. `'standard'` |
| `p_battery_type` | `TEXT` | e.g. `'LFP'` |
| `p_storage_location` | `TEXT` | Storage location string |
| `p_notes` | `TEXT` | Optional notes |
| `p_created_by` | `UUID` | UUID of the creating user |
| `p_sub_batch_ids` | `UUID[]` | Array of sub-batch UUIDs to include |
| `p_unit_serials` | `TEXT[]` | Array of serial numbers for each unit |

**Returns:** Created `lots` row.

---

### `handle_new_user` *(trigger — not called directly)*

Fires on `AFTER INSERT ON auth.users`. Auto-creates a corresponding `public.users` row with matching UUID. Role must be assigned manually by an Admin afterwards.

---

## Utility Functions

### `runSearch(raw: string): Promise<SearchResult[]>`

**File:** `lib/global-search.ts`

Debounced full-text search across batches, lots, recipes, and equipment using `ilike`. Used by the `⌘K` command palette.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `raw` | `string` | User-typed search term. Special chars `,()*%` are sanitised. |

**Returns:**
```ts
interface SearchResult {
  kind: 'batch' | 'lot' | 'recipe' | 'machine'
  id: string
  title: string       // batch_number, lot_number, recipe name, machine name
  subtitle: string    // e.g. 'Sub-batch · InProgress'
  href: string        // navigation target
}
```

Runs 4 queries in parallel (batches, lots, recipes, equipment). Limits: 6 batch results, 5 each for lots/recipes/machines.

---

### `resolveExactMatch(raw: string): Promise<SearchResult | null>`

**File:** `lib/global-search.ts`

Case-insensitive exact lookup for QR scan results. Checks in order: batch → lot → recipe → equipment. Returns the first match or `null`.

Used by the QR scanner modal to decide whether to navigate directly or fall back to the search palette.

---

### `scanAlerts(): Promise<void>`

**File:** `lib/alerts/scan.ts`

App-side alert generation engine. For each enabled rule in `alert_rules`, queries current state and inserts alerts whose `dedup_key` is not already active. Also auto-resolves open alerts whose condition has cleared.

**Alert rules (built-in):**

| Rule key | Trigger condition | Threshold |
|---|---|---|
| `qc_fail` | `qc_check_results.passed = false` in last 30 days | — |
| `batch_held` | `batches.status IN ('OnHold', 'Quarantine', 'Scrapped')` | — |
| `maintenance_overdue` | `equipment_maintenance.next_due_date < today - threshold` | `threshold` days grace |
| `expiry_soon` | `batches.expiry_date <= today + threshold` | `threshold` days lead |

**Idempotency:** Dedup via `alerts.dedup_key` — a partial unique index (`alerts_dedup_active`) prevents duplicate active alerts. Concurrent scans that race on insert get a `23505` conflict which is silently ignored.

**Called by:** `useAlerts()` on every fetch — not on a timer or DB trigger (see GAP-15 in gap analysis).

---

### `exportPdf(payload: PdfPayload): void`

**File:** `lib/reports/pdf-export.ts`

Generates and triggers a browser download of a branded A4 landscape PDF report using `jsPDF` + `jspdf-autotable`.

**Parameters:**

```ts
interface PdfPayload {
  tab: 'Batch Summary' | 'QC Analysis' | 'Defect Trends' | 'Compliance'
  dateFrom: string       // 'YYYY-MM-DD'
  dateTo: string         // 'YYYY-MM-DD'
  batchRows: any[]       // raw Supabase batch rows
  qcRows: any[]          // raw qc_check_results rows with joins
  defectRows: { name: string; count: number }[]
  compliance: {
    total: number; passCount: number; failCount: number;
    overrideCount: number; passRate: number
  } | null
}
```

**Output:** Triggers `doc.save('flint-{tab}-{dateFrom}-to-{dateTo}.pdf')` directly in the browser. No return value.

---

## Admin Actions

These are inline async functions in `app/admin/page.tsx`. They use the standard anon Supabase client — they are **not** Next.js server actions and do not have the `'use server'` directive. They are client-side calls that succeed only because the logged-in user has the `Admin` role (enforced by RLS + the page-level `useAuth()` guard).

| Function | What it does | Tables touched |
|---|---|---|
| `handleAddUser()` | Inserts a new user via Supabase Auth Admin API (requires `SUPABASE_SERVICE_ROLE_KEY`) + assigns role | `auth.users`, `public.users` |
| `handleSaveUser(u)` | PATCHes `full_name`, `role_id`, `staff_code` on an existing user | `public.users` |
| `handleDeleteUser(userId, name)` | DELETEs the `public.users` row (does not delete from `auth.users`) | `public.users` |
| `handleToggleActive(userId, currentActive)` | PATCHes `is_active` to flip activation state | `public.users` |
| `handleResetPassword()` | Calls `supabase.auth.admin.generateLink({ type: 'recovery', email })` | `auth` |

> ⚠️ `handleAddUser` and `handleResetPassword` require `SUPABASE_SERVICE_ROLE_KEY` to be set in both `.env.local` and Vercel environment variables. If unset, these calls return a 401 and show "Missing Supabase admin env vars".

---

## TypeScript Types Reference

**File:** `lib/types.ts`

### Enums

```ts
type BatchStatus      = 'InProgress' | 'Released' | 'OnHold' | 'Quarantine' | 'Scrapped'
type ProcessRunStatus = 'InProgress' | 'AwaitingQC' | 'Passed' | 'Failed' | 'Overridden'
type MixingStepType   = 'add_material' | 'mix_round' | 'qc_check'
type MixingStepStatus = 'in_progress' | 'completed' | 'voided'
```

> DB enums are **PascalCase** in the live Supabase DB: `VisualManual`, `ToolEquipment`, `Startup`, `EndOfRun`. Do not use kebab-case variants.

### Core types

```ts
interface SubBatch {
  id: string                          // UUID — always use for queries
  batch_number: string                // human code e.g. 'MIXC-20260430-A01-01'
  parent_batch_id: string | null      // null = main batch
  material_id: string
  status: BatchStatus
  current_quantity: number | null
  original_quantity: number | null
  unit: string | null
  current_location: string | null
  created_at: string
  updated_at: string
  material?: { name: string; code: string; type?: string } | null
}

interface MainBatch extends Omit<SubBatch, 'material'> {
  material: { name: string; code: string; type: string } | null
  intake: { supplier_name: string | null; date_received: string | null } | null
  sub_batches: SubBatch[]
}

interface Recipe {
  id: string
  recipe_number: string | null        // e.g. 'RCP-001'
  name: string
  process_id: string
  version: string                     // semver text e.g. '3.2'
  is_active: boolean
  params: Record<string, unknown>     // JSONB — source of truth, not recipe_parameters EAV
  parent_recipe_id: string | null
  process: { name: string; code: string } | null
  creator: { full_name: string } | null
}

interface Lot {
  id: string
  lot_number: string
  category: string
  unit_count: number
  status: LotStatus
  battery_type: string | null
  storage_location: string | null
  lot_sub_batches: {
    sub_batch_id: string
    sub_batch?: { batch_number: string; parent_batch_id: string | null } | null
  }[]
  units?: Unit[]
}
```

---

## Common Patterns

### Writing a new SWR hook

```ts
'use client'
import useSWR from 'swr'
import supabase from '@/lib/supabase'

async function fetchThing(id: string) {
  const { data, error } = await supabase.from('table').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export function useThing(id: string) {
  const { data, isLoading, error } = useSWR(
    id ? ['thing', id] : null,          // null key = skip query
    ([, thingId]) => fetchThing(thingId)
  )
  return { thing: data ?? null, loading: isLoading, error: (error as Error | null)?.message ?? null }
}
```

### Triggering a status change

```ts
// Always use the RPC — never supabase.from('batches').update({ status: ... })
const { error } = await supabase.rpc('transition_batch_status', {
  p_batch_id: batch.id,
  p_new_status: 'OnHold',
  p_reason: 'Contamination suspected',
  p_user_id: user.id,
})
```

### Invalidating a cache key after a mutation

```ts
import { mutate } from 'swr'

// After editing a lot:
await supabase.from('lot_sub_batches').insert({ lot_id, sub_batch_id })
await mutate(['lot', lotId])   // revalidates useLot(lotId)
await mutate('lots')           // revalidates useLots()
```

### Querying by batch_number (QR scan)

```ts
// batch_number is a unique TEXT field — safe to use .single()
const { data, error } = await supabase
  .from('batches')
  .select('*')
  .eq('batch_number', scannedCode)
  .single()
// error.code === 'PGRST116' means not found
```
