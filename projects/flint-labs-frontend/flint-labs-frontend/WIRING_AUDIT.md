# Flint — Wiring Audit
Generated: 2026-06-04 (post alerts-MVP merge)

> Read-only audit. No source file was modified. "Wired" = every step of a workflow
> chain reaches a real `supabase.from(...)` / `supabase.rpc(...)` / `supabase.auth.admin.*`
> call that persists or reads data. Local-state-only handlers, callbacks without a
> preceding Supabase call, and TODO comments do **not** count.
>
> **What changed since the previous audit (same day):**
> `lib/alerts-data.ts` deleted · `lib/hooks/useAlerts.ts` + `lib/alerts/scan.ts` +
> `lib/alerts/types.ts` added · `alert-panel.tsx`, `header.tsx`, `alert-banner.tsx`,
> `app/alerts/page.tsx` all rewired to `useAlerts` · `components/admin/alert-rules-panel.tsx`
> added to admin Settings tab. Alerts gap from previous report is now **closed (MVP)**.

## Summary

| Status | Count |
|--------|-------|
| ✅ Fully wired | 16 |
| ⚠️ Partially wired | 5 |
| ❌ Not wired | 2 |
| 🔒 Blocked on backend | 0 |
| 📁 Missing file | 1 |

---

## Core workflow chains

### Chain 1 — Raw material intake
**Status:** ⚠️ Partial
**File(s):** `components/batches/create-batch-modal.tsx`

| Step | Required | Found in code | Status |
|------|----------|---------------|--------|
| `batches` INSERT (`material_id`, `batch_number`, `quantity`, `status='InProgress'`) | Yes | Yes | ✅ |
| `batch_raw_material_intake` INSERT (`supplier_name`, `po_number`, `sample_id`) | Yes | No — supplier/lotRef collected in state, never inserted | ❌ |
| QR generated from `batch_number` | Yes | No — batch number is generated client-side but no QR is rendered/persisted in this flow | ❌ |
| `batch_status_changes` INSERT (initial status) | Yes | No | ❌ |

**Gap:** Only the `batches` row is written. Intake metadata (`batch_raw_material_intake`), initial audit row, and QR generation are all absent. The form collects supplier/PO/lot/notes fields but discards them on submit.

---

### Chain 2 — Production run (process step log)
**Status:** ⚠️ Partial
**File(s):** `app/log/process-step/page.tsx`

| Step | Required | Found in code | Status |
|------|----------|---------------|--------|
| `qc_check_definitions` SELECT by `process_id` (calibration check) | Yes | No — page never queries `qc_check_definitions` | ❌ |
| `process_runs` INSERT (`process_id`, `operator_id`, `start_date`, `start_time`, `status='InProgress'`) | Yes | Yes — but no `equipment_id` or `recipe_id` written | ⚠️ |
| `process_run_inputs` INSERT after step 2 (`process_run_id`, `input_batch_id`, `quantity_consumed`) | Yes | Yes — correctly sequenced after run INSERT | ✅ |
| `process_run_parameters` INSERT, one row per parameter | Yes | Yes — loops `paramValues` entries | ✅ |
| `process_runs` PATCH `end_date`/`end_time` on completion | Yes | No — run is never closed | ❌ |

**Gap:** Run created and inputs/params persisted, but `equipment_id`/`recipe_id` dropped, no calibration `qc_check_definitions` lookup, and no end-time stamp. Parameters come from a hardcoded `PARAMS_BY_CODE` map, not from the selected recipe.

---

### Chain 3 — QC log (end-of-run)
**Status:** ✅ Complete (core persistence — output QR not generated)
**File(s):** `app/log/qc/page.tsx`

| Step | Required | Found in code | Status |
|------|----------|---------------|--------|
| `qc_check_definitions` SELECT by `process_id` (dynamic) | Yes | Yes — fetched per resolved run's `process_id` | ✅ |
| Per-item `passed` computed vs acceptance criteria | Yes | Yes — `computePassed()` for `<`/`>` criteria; `±`/range falls back to manual confirm | ✅ |
| `qc_check_results` INSERT one per def (`process_run_id`, `qc_check_definition_id`, `performed_by`, `timing`, result, `passed`) | Yes | Yes — loops all defs, correct column names | ✅ |
| Pass path: output `batches` INSERT + `process_runs` PATCH + `batch_status_changes` INSERT + output QR | Yes | `batches` INSERT ✅, `process_runs` PATCH status + `output_batch_id` ✅, `batch_status_changes` INSERT ✅, QR not generated ❌ | ✅ (minus QR) |
| Fail path: input `batches` PATCH `OnHold` + `process_runs` PATCH `Failed` + `batch_status_changes` INSERT | Yes | All three present | ✅ |

**Gap:** Output QR not generated (display artifact only). Fail-path audit row hardcodes `from_status: 'Released'` regardless of actual prior status.

---

### Chain 4 — QC override
**Status:** ✅ Complete
**File(s):** `app/qc-override/page.tsx`

| Step | Required | Found in code | Status |
|------|----------|---------------|--------|
| Failed `qc_check_results` fetched from Supabase | Yes | Yes — `.eq('passed', false)`, filters already-overridden | ✅ |
| `override_reason` validated non-empty before insert | Yes | Yes — guard + disabled button | ✅ |
| `qc_overrides` INSERT (`qc_check_result_id`, `overridden_by`, `override_reason`) | Yes | Yes | ✅ |
| `process_runs` PATCH `status='Overridden'` | Yes | Yes | ✅ |
| `batches` PATCH input batch `status='Released'` | Yes | Yes | ✅ |
| `batch_status_changes` INSERT | Yes | Yes — `OnHold → Released` with reason | ✅ |

**Gap:** None. Fully wired with error handling on each step.

---

### Chain 5 — Sub-batch splitting + mixing
**Status:** ⚠️ Partial
**File(s):** `components/batches/create-subbatch-drawer.tsx`, `components/subbatch/add-step-modal.tsx`, `components/subbatch/mixing-steps-panel.tsx`, `app/batches/[id]/[subId]/page.tsx`

| Step | Required | Found in code | Status |
|------|----------|---------------|--------|
| Sub-batch `batches` INSERT with `parent_batch_id` | Yes | Yes — drawer inserts child with `parent_batch_id`, inherited `material_id` | ✅ |
| Parent `current_quantity` PATCH (deduct split amount) | Yes | No — remaining computed for display only | ❌ |
| `log_mixing_step` RPC before local state update | Yes | Yes — awaited before `onSubmit` in `add-step-modal` | ✅ |
| `update_mixing_step_status` RPC on complete/void | Yes | Yes — awaited before state update in `mixing-steps-panel` | ✅ |
| `mixing_steps` SELECT by `batch_id` on page load | Yes | Yes — `[subId]/page.tsx` queries live `mixing_steps` | ✅ |

**Gap:** Parent batch quantity not deducted. Drawer captures machine/recipe/operator but does not persist them (no `process_runs` row). No initial `batch_status_changes` for the new sub-batch.

---

### Chain 6 — Audit trail integrity
**Status:** ⚠️ Partial

| File | Handler | Status set | `batch_status_changes` INSERT |
|------|---------|-----------|-------------------------------|
| `app/batches/[id]/page.tsx` | `ChangeStatusControl.confirm` | any valid transition | Yes — `transition_batch_status` RPC (atomic) |
| `app/log/qc/page.tsx` | `handleSubmit` (pass) | output batch `Released` | Yes — explicit INSERT |
| `app/log/qc/page.tsx` | `handleSubmit` (fail) | input batch `OnHold` | Yes — explicit INSERT |
| `app/qc-override/page.tsx` | `handleSubmit` | input batch `Released` | Yes — explicit INSERT |
| `components/batches/create-batch-modal.tsx` | `handleSubmit` | new batch `InProgress` | **No** |
| `components/batches/create-subbatch-drawer.tsx` | `handleSubmit` | new sub-batch `InProgress` | **No** |
| `components/subbatch/identity-header.tsx` | `handleStatusChange` / `confirmScrap` | any status | **No — local state only, nothing persisted** |

**Gap:** `identity-header.tsx` status buttons mutate local React state only — no `transition_batch_status` RPC, no `batch_status_changes` row. Initial batch and sub-batch INSERTs write no opening audit row.

---

## Page-by-page wiring status

### app/log/process-step/page.tsx
**Status:** ⚠️ Partially wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Auto-lookup by `subbatchId` URL param | Yes | `batches` SELECT `.eq('id', …)` | ✅ |
| Scan/manual batch lookup | Yes | `batches` SELECT `.eq('batch_number', …)` | ✅ |
| Load process step options | Yes | `get_process_route` RPC via `useProcessRoute` | ✅ |
| Submit run | Yes | `process_runs` INSERT → `process_run_inputs` INSERT → `process_run_parameters` INSERT | ✅ |

**Notes:** No `equipment_id`/`recipe_id` written; no end-time PATCH; no calibration lookup. Parameters from hardcoded `PARAMS_BY_CODE` map, not recipe.

---

### app/log/qc/page.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Batch lookup | Yes | `batches` SELECT | ✅ |
| Resolve process run | Yes | `process_run_inputs` SELECT, `process_runs` SELECT | ✅ |
| Calibration flag | Yes | `processes` SELECT `requires_calibration` | ✅ |
| Load QC definitions | Yes | `qc_check_definitions` SELECT by `process_id` | ✅ |
| Submit QC results | Yes | `qc_check_results` INSERT per item | ✅ |
| Pass path | Yes | `batches` INSERT, `process_runs` PATCH, `batch_status_changes` INSERT | ✅ |
| Fail path | Yes | `batches` PATCH, `process_runs` PATCH, `batch_status_changes` INSERT | ✅ |

**Notes:** Output QR not generated (display only). Fail-path audit row hardcodes `from_status:'Released'`.

---

### app/qc-override/page.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load pending failures | Yes | `qc_check_results` SELECT with joins | ✅ |
| Confirm override | Yes | `qc_overrides` INSERT, `process_runs` PATCH, `batches` PATCH, `batch_status_changes` INSERT | ✅ |

**Notes:** RBAC guarded (Engineer/Admin). Reason validated before any write.

---

### app/batches/[id]/page.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load parent batch + intake | Yes | `batches` SELECT (joins `materials`, `batch_raw_material_intake`) | ✅ |
| Load sub-batches | Yes | `batches` SELECT `.eq('parent_batch_id', …)` | ✅ |
| Load process step names | Yes | `processes` SELECT | ✅ |
| Load status history | Yes | `batch_status_changes` SELECT (join `users`) | ✅ |
| Per-sub-batch operator/step | Yes | `process_runs` SELECT `.in('output_batch_id', …)` | ✅ |
| Change status (Engineer/Admin) | Yes | `transition_batch_status` RPC | ✅ |
| Create sub-batch | Yes | delegates to `CreateSubBatchDrawer` (see Chain 5) | ⚠️ |
| Export | No | — (button only, no handler) | ❌ |

**Notes:** Status change uses the RPC (atomic audit). Export button is inert.

---

### app/batches/[id]/[subId]/page.tsx
**Status:** ✅ Fully wired (data load) — one unwired child component

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load sub-batch | Yes | `batches` SELECT via `useBatch` | ✅ |
| Load process route | Yes | `get_process_route` RPC via `useProcessRoute` | ✅ |
| Load mixing steps | Yes | `mixing_steps` SELECT by `batch_id` | ✅ |
| Process timeline (non-mixing) | Yes | `ProcessTimeline` → `useProcessTimeline` | ✅ |
| Genealogy panel | No | `Genealogy` renders mock (`SUBBATCH_DETAIL`, `MAIN_BATCHES` from `lib/data`) | ❌ |

**Notes:** Has a `// TODO: wire genealogy to trace_batch_genealogy RPC` comment. Stray `console.log('[SubBatchDetailPage] params:', …)` present.

---

### app/scan/page.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| QR scan / manual lookup | Yes | `batches` SELECT via `useBatchByNumber` | ✅ |
| Navigate to detail | n/a | router push on resolved batch | ✅ |

**Notes:** Main-batch scans handled as a distinct `not-sub-batch` state. Camera scanner (`@yudiel/react-qr-scanner`) active.

---

### app/lots/page.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load lots | Yes | `lots` SELECT via `useLots` | ✅ |
| Load available sub-batches | Yes | `batches` SELECT (`status=Released`, has parent) | ✅ |
| Generate lot | Yes | `generate_lot` RPC via `GenerateLotPanel` | ✅ |

---

### app/lots/[id]/page.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load lot + units + sources | Yes | `lots` SELECT (joins `lot_sub_batches`, `units`) via `useLot` | ✅ |
| Print QR | n/a | `window.print()` of rendered QR code | ✅ |

---

### app/reports/page.tsx
**Status:** ✅ Fully wired (Compliance tab excepted)

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Batch Summary | Yes | `batches` SELECT (join `materials`, date range) | ✅ |
| QC Analysis | Yes | `qc_check_results` SELECT (joins defs + users) | ✅ |
| Defect Trends | Yes | `qc_check_results` SELECT (`passed=false`, grouped client-side) | ✅ |
| Compliance | No | static stub, disabled buttons | ❌ |
| CSV export | n/a | `papaparse` over live state arrays | ✅ |
| PDF/XLSX export | No | toast "coming soon" | ❌ |

**Notes:** RBAC guard present. Three data fetches fire before the Operator check returns — functional but wasteful.

---

### app/recall/page.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Resolve batch → UUID | Yes | `batches` SELECT | ✅ |
| Genealogy trace | Yes | `trace_batch_genealogy` RPC | ✅ |
| Material names | Yes | `materials` SELECT `.in(…)` | ✅ |
| Genealogy Impact Map | Yes | fed by RPC result | ✅ |
| "Execute" recommended actions | No | toast placeholder | ❌ |

---

### app/recipes/page.tsx
**Status:** ✅ Fully wired (one local-only toggle)

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load recipes | Yes | `recipes` SELECT via `useRecipes` | ✅ |
| New / Edit / New Version | Yes | `RecipePanel` → `recipes` INSERT/UPDATE | ✅ |
| Active toggle (`flipActive`) | No | local state only — no PATCH to `recipes.is_active` | ❌ |

---

### app/machines/page.tsx
**Status:** ⚠️ Partially wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load machines | Yes | `equipment` SELECT via `useMachines` | ✅ |
| Add / Edit equipment | Yes | `AddEquipmentPanel` → `equipment` INSERT/UPDATE | ✅ |
| Log maintenance | Yes | `LogMaintenancePanel` → `equipment_maintenance` INSERT | ✅ |
| Active toggle (checkbox) | No | local state only — no PATCH to `equipment.is_active` | ❌ |
| Delete machine | No | local state filter only — no DELETE | ❌ |

**Notes:** `reviewed_by`/`approved_by`/`type` collected in maintenance panel but hardcoded to `null` on INSERT. Active toggle and Delete are Admin-gated but local-only.

---

### app/admin/page.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load roles | Yes | `roles` SELECT | ✅ |
| Load users | Yes | `users` SELECT (join `roles`) | ✅ |
| Add user | Yes | `adminCreateUser` server action (`auth.admin.createUser` + `users` upsert) | ✅ |
| Edit user | Yes | `adminUpdateUser` server action | ✅ |
| Delete user | Yes | `adminDeleteUser` server action | ✅ |
| Toggle active | Yes | `adminSetUserActive` server action | ✅ |
| Audit Log tab | Yes | `audit_log` view SELECT (date range + filters) | ✅ |
| Role Permissions tab | No | hardcoded matrix (display only) | ⚠️ |
| Settings — Alert Rules | Yes | `AlertRulesPanel` → `alert_rules` SELECT + UPDATE | ✅ |
| Settings — Instance Config / Data Retention | No | static placeholder controls | ❌ |

**Notes:** Admin-only guard. `staff_code` not auto-set on user create (shows UUID).

---

### app/admin/audit-log/page.tsx
**Status:** 📁 MISSING — no standalone route. Audit log is a tab inside `app/admin/page.tsx`, wired to the `audit_log` view.

---

### components/subbatch/add-step-modal.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Log mixing step | Yes | `log_mixing_step` RPC (awaited before `onSubmit`) | ✅ |

**Notes:** `MIXING_MATERIALS` from `lib/data` used as a static dropdown list — acceptable as a UI constant, not a query substitute.

---

### components/subbatch/mixing-steps-panel.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Mark complete / Void | Yes | `update_mixing_step_status` RPC (awaited before state update) | ✅ |

---

### components/subbatch/identity-header.tsx
**Status:** ❌ Not wired (status actions)

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Place On Hold / Quarantine / Release / Scrap | No | `setCurrentStatus(target)` — local state only | ❌ |
| Confirm Scrap | No | `setCurrentStatus('Scrapped')` — local state only | ❌ |
| Log Process Step / Log QC | n/a | router navigation | ✅ |
| Show QR | n/a | `react-qr-code` render | ✅ |

**Notes:** Explicit `// In future: patch to Supabase + insert batch_status_changes row` comment. Status buttons are role-gated but persist nothing. This is the primary audit-trail hole.

---

### components/subbatch/process-timeline.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load timeline | Yes | `useProcessTimeline(subBatchId)` (live Supabase queries) | ✅ |

---

### components/subbatch/genealogy.tsx
**Status:** ❌ Not wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Render genealogy tree | No | mock `SUBBATCH_DETAIL` + `MAIN_BATCHES` from `lib/data` | ❌ |

**Notes:** `trace_batch_genealogy` RPC is live and used by `app/recall`. Unwired, not blocked.

---

### components/lots/generate-lot-panel.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Generate lot | Yes | `generate_lot` RPC | ✅ |

---

### components/machines/add-equipment-panel.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load process options | Yes | `processes` SELECT | ✅ |
| Add equipment | Yes | `equipment` INSERT | ✅ |
| Edit equipment | Yes | `equipment` UPDATE | ✅ |

---

### components/machines/log-maintenance-panel.tsx
**Status:** ✅ Fully wired (write) — partial field persistence

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Save maintenance log | Yes | `equipment_maintenance` INSERT | ✅ |

**Notes:** `reviewed_by`, `approved_by`, and `type` collected in form but hardcoded `null` in INSERT.

---

### components/recipes/recipe-panel.tsx
**Status:** ✅ Fully wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load DB processes | Yes | `processes` SELECT | ✅ |
| New recipe | Yes | `recipes` INSERT | ✅ |
| Edit recipe | Yes | `recipes` UPDATE | ✅ |
| New version | Yes | `recipes` INSERT (`parent_recipe_id` set) | ✅ |

---

### components/dashboard/kpi-cards.tsx
**Status:** ✅ Fully wired (presentational)

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Render KPIs | n/a | pure component receiving live data from `useDashboard` | ✅ |

**Notes:** Missing first-pass-yield, top-defect, stock-alert KPIs (not yet built).

---

### components/dashboard/alert-panel.tsx
**Status:** ✅ Fully wired *(was ❌ mock in previous audit — closed by alerts MVP)*

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load active alerts | Yes | `useAlerts` → `scanAlerts()` + `alerts` SELECT (`resolved_at IS NULL`) | ✅ |
| Dismiss alert (Engineer/Admin) | Yes | `alerts` UPDATE `resolved_at = now()` + `mutate('alerts')` | ✅ |
| Tab filter (Critical/Warning/Info) | n/a | client-side filter on live data | ✅ |

---

### components/batches/create-batch-modal.tsx
**Status:** ⚠️ Partially wired

| Action | Supabase call | Table / RPC | Status |
|--------|---------------|-------------|--------|
| Load materials | Yes | `materials` SELECT | ✅ |
| Create batch | Yes | `batches` INSERT, then SELECT for returned row | ✅ |
| Persist supplier/PO/lot/notes | No | collected in state, never inserted to `batch_raw_material_intake` | ❌ |
| Initial audit row | No | no `batch_status_changes` INSERT | ❌ |

---

## Mock data still in use

| File | Constant | Should be replaced with |
|------|----------|------------------------|
| `components/subbatch/genealogy.tsx` | `SUBBATCH_DETAIL`, `MAIN_BATCHES` | `trace_batch_genealogy` RPC (live — used by `app/recall`) |
| `components/subbatch/add-step-modal.tsx` | `MIXING_MATERIALS` | Acceptable as static UI list; optionally source from `materials` table |

> `lib/alerts-data.ts` has been **deleted** by the alerts MVP. No remaining imports of
> `lib/alerts-data` anywhere in the codebase. `lib/data.ts` barrel re-exports are still
> present but only 2 constants remain imported by live code (see above).

---

## lib/data.ts — remaining constants

| Constant | Still imported by | Action needed |
|----------|-------------------|---------------|
| `SUBBATCH_DETAIL` | `components/subbatch/genealogy.tsx` | Replace with `trace_batch_genealogy` RPC |
| `MAIN_BATCHES` | `components/subbatch/genealogy.tsx` | Replace with RPC result |
| `MIXING_MATERIALS` | `components/subbatch/add-step-modal.tsx` | Keep as static list, or source from `materials` |
| All other constants (e.g. `MIXING_STEPS`, `RECIPES`, `YIELD_TREND`, `BATCH_SUMMARY_ROWS`, `QC_ROWS`, `DEFECT_ROWS`, `TIMELINE`, `PROCESS_ROUTE`) | none — unused | Delete |

---

## RBAC guards

| Page / Component | Requires role | `useAuth()` present | Guard in place |
|-----------------|---------------|---------------------|----------------|
| `app/admin/page.tsx` | Admin | Yes | Yes — restricted screen if `role !== 'Admin'` |
| `app/reports/page.tsx` | Engineer+ | Yes | Yes — Operator restricted screen |
| `app/recall/page.tsx` | Engineer+ | Yes | Yes — Operator restricted screen |
| `app/qc-override/page.tsx` | Engineer+ | Yes | Yes — redirect + null render |
| `components/subbatch/identity-header.tsx` | Engineer+ (status buttons) | Yes | Yes — buttons gated; **actions not persisted** |
| `app/recipes/page.tsx` | Engineer+ (write) | Yes | Yes — `canEdit` gates write actions |
| `app/lots/page.tsx` | Engineer+ (generate) | Yes | Yes — `role !== 'Operator'` gates Generate |
| `app/machines/page.tsx` | Admin (write) | Yes | Yes — `isAdmin` gates write actions |
| `middleware.ts` | All restricted routes | n/a (server) | Yes — `/admin`, `/reports`, `/recall` |

---

## Middleware

| Check | Status |
|-------|--------|
| Role resolved from `public.users` → `public.roles` | Yes |
| `/admin` blocked for non-Admin | Yes |
| `/reports` blocked for Operator | Yes |
| `/recall` blocked for Operator | Yes |
| Null role fallback (most restrictive) | Yes — `!roleResolved` blocks `/reports` + `/recall` |
| Existing auth redirect preserved | Yes — unauthenticated → `/login`; authed on `/login` → `/dashboard` |

---

## Backend dependencies (blocked — cannot be wired from frontend)

None. All RPCs required by the current frontend scope exist in the live DB. Alert generation is now **app-side** (`lib/alerts/scan.ts` — `scanAlerts()` runs on every `useAlerts` call); no DB trigger dependency remaining.

---

## Audit trail completeness

| File | Handler | Status PATCH | `batch_status_changes` INSERT |
|------|---------|-------------|-------------------------------|
| `app/batches/[id]/page.tsx` | `ChangeStatusControl.confirm` | any valid transition | Yes — `transition_batch_status` RPC (atomic) |
| `app/log/qc/page.tsx` | `handleSubmit` (pass) | output batch `Released` | Yes |
| `app/log/qc/page.tsx` | `handleSubmit` (fail) | input batch `OnHold` | Yes |
| `app/qc-override/page.tsx` | `handleSubmit` | input batch `Released` | Yes |
| `components/batches/create-batch-modal.tsx` | `handleSubmit` | new batch `InProgress` | **No** |
| `components/batches/create-subbatch-drawer.tsx` | `handleSubmit` | new sub-batch `InProgress` | **No** |
| `components/subbatch/identity-header.tsx` | `handleStatusChange` / `confirmScrap` | any status | **No — local state only** |

---

## Overall completion estimate

| Domain | Estimated completion | Key gap |
|--------|---------------------|---------|
| Raw material intake | 45% | `batch_raw_material_intake` not written; no initial audit row |
| Production run | 70% | No `equipment_id`/`recipe_id`; no calibration lookup; no end-time PATCH |
| QC log | 95% | Output QR not generated; fail-path `from_status` hardcoded |
| QC override | 100% | None |
| Sub-batch + mixing | 80% | Parent qty not deducted; drawer machine/recipe/operator not persisted to a run |
| Lot generation | 100% | None |
| Reports | 80% | Compliance stub; PDF/XLSX stub |
| Batch viewer / scan | 90% | Export button inert; `subbatch/genealogy.tsx` still mock |
| Equipment management | 80% | Active toggle + delete local-only; maintenance reviewer/type not persisted |
| Recipe management | 95% | Active toggle local-only (no PATCH) |
| User management | 100% | None |
| Audit log | 100% | Fully wired |
| Dashboard | 80% | ✅ Alerts now live; missing first-pass-yield / top-defect / stock-alert KPIs |
| Genealogy / Recall | 95% (recall) / 0% (sub-batch panel) | `/recall` wired; `subbatch/genealogy.tsx` mock |
| Auth + RBAC | 95% | Routing + page guards solid; RLS intentionally off (Phase 5) |
| Alerts | 90% | ✅ Generation, live wiring, dismiss, admin rules — all done. Gap: no auto-resolve on condition-clear |

**Total estimated completion: ~85%** (+3% from previous audit — alerts MVP closed the largest open gap)

---

## Priority gaps (top items to wire next)

1. **`identity-header.tsx` status changes** — buttons mutate local state only; primary audit-trail hole on the most-used detail surface. Wire to `transition_batch_status` RPC. — `components/subbatch/identity-header.tsx`
2. **Sub-batch `Genealogy` panel** — still mock on every sub-batch page; `trace_batch_genealogy` RPC already live. — `components/subbatch/genealogy.tsx`
3. **Raw material intake completeness** — `batch_raw_material_intake` INSERT + PO/sample/shelf-life fields + initial `batch_status_changes` row. — `components/batches/create-batch-modal.tsx`
4. **Sub-batch split integrity** — deduct parent `current_quantity`; persist machine/recipe/operator from drawer into a `process_runs` row. — `components/batches/create-subbatch-drawer.tsx`
5. **Production run closure** — write `equipment_id`/`recipe_id`; calibration `qc_check_definitions` lookup; stamp `end_date`/`end_time`. — `app/log/process-step/page.tsx`
6. **Recipe + equipment local-only toggles** — `recipes.is_active` and machine active toggle/delete persist nothing. — `app/recipes/page.tsx`, `app/machines/page.tsx`

---

## TypeScript errors

`npx tsc --noEmit` completed with **exit code 0 — no type errors.**
