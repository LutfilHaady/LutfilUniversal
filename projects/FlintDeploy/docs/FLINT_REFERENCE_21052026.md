# FLINT Traceability — Unified Reference

**Project:** Flint Labs POC Line Batch Tracing  
**Supabase Project ID:** `pewrwrqituidyxhfsner` · Region: Tokyo (ap-northeast-1) · PostgreSQL 17  
**Frontend stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4  
**Backend:** Supabase (live) — `https://pewrwrqituidyxhfsner.supabase.co`  
**Last updated:** 2026-06-30 — Logic & flow refinements: `get_process_route` SQL fixed (type-based CASE routing); UTC timezone removed from all timestamp constructors (SGT fix); `MixingQCGate` removed from mixing + generic-process-log; `isMixingBatch` derived from process route steps not batch_number prefix; mixing run complete → bulk-void mixing_steps → redirect to QC page; process log sections stay expanded until run starts + auto-resume InProgress runs; sub-batch drawer uses `get_process_route` RPC; QC page auto-triggers from URL params; recall page gains QR scanner a+ instruction cards; header QrScanButton + refresh removed; materials "Total Inventory" KPI removed. Migration `20260630000000_fix_get_process_route.sql` must be applied to live DB. — Prior Sprint 13 Materials Management: `suffix` column added to `materials`; `material_stock_totals` VIEW created; `/materials` page built (list + register/edit modal + category tabs); `useMaterials` widened (parallel fetch + graceful stock fallback); sidebar + icons updated; `create-subbatch-drawer` uses `parentMaterialSuffix`; 7 sprint13 Playwright tests; suite **230 passed, 2 skipped, 0 failed**. Migration `20260629163236_add_materials_suffix_and_policies.sql` must be applied to live DB. Test fixes: sprint4 intake-completeness batches mock (list→array); sprint6 unified-log CTGC→DRYC; sprint7 process-log-fields all CALC fields filled; sprint9 qc-scrap-defect-rate `.first()` strict-mode fix. — Prior: User guide gap analysis: all 🔴+🟡 items applied to `flint_user_guide_4.docx`; 5 new screenshots added to `docs/screenshots/` (scan, active-run-bar, create-batch-modal, subbatch-detail, mixing-workspace); `docs/FLINT_USER_GUIDE.md` updated with screenshot refs; old `docs/GAP_ANALYSIS_2026-06-24.md` replaced by `docs/superpowers/specs/2026-06-29-user-guide-gap-analysis.md`. — Prior: QC log page (`app/log/qc/page.tsx`) refactored from 5-step wizard to single-page collapsible-section layout (matching `generic-process-log.tsx`); NaN suffix bug fixed in `handleSubmit` (alpha-prefixed last segment e.g. "A01" now increments correctly); 4 Playwright test files updated (sprint3/qc-wizard, sprint7/qc-numeric-criteria, sprint7/qc-numeric-bounds, sprint9/qc-target-relative); 23/23 targeted tests pass.
**Status:** Frontend prototype complete (mock data) · Mixing operator page added (2026-05-15) · Genealogy Impact Map added (2026-05-21, mock data) · Login/auth wired to Supabase · Supabase schema complete · All backend RPCs live · Admin gate + machines wiring + recipe-panel types + scan cleanup done (2026-05-27) · Sidebar branding updated to transparent logo (2026-05-27) · Mixing step RPC wiring done (2026-06-01) · Process step logging + QC logging + Admin Users tab fully wired to Supabase (2026-06-01) · `get_process_route` and `log_mixing_step` RPC bugs fixed in DB (2026-06-01) · Build break in mixing operator page fixed + recipe/maintenance write-action persistence bugs fixed (2026-06-02) · Sidebar hydration mismatch fixed (2026-06-02) · Next.js 16.2.7 security bump + QC Suspense fix (2026-06-02) · Recipe param schema aligned; QC pass/fail write chain + QC override page (2026-06-02) · Lot generation RPC wired; reports page on live data + date range; Operator 7-day history filter in hooks (2026-06-03) · `main` promoted to live trunk via force-update from `v2_jon`; `v2_jon` deleted — `main` is now the sole integration branch (2026-06-03) · Gaps flagged: alerts feature (§6b — no generation/live-wiring/dismiss), no main-batch detail page (`/batches/[id]`), no sub-batch creation (2026-06-03) · Audit Log tab gained last-30-days date-range filter (2026-06-03) · Schema + RPCs + reference seed exported to `supabase/migrations/` (22 files) and `supabase/seed.sql`; root `README.md` added for repo inheritors; repo now self-contained for standing up a fresh DB (2026-06-03) · Corrected §7.5 enum values to PascalCase (`Startup`/`EndOfRun`, `VisualManual`/`ToolEquipment`) to match live DB (2026-06-03) · Main batch detail page (`/batches/[id]`) + Create Sub-batch drawer built and wired to Supabase — closes the two High-priority gaps flagged earlier (2026-06-03) · Main batch detail + Create Sub-batch drawer visually redesigned to match the `mainbatchhtml/` mockups — hero, surface info cards, 3fr/2fr two-column layout, new Intake record panel, timeline status history, slide-in sectioned drawer with custom dropdowns; drawer now persists `current_location`; wiring unchanged (2026-06-03) · Dashboard moved off the root route into its own `/dashboard` route; `/` redirects to `/login` (middleware forwards authed users to `/dashboard`); sidebar link, middleware role-redirect targets, login + qc-override guards, and test navigations all updated accordingly (2026-06-03) · Fixed cold-load hang: `lib/auth-context.tsx` no longer `await`s a `supabase.from()` query inside the `onAuthStateChange` callback (deadlocked the auth-js LockManager on first load) — initial session now via `getSession`, listener defers `resolveUser` via `setTimeout(0)`; `useDashboard`/`useBatches`/`/batches/[id]` also gated on `authLoading` (2026-06-04) · Customisable Alerts MVP: `alert_rules` catalog + app-side `scanAlerts()` generation + `useAlerts` hook across all 4 surfaces + Engineer/Admin dismiss + Admin rule editor in Settings; mock `lib/alerts-data.ts` deleted (2026-06-04) · Sub-batch detail breadcrumb fixed: the parent segment now links to the parent batch detail page (`/batches/[id]`) instead of the batches list, and resolves the parent `batch_number` via a `useBatch(params.id)` fallback when the `parent_batch` join is absent; leftover debug `console.log` removed; covered by `tests/sprint3/subbatch-breadcrumb.spec.ts` (2026-06-05) · Sub-batch genealogy panel wired to `trace_batch_genealogy` RPC — full rewrite of `components/subbatch/genealogy.tsx`; renders ancestor/self/descendant sections with live data, empty state, loading/error states; mock `SUBBATCH_DETAIL`/`MAIN_BATCHES` references removed; covered by `tests/sprint4/genealogy.spec.ts` (2026-06-05) · Sprint 4 completed (genealogy + split integrity + toggles): Create Sub-batch drawer now deducts parent `current_quantity` (guarded read→write, over-allocation blocked before any write), writes an initial `batch_status_changes` audit row for the new sub-batch, and persists machine/recipe/operator as an `InProgress` `process_runs` row (`output_batch_id`=sub-batch); recipe active toggle PATCHes `recipes.is_active` (with double-click guard); machine active toggle PATCHes `equipment.is_active` and Delete DELETEs `equipment` with 23503 FK-in-use handling — all by UUID `id`; fixed a pre-existing fragile selector in `tests/sprint3/sprint3-workflows.spec.ts` (one-hop nav landed on the main-batch detail page after the 2026-06-03 redesign) → now two-hop main→sub; `tests/sprint4/` adds genealogy/split-integrity/recipes-toggle/machines-toggle-delete specs; full suite 39 green (2026-06-05) · Sprint 4 (Subra) — Reports & Alerts polish: `/reports` now guards all four data fetches on the Operator role check (no Operator queries fire before the render guard); Compliance tab wired to live `qc_check_results` (+`qc_overrides`) over the date range → pass-rate/fail/override summary cards + CSV Generate; XLSX export wired via SheetJS (`xlsx` dep added) over each tab's live arrays (PDF still a `// TODO` toast); alerts now **auto-resolve** — `scanAlerts()` resolves open scan-generated alerts whose `dedup_key` is no longer in the desired set (scoped to enabled rules, idempotent, no flip-flop); `tests/sprint4/` adds reports-compliance + alerts-autoresolve specs; full suite 43 green (2026-06-04) · Sprint 4 (Jonny) — `identity-header.tsx` Hold/Quarantine/Release/Scrap buttons now call `transition_batch_status` RPC atomically (status PATCH + audit row in one tx); local state updated only after success; Release button `targetStatus` bug fixed (`'InProgress'`→`'Released'`); process step wizard writes `equipment_id`/`recipe_id` on `process_runs` INSERT, calibration gate shown when `requires_calibration=true`, run PATCH stamps `end_date`/`end_time`/`AwaitingQC` on completion; `tests/sprint4/identity-header.spec.ts` + `tests/sprint4/process-step-logging.spec.ts` (19 tests); `tsc` clean (2026-06-04) · Phase 5 RLS: `get_my_role()` STABLE SECURITY DEFINER helper + RLS on all 24 tables + 76 policies across 7 groups; write RPCs SECURITY DEFINER; Operator test account created (2026-06-04) · Sprint 4 (Ethan) — raw material intake completeness + dashboard KPI expansion: `create-batch-modal` now inserts `batch_raw_material_intake` row + initial `batch_status_changes` audit row + shows QR code success screen on registration; `useDashboard` adds first-pass yield / top defect / active alert count KPIs; `kpi-cards` gains 3 new cards; `xlsx` dep installed; full suite 70 green, 1 skipped (2026-06-05) · Global search wired (2026-06-05): header search box replaced with a ⌘K command palette (`components/command-palette.tsx`) — debounced live `ilike` search across batches/lots/recipes/equipment via the anon (RLS-respecting) client, grouped + keyboard-navigable results, navigates to detail routes (batch/lot) or list+`?q=` (recipe/machine); removed the hardcoded `badge: 2` on the Machines sidebar item; `tests/sprint4/global-search.spec.ts` (3) — full suite 74 green, 3 skipped

> This document is the single source of truth for anyone coding on Flint. Refer here before touching any data layer, business logic, or new feature.

---

## Backend integration phases (current status)

| Phase | Status | What's in it |
|-------|--------|--------------|
| Phase 1 — Project setup | ✅ 100% | Supabase project live |
| Phase 2 — Schema | ✅ 100% | 23 tables, 6 views + audit_log, 4 enums, 28 indexes, auth trigger |
| Phase 3 — Seed data | 🟡 90% | Everything seeded except equipment (waiting on machine list from Flint) |
| Phase 4 — Auth + login | ✅ 100% | Login page (`/login`), `middleware.ts`, `lib/supabase.ts`, `lib/auth-context.tsx`, 1 test account done |
| Phase 5 — Security (RLS) | ✅ 100% | `get_my_role()` helper + RLS on all 24 tables + 76 policies across 7 groups; write RPCs SECURITY DEFINER; Operator test account `dev.operator@flintlabs.com` created (2026-06-04) |
| Phase 6 — RPCs + functions | 🟡 80% | 7 RPCs live — remaining: alert triggers, demo seed data |

**Estimated remaining backend effort:** 1–2 hours (alert triggers + demo seed data).

---

## ⚠️ Schema corrections (actual column names in DB)

> These differ from the original design doc. Always use the names in the "Actual DB" column in all queries and RPCs — the old names will cause errors.

| Table | Wrong (old doc) | Correct (actual DB) |
|---|---|---|
| `batch_status_changes` | `old_status` | `from_status` |
| `batch_status_changes` | `new_status` | `to_status` |
| `batch_status_changes` | `created_at` | `changed_at` |
| `qc_overrides` | `created_at` | `overridden_at` |
| `process_run_inputs` | `batch_id` | `input_batch_id` |
| `process_run_inputs` | `quantity` | `quantity_consumed` |
| `process_runs` | `user_id` / `created_by` | `operator_id` |
| `qc_check_definitions` | `acceptance_criteria` | `acceptance_criteria_text` (also has `acceptance_criteria_min` numeric, `acceptance_criteria_max` numeric, `is_active` boolean — added Sprint 8 J3; always filter `WHERE is_active = true`) |
| `qc_check_definitions` | `method` enum: `visual-manual` | `VisualManual` (PascalCase) |
| `qc_check_definitions` | `timing` enum: `end-of-run` | `EndOfRun` (PascalCase) |
| `qc_check_results` | `checked_by` | `performed_by` |
| `qc_check_results` | `result_value` (text) | three columns: `result_value_numeric`, `result_value_boolean`, `result_text` |

---

## 1. ID & code naming conventions

### Batch ID format
```
AAAA  —  YYYYMMDD  —  A01  —  01
```

| Segment | Meaning | Example |
|---------|---------|---------|
| AAAA | Item / process code | MIXC, CTGC |
| YYYYMMDD | Manufactured date | 20260430 |
| A01 | Batch number | A01, A02, … Z99 |
| 01 | Sub-batch number | 01, 02, … 99 |

**Critical:** `batch_number` is NOT the primary key. The DB uses UUIDs (`id`). When querying by QR scan, use `WHERE batch_number = $1`, not `WHERE id = $1`.

### Raw material codes

| Material | Code |
|----------|------|
| DI Water | MTDW |
| Cathode Material C1–C4 | MTC1, MTC2, MTC3, MTC4 |
| Cathode Roll | MTCR |
| Electrolyte E1–E3 | MTE1, MTE2, MTE3 |
| Anode Roll | MTAR |
| Separator Roll | MTSR |
| Packaging | MTPP |

### Production process codes

| Process | Material | Code |
|---------|----------|------|
| Mixing | Cathode | MIXC |
| Mixing | Electrolyte | MIXE |
| Coating | Cathode | CTGC |
| Calendaring | Cathode | CALC |
| Die Cut | Cathode | DICC |
| Die Cut | Anode | DICA |
| Cutting | Separator | CUTS |
| Slitting | Separator | SLTS |
| Slitting | Casing | SLTC |
| Assembly | — | UTPC |

---

## 2. Process routes per material

Each material follows an independent path — there is no single linear flow.

| Material | Process steps |
|----------|--------------|
| Cathode Electrode | Mixing → Coating/Oven Drying → Calendaring → Die Cut |
| Anode Electrode | Die Cut only (from Roll A) |
| Separator | Cutting → Slitting |
| Casing | Slitting |
| Electrolyte | Mixing only |
| Final Assembly | All materials converge → Assembly → QR generation |

**Gap:** The process stepper currently shows a fixed route for all sub-batches. It must be made dynamic based on material type. Use the `get_process_route(p_material_id)` RPC (now live) which returns ordered steps via `materials.first_process_id` + `processes.sequence_hint`.

---

## 3. User roles & permissions

### Operator
- Scan / create QR for incoming and output batches
- Log process run data
- View current batch status and batch info (parent batch ID)
- View work history — **previous week only, read-only**

### Engineer
- All Operator permissions, plus:
- Override failed QC checks with written reasoning
- Set batch status (Hold / Release / Quarantine / Scrap)
- Create recipes and version management
- View dashboard, run material trace (genealogy), export reports

### Admin
- Manage user roles and password resets
- Add / edit / deactivate equipment
- Access audit log
- Configure steps and stations

**Gaps vs current frontend:**
- Operators not yet restricted to previous week's history
- No "Configure steps/stations" UI in Admin
- Routing-layer RBAC enforced in `middleware.ts` (2026-06-01) — `/admin` gated to Admin; `/reports` and `/recall` blocked for Operator and null role. Page-level `useAuth()` guards now in place on `/admin`, `/reports`, `/recall` (confirmed 2026-06-02). RLS policies still pending.

---

## 4. QC system

### QC items per process step

| Process step | QC item | Method | Timing | Acceptance criteria |
|---|---|---|---|---|
| **Mixer** | Homogeneity | V/M | End-of-run | No visible lumps |
| **Mixer** | Particle Size | T/E | End-of-run | < 50 µm |
| **Mixer** | Viscosity | T/E | End-of-run | Within ± 2% |
| **Coating / Oven** | Dry Thickness | T/E | Start-up | Within ± 5% |
| **Coating / Oven** | Cracking / Flaking | V/M | Start-up | Smooth coating |
| **Calendaring** ★ | Substrate Penetration | V/M | Start-up | No penetration |
| **Die Cutting** | Warpage | V/M | End-of-run | Scrap |
| **Die Cutting** | Misalignment | V/M | End-of-run | Scrap |
| **Die Cutting** | Delamination | V/M | End-of-run | Scrap |
| **Cutting** | Warpage | V/M | End-of-run | Scrap |
| **Cutting** | Misalignment | V/M | End-of-run | Scrap |
| **Slitting** ★ | Accurate Width | T/E | Start-up | Within ± 0.1 mm |
| **Slitting** ★ | Jagged Edges | V/M | End-of-run | < 5% of entire roll |
| **Assembly** | Misalignment | V/M | End-of-run | Scrap |
| **Assembly** | Voltage | T/E | End-of-run | > 1.6 V |
| **Assembly** | Label Printing Defect | V/M | End-of-run | Scrap |

★ Machines requiring initial calibration before operation (Start-up QC before proceeding).

**Method:** V/M = Visual/Manual · T/E = Tool/Equipment  
**Timing:** Start-up = before operation (calibration) · End-of-run = after process completes

### QC workflow
```
START
  └→ Setup Parameters Documentation
       ├→ [Calibration required?]
       │     YES → Start-up QC
       │               NOK → Adjust & Recalibrate → loop back
       │               OK  → Operation
       └→ [No calibration needed] → Operation
                └→ End-of-Run QC
                        NOK → On Hold / Quarantine / Scrap
                        OK  → Release for Storage
                                └→ Documentation: Batch ID + QR Generation
                                        └→ END
```

### QC pass/fail logic
The frontend computes pass/fail — **the database does not auto-compute it.** `qc_check_definitions` has acceptance criteria. The frontend reads these, compares against operator-entered values, and sends the `passed` boolean to `qc_check_results`.

**Sprint 9 (L1): Four-branch dispatch** — the QC wizard (`app/log/qc/page.tsx`) dispatches each check to one of four input modes based on `method` and `acceptance_criteria_max`:
1. **VisualManual (no max):** Pass/Fail toggle + notes. Writes `result_value_boolean` + `result_text`.
2. **ToolEquipment (min/max populated):** Numeric input, auto-computes `passed = value >= min && value <= max`. Writes `result_value_numeric`.
3. **ToolEquipment (min/max NULL):** Target + Measured inputs; tolerance parsed from `acceptance_criteria_text` (±2%, ±5%, ±0.1mm). Writes `result_value_numeric` + `result_text`.
4. **VisualManual + max (Scrap):** Defect count input; reads throughput from `process_run_parameters` (`pcs_cut`/`cell_assembled`); `passed = defect_rate * 100 <= max`. Blocks save if throughput missing. Writes `result_value_numeric` (count) + `result_text` (rate summary).

All queries filter `qc_check_definitions WHERE is_active = true`.

---

## 5. Data fields per process step (for logging forms)

### 5.1 Material QR (incoming raw material)
General: Date/Time Received, Supplier Name/Batch No, Internal Batch Number, Mass/Roll length, PO Number, Shelf Life, Sample ID · Storage: Location · Sampled By: Staff ID, Date/Time

### 5.2 Mixer

Mixing is tracked as a sequence of numbered sub-steps under one parent batch ID (e.g. `MIXC-20260430-A01`), not as a single run. Each sub-step has an immutable display reference: `MIXC-20260430-A01 / Add DI Water · Step 01`.

**Add Material step** (one per material addition): Operator ID, Timestamp, Material code + name, Quantity, Unit (kg / L / g / mL)

**Mix Round step** (one per mixing cycle): Operator ID, Timestamp, Duration (min), Temperature (°C), Internal Pressure (bar), Dispersion RPM, Propeller RPM

**QC** (logged separately against the parent batch — unchanged): Homogeneous?, Particle size?, Viscosity?

**Output:** Parent batch number (`MIXC-…`), step display references for audit trail, Storage

### 5.3 Coating & Oven Drying
General: Start/End Date/Time, Operator ID · Materials: Parent Batch No, Mass/Volume Consumed · Operation: Substrate Feeding Speed, Coating Blade Gap, Transfer Gap, Temperature, Coating Length, Upper/Lower Oven RC (1–6) · QC: Initial Coated Thickness, Cracking?, Flaking?, Dry Thickness, Upper/Lower Oven RC · Output: New Batch Number, Storage

### 5.4 Calendaring
General: Start/End Date/Time, Operator ID · Materials: Parent Batch No · Operation: Force, Feed Rate, Roller Gap · QC: Penetrated Substrate? · Output: New Batch Number, Storage

### 5.5 Die Cutting
General: Start/End Date/Time, Operator ID · Materials: Parent Batch No · Operation: Cutting Piston Travel Depth, Distance Between Cuts, Machine Feed Rate, Length Cut · QC: Warpage?, Misalignment?, Delamination?, No. Passed Samples, Pass/Fail Rate · Output: New Batch Number, Storage

### 5.6 Cutting
General: Start/End Date/Time, Operator ID · Materials: Parent Batch No · Operation: Cutting Distance, Roll Tension, Travel Speed · QC: Warpage?, Misalignment?, No. Passed Samples, Pass/Fail Rate · Output: New Batch Number, Storage

### 5.7 Slitting
General: Start/End Date/Time, Operator ID · Materials: Parent Batch No · Operation: Slit Length, Feed Rate, Upper/Lower Rewinding Tension, Unwinding Tension, Disc Blade Distance · QC: Accurate Thickness?, Jagged Edges? · Output: New Batch Number, Storage

### 5.8 Assembly
General: Start/End Date/Time, Operator ID · Materials: Individual Batch Nos · QC: Misalignment?, Voltage?, Labelling Defect?, No. Passed Samples, Pass/Fail Rate · Output: New Batch Number, Storage

### 5.9 Machine info & maintenance (Equipment logging fields)
- **Equipment:** Equipment ID, Equipment Name, Supplier Info
- **Maintenance:** Last Maintenance Date, Next Maintenance Due Date, Performed By, Reviewed By, Approved By, Date

---

## 6. Dashboard requirements

| Section | Fields |
|---------|--------|
| Materials | Alert if below minimum storage threshold; alert if close to expiry |
| Operation | Real-time progress bar; batches produced |
| Outcome Results | First-pass yield %; top defective reason (for final battery) |
| Trend Charts | Abnormal shifts vs. baseline |

**Gap:** Current dashboard shows active/in-progress KPIs and a yield line chart. Missing: first-pass yield %, top defective reason, material stock alerts, shift anomaly detection.

---

## 6a. Client system requirements

Six explicit requirements stated by the client:

1. **Long-term usage** — ability to add/edit/remove machines over time
2. **User-friendly UI** — ✅ already well-implemented
3. **Security features / access authorization** — RBAC enforcement needed; not yet implemented
4. **Multi-point access** — multiple simultaneous users; architecture supports it, RLS not yet enabled
5. **Export to CSV** — from reports (and possibly individual logs); button only, no generation logic
6. **Auto-calculation of expected producable batteries** — given material inputs, calculate expected final unit yield; not yet built

---

## 6b. Alerts — current state (flagged 2026-06-03)

Alert management was the least-wired feature. **MVP shipped 2026-06-04** — all three layers now work (app-side, minimal-schema version):

| Layer | State |
|-------|-------|
| **Generation** | ✅ App-side **scan** (`lib/alerts/scan.ts`) + **DB triggers** (Sprint 9 J1). `scanAlerts()` runs on alert-read (via `useAlerts`) and, per enabled rule, queries current state and inserts any alert whose `dedup_key` isn't already active. Rules: `qc_fail` (qc_check_results.passed=false), `batch_held` (status OnHold/Quarantine/Scrapped), `maintenance_overdue` (equipment_maintenance.next_due_date past − grace), `expiry_soon` (batches.expiry_date ≤ today+lead). **DB triggers now live (2026-06-25):** `fn_alert_qc_fail` (AFTER INSERT on `qc_check_results` WHERE passed=false) and `fn_alert_batch_held` (AFTER UPDATE on `batches` WHERE status changes to OnHold/Quarantine/Scrapped) — both SECURITY DEFINER, dedup_key format identical to `scanAlerts()` so `alerts_dedup_active` index prevents doubles. **KIV'd:** `low_stock` scanAlerts() builder (Sprint 10 frontend — `materials.min_storage_threshold` is the column to compare against). |
| **Live wiring (read)** | ✅ One `useAlerts` SWR hook (key `'alerts'`) feeds **all four surfaces** — `/alerts` page, dashboard `alert-panel.tsx`, dashboard banner, header bell. The `lib/alerts-data.ts` mock is **deleted**. (`useDashboard` still reads `alerts` for its own KPI/panel needs.) |
| **Dismiss** | ✅ Engineer/Admin dismiss button sets `resolved_at = now()`, `resolved_by = userId`, `resolution_source = 'manual'` then `mutate('alerts')`; active views filter `resolved_at IS NULL`. |
| **Auto-resolve** | ✅ (2026-06-04) `scanAlerts()` re-evaluates open scan-generated alerts each pass: any whose `dedup_key` is no longer in the freshly-computed desired set is auto-resolved (`resolved_at = now()`, `resolution_source = 'auto'`), scoped to **enabled** rule keys so disabling a rule doesn't sweep-resolve its alerts. Idempotent. **Sprint 8 J1:** `alerts` now has `resolved_by UUID REFERENCES users(id)` and `resolution_source TEXT CHECK (IN ('manual','auto'))` — dismiss vs auto-resolve are now distinguishable in the DB. |

**Customisation:** new `alert_rules` table (`key`, `label`, `enabled`, `severity`, `threshold`) — a fixed 4-rule catalog the Admin tunes (enable/disable, severity, threshold) in `/admin` → **Settings** → Alert Rules (`components/admin/alert-rules-panel.tsx`). `alerts` gained `rule_key` + `dedup_key` (partial unique index `alerts_dedup_active` on active dedup_keys). Migration: `supabase/migrations/20260604000000_alerts_mvp.sql`.

**KIV'd (future):** generic any-entity/any-field rule builder, DB triggers/pg_cron, low-stock rule, custom message templates. (Auto-resolve-on-condition-clear ✅ done 2026-06-04 — see Auto-resolve row above.) See `docs/superpowers/specs/2026-06-04-customisable-alerts-mvp-design.md`.

**Not the same as the Audit Log** (§7.2 `audit_log` view = batch status changes + QC overrides, immutable — a separate, working feature).

---

## 7. Database schema (Supabase — live)

### 7.1 Tables overview (23 tables)

**Identity & Access (3)**
- `roles` — Operator, Engineer, Admin
- `users` — staff, linked to Supabase Auth UUID; role assigned by Admin after sign-up
- `role_permissions` — 18 rows seeded (4 Operator, 10 Engineer, 4 Admin)

**Master Data (4)**
- `processes` — 10 production steps (seeded: MIXC, MIXE, CTGC, CALC, DICC, DICA, CUTS, SLTS, SLTC, UTPC)
- `materials` — 12 raw materials (seeded: MTDW, MTC1–4, MTCR, MTE1–3, MTAR, MTSR, MTPP)
- `equipment` — physical machines (currently **empty** — blocked on machine list from Flint)
- `equipment_maintenance` — service log

**Recipes (2)**
- `recipes` — parameter presets. Has both `recipe_parameters` EAV rows AND a `params JSONB` column for easy frontend reads. Also: `recipe_number` TEXT (e.g. "RCP-001"), `version` TEXT (semver e.g. "3.2"), `notes` TEXT
- `recipe_parameters` — one row per parameter (EAV)

**Batches (3)**
- `batches` — all batches, parent and sub. Sub-batches have `parent_batch_id` set (same table, self-referencing). `batch_number` is a unique TEXT field, NOT the primary key (UUID is)
- `batch_raw_material_intake` — extra supplier info for incoming raw materials only
- `batch_status_changes` — **required audit log** — insert here on every `batches.status` update. Actual columns: `from_status`, `to_status`, `changed_at`, `changed_by`, `reason`

**Process Runs (3)**
- `process_runs` — one row per machine operation. Has `params JSONB` for easy frontend reads. Operator FK column is `operator_id` (not `user_id` or `created_by`)
- `process_run_inputs` — which batches were consumed (supports Mixer's multi-input). Input batch FK is `input_batch_id`, quantity column is `quantity_consumed`
- `process_run_parameters` — actual parameter values (EAV)

**Quality Control (3)**
- `qc_check_definitions` — 16 rows seeded; has acceptance criteria
- `qc_check_results` — frontend submits `passed` boolean after computing against criteria
- `qc_overrides` — engineer override with mandatory written reason. Timestamp column is `overridden_at` (not `created_at`)

**Lots & Serialisation (3)**
- `lots` — bundles of released sub-batches for shipment
- `units` — individual serialised battery products with QR codes
- `lot_sub_batches` — junction table linking lots to source sub-batches

**Alerts (1)**
- `alerts` — currently empty; will be populated by DB triggers (backend task 3C)

**Mixing Steps (1 — live as of 2026-05-21)**
- `mixing_steps` — immutable sequential sub-steps per MIXC/MIXE batch. See full schema below.

### 7.1a mixing_steps table (added 2026-05-21)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `batch_id` | UUID FK → batches | `ON DELETE CASCADE` |
| `step_number` | INTEGER | Immutable, auto-assigned by `log_mixing_step` RPC inside a transaction |
| `type` | TEXT | `'add_material'` \| `'mix_round'` \| `'qc_check'` |
| `label` | TEXT | Human-readable step name e.g. "Add DI Water" |
| `display_ref` | TEXT | Auto-generated: `"MIXC-20260430-A01 / Add DI Water · Step 01"` |
| `status` | TEXT | `'in_progress'` \| `'completed'` \| `'voided'` |
| `params` | JSONB | Step-specific data (material code + qty, RPM, temp, etc.) |
| `operator` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ | Set on insert |
| `completed_at` | TIMESTAMPTZ | Set by `update_mixing_step_status` RPC |

**Rules:**
- Steps are **never deleted** — only voided
- `step_number` is assigned inside a transaction with `SELECT ... FOR UPDATE` to prevent duplicate numbers under concurrent inserts
- Actual mix duration = `completed_at − created_at`
- Unique constraint on `(batch_id, step_number)`

### 7.2 Views (compatibility layer)

| View | Points to | Why |
|------|-----------|-----|
| `sub_batches` | `batches` WHERE `parent_batch_id IS NOT NULL` | Frontend treats sub-batches separately |
| `main_batches` | `batches` WHERE `parent_batch_id IS NULL` | Frontend treats parents separately |
| `machines` | `equipment` | Frontend uses "machines" naming |
| `maintenance` | `equipment_maintenance` | Shorter name |
| `process_steps` | `processes` | Frontend uses "process steps" naming |
| `qc_check_items` | `qc_check_definitions` | Frontend uses "check items" naming |
| `audit_log` | `batch_status_changes` + `qc_overrides` | Unified audit feed ordered by timestamp DESC — use for Admin audit log page |

### 7.3 Seeded data (already in the database)

| Table | Rows | What's in there |
|-------|------|-----------------|
| `roles` | 3 | Operator, Engineer, Admin |
| `processes` | 10 | MIXC, MIXE, CTGC, CALC, DICC, DICA, CUTS, SLTS, SLTC, UTPC |
| `materials` | 12 | MTDW, MTC1–4, MTCR, MTE1–3, MTAR, MTSR, MTPP |
| `qc_check_definitions` | 16 | All QC rules from the spec (homogeneity, viscosity, warpage, etc.) |
| `role_permissions` | 18 | 4 for Operator, 10 for Engineer, 4 for Admin |

All transactional tables (`batches`, `process_runs`, `qc_check_results`, `lots`, `units`, `alerts`, `mixing_steps`) are currently empty — frontend uses mock data.

### 7.4 Frontend compatibility changes made to existing tables

| Table | Change | Why |
|-------|--------|-----|
| `recipes` | Added `params JSONB` column | Frontend reads params as a single object, not EAV rows |
| `recipes` | Changed `version` from INT to TEXT | Frontend uses semver format ("3.2" not just "3") |
| `recipes` | Added `recipe_number TEXT` column | Frontend generates "RCP-001" style codes |
| `recipes` | Added `notes TEXT` column | Frontend expects a notes field |
| `process_runs` | Added `params JSONB` column | Frontend reads run params as a single object |

**Note:** `recipe_parameters` and `process_run_parameters` EAV tables still exist. **As of 2026-06-02 the recipe write path writes `recipes.params` (JSONB) ONLY** — the frontend reads params solely from `recipes.params`, and the EAV `recipe_parameters` table is no longer written (it was dead — nothing read it, and it can't represent the nested/array param shapes). The UI param model (`PROCESS_PARAM_FIELDS` in `lib/constants.ts`) now matches the seed JSONB schema exactly (scalar / fixed-array / nested-rows kinds). `recipe_parameters` is a candidate for removal, or a future sync trigger if EAV is needed downstream.

### 7.5 Enum types
- `batch_status`: `InProgress` | `Released` | `OnHold` | `Quarantine` | `Scrapped`
- `process_run_status`: `InProgress` | `AwaitingQC` | `Passed` | `Failed` | `Overridden`
- `qc_timing`: `Startup` | `EndOfRun` (PascalCase in the live DB — **not** `start-up`/`end-of-run`)
- `qc_method`: `VisualManual` | `ToolEquipment` (PascalCase in the live DB — **not** `visual-manual`/`tool-equipment`)

### 7.6 Auth trigger
`on_auth_user_created` — fires on Supabase Auth sign-up, auto-creates a `users` row with matching UUID. Admin must then assign `role_id`.

---

## 8. Supabase client setup

```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default supabase
```

Env vars go in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://pewrwrqituidyxhfsner.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<legacy JWT anon key — eyJ… format from Dashboard → Settings → API>
```

> ⚠️ Use the **legacy JWT anon key** (`eyJ…`), not the `sb_publishable_*` publishable key. `createBrowserClient` from `@supabase/ssr` does not support the publishable key format — Supabase requests hang silently when it is used.

### Common query patterns

```ts
// All main batches with their sub-batches
const { data } = await supabase
  .from('batches')
  .select('*, sub:batches!parent_batch_id(*)')
  .is('parent_batch_id', null)

// Batch lookup by QR scan
const { data } = await supabase
  .from('batches')
  .select('*')
  .eq('batch_number', scannedCode)
  .single()

// QC rules for a process
const { data } = await supabase
  .from('qc_check_definitions')
  .select('*')
  .eq('process_id', selectedProcessId)

// Active recipes for a process
const { data } = await supabase
  .from('recipes')
  .select('*')
  .eq('process_id', selectedProcessId)
  .eq('is_active', true)

// ⚠️ Status change — ALWAYS use the RPC, never a direct PATCH
// The RPC validates the transition and writes the audit row atomically
await supabase.rpc('transition_batch_status', {
  p_batch_id: batchId,
  p_new_status: 'Released',   // must be a valid batch_status enum value
  p_reason: 'QC passed',
  p_user_id: userId
})
```

### camelCase ↔ snake_case
The Supabase JS client returns snake_case field names. Frontend currently uses camelCase (`parentId`, `createdBy`, etc.). Handle the mapping at the data layer — either configure the client or map in query hooks.

---

## 9. RPCs and functions (all live as of 2026-05-21)

> Call all of these via `supabase.rpc('function_name', { ...params })` from the frontend.

| Function | Purpose |
|---|---|
| `log_mixing_step` | Creates a new mixing step with transaction-safe auto step_number. Auto-generates `display_ref`. Returns the full `mixing_steps` row. |
| `update_mixing_step_status` | Sets a step to `completed` or `voided`, stamps `completed_at`. Raises exception if step not found or invalid status. |
| `transition_batch_status` | Validates state machine transition, updates `batches.status`, atomically inserts `batch_status_changes` row. Raises exception on invalid transition. **Always use this instead of a direct PATCH.** |
| `trace_batch_genealogy` | Recursive CTE returning all ancestors and descendants of a batch. Each row includes `depth` (negative = ancestor, 0 = self, positive = descendant) and `direction` (`'ancestor'` \| `'self'` \| `'descendant'`). |
| `generate_lot` | Atomic insert across `lots`, `lot_sub_batches`, and `units`. Returns the created lot row. |
| `get_process_route` | Returns ordered process steps for a given material. **Fixed 2026-06-30** (migration `20260630000000`): now uses `CASE materials.type` to return hardcoded process code arrays (`Cathode Electrode → MIXC/CTGC/CALC/DICC`, `Anode Electrode → DICA`, `Separator → CUTS/SLTS`, `Casing → SLTC`, `Electrolyte → MIXE`, fallback → `UTPC`) — old `sequence_hint >=` logic was broken. Returns `[{process_id, code, name, sequence_hint, requires_calibration}]` ordered by `sequence_hint`. |
| `create_sub_batch` | **Updated 2026-06-29** (migration `20260629000000`). Atomic sub-batch creation: locks parent with `SELECT FOR UPDATE`, validates remaining qty, generates batch number server-side (`p_process_code-YYYYMMDD-A01-<suffix>` where suffix strips the `MT` prefix from material code e.g. `MTC1→C1`), inserts child `batches` row, deducts parent `current_quantity`, inserts `batch_status_changes` audit row — all in one transaction. `SECURITY DEFINER`. Raises `EXCEPTION` if qty exceeds remaining. **Returns `JSON {id, batch_number}`** (was UUID). Params: `p_parent_id`, `p_parent_batch_number`, `p_process_code` (replaces old `p_batch_number`), `p_material_id`, `p_quantity`, `p_unit`, `p_location` (nullable), `p_changed_by` (nullable). Drawer retries up to 3× on `23505` (concurrent same-prefix collision). |
| `handle_new_user` | Pre-existing trigger function — fires on Supabase Auth sign-up, auto-creates `public.users` row. Not called directly. |

### RPC signatures and usage examples

```ts
// --- Mixing steps ---

// Add a new step to a mixing batch
const { data, error } = await supabase.rpc('log_mixing_step', {
  p_batch_id: batchId,          // UUID of the MIXC/MIXE batch
  p_type: 'add_material',       // 'add_material' | 'mix_round' | 'qc_check'
  p_label: 'Add DI Water',
  p_params: {                   // any JSONB — shape depends on type
    material_code: 'MTDW',
    quantity: 5.2,
    unit: 'kg'
  },
  p_operator: userId            // UUID of the logged-in user
})
// Returns: full mixing_steps row including auto-generated display_ref and step_number

// Mark a step complete or void it
const { data, error } = await supabase.rpc('update_mixing_step_status', {
  p_step_id: stepId,            // UUID of the mixing_steps row
  p_status: 'completed'         // 'completed' | 'voided'
})
// Returns: updated mixing_steps row with completed_at stamped

// --- Batch status ---

// Always use this — never a direct PATCH on batches
const { data, error } = await supabase.rpc('transition_batch_status', {
  p_batch_id: batchId,
  p_new_status: 'Released',     // must be valid batch_status enum
  p_reason: 'End-of-run QC passed',
  p_user_id: userId
})
// Returns: updated batches row. Throws if transition is invalid.

// Valid transitions:
// InProgress  → Released | OnHold | Quarantine | Scrapped
// OnHold      → Released | Quarantine | Scrapped
// Quarantine  → Released | Scrapped
// (no backward transitions)

// --- Genealogy ---

const { data, error } = await supabase.rpc('trace_batch_genealogy', {
  p_batch_id: batchId
})
// Returns: [{ id, batch_number, parent_batch_id, material_id, status,
//             current_quantity, unit, depth, direction }, ...]
// depth < 0 = ancestor, depth = 0 = self, depth > 0 = descendant

// --- Process route ---

const { data, error } = await supabase.rpc('get_process_route', {
  p_material_id: materialId
})
// Returns: [{ process_id, code, name, sequence_hint, requires_calibration }, ...]
// Ordered by sequence_hint — use to build the process stepper dynamically

// --- Lot generation ---

const { data, error } = await supabase.rpc('generate_lot', {
  p_lot_number: 'LOT-20260521-001',
  p_category: 'standard',
  p_battery_type: 'LFP',
  p_storage_location: 'Shelf A3',
  p_notes: '',
  p_created_by: userId,
  p_sub_batch_ids: [subBatchId1, subBatchId2],  // UUID[]
  p_unit_serials: ['SN-001', 'SN-002', 'SN-003'] // TEXT[]
})
// Returns: created lots row
```

---

## 10. Pending backend tasks

### ✅ Priority 1 — Done (2026-05-21)
| Task | Status |
|------|--------|
| `mixing_steps` table + index | ✅ Live |
| `log_mixing_step` RPC | ✅ Live |
| `update_mixing_step_status` RPC | ✅ Live |
| `transition_batch_status` RPC | ✅ Live |
| `audit_log` view | ✅ Live |

### ✅ Priority 2 — Done (2026-05-21)
| Task | Status |
|------|--------|
| `trace_batch_genealogy` RPC | ✅ Live |
| `generate_lot` RPC | ✅ Live |
| `get_process_route` RPC | ✅ Live |

### 🔴 Priority 3 — Before go-live
| Task | What | Effort |
|------|------|--------|
| ✅ **3A** RLS | `get_my_role()` STABLE SECURITY DEFINER helper; RLS on all 24 tables; 76 policies across 7 groups; write RPCs SECURITY DEFINER | Done 2026-06-04 |
| ✅ **3B** Alert triggers | DB triggers → `fn_alert_qc_fail` + `fn_alert_batch_held` live (2026-06-25, Sprint 9 J1). maintenance_overdue trigger KIV'd (app-side scan sufficient for POC). | Done |
| **3C** Seed demo data | Realistic fake batches, runs, QC, lots (depends on equipment seed) | 30 min |
| **3D** Seed equipment | Add rows to `equipment` — blocked on machine list from Flint | 15 min |
| **3E** Add Operator + Admin test accounts | Use 3-step SQL snippet in §13 | 10 min |

---

## 11. Implemented pages & features

| Route | Purpose | Status |
|-------|---------|--------|
| `/dashboard` | Dashboard (moved off root 2026-06-03; `/` redirects to `/login`, which forwards authed users here) | ✅ Built (mock data) |
| `/batches` | Batch management | ✅ Built (mock data) |
| `/batches/[id]` | Main (parent) batch detail + Create Sub-batch drawer | ✅ Wired to Supabase (2026-06-03) |
| `/batches/[id]/[subId]` | Sub-batch detail | ✅ Built (mock data) |
| `/lots` | Lot tracking | ✅ Built (mock data) |
| `/lots/[id]` | Lot detail | ✅ Built (mock data) |
| `/scan` | QR scanner | ✅ UI only (no camera) |
| `/log` | Unified process log page — batch scan → step selection → GenericProcessLog or MixingWorkspace (in-shell, sidebar-navigable) | ✅ Built (2026-06-19) — reuses extracted `GenericProcessLog` + `MixingWorkspace` components; ratio carry-over via `lib/mixing/ratio-plan.ts` |
| `/log/process-step` | Process step logging wizard (compatibility wrapper → `/log`) | ✅ Wired (2026-06-04) — `process_runs` INSERT with `equipment_id`/`recipe_id`; calibration gate; PATCH stamps `end_date`/`end_time`/`AwaitingQC` on submit |
| `/log/mixing/[batchId]` | Operator mixing page (compatibility wrapper → `/log`) | ✅ Wired to Supabase (2026-05-21) |
| `/log/qc` | QC logging wizard | ✅ Wired (2026-06-02; rewritten 2026-06-25 Sprint 9) — four-branch dispatch: VisualManual+notes, bounded numeric, target-relative tolerance, scrap defect-rate+throughput; `is_active` filter; creates output batch on pass, holds input batch on fail |
| `/qc-override` | QC override for Engineers/Admins | ✅ Built + wired (2026-06-02) |
| `/recipes` | Process recipes | ✅ Built (mock data) |
| `/machines` | Equipment & maintenance | ✅ Built (mock data) |
| `/reports` | Analytics & export | ⚠️ Partial |
| `/recall` | Recall & traceability investigation + Genealogy Impact Map (force-graph canvas, view toggle, node click detail panel) | ✅ Wired to Supabase (2026-05-22) |
| `/admin` | User management & settings | ⚠️ Partial |

| Feature | UI | Backend | Notes |
|---------|----|---------|-|
| Dashboard KPIs | ✅ | ❌ | Missing: first-pass yield, top defect, stock alerts |
| Yield trend chart | ✅ | ❌ | 7d/14d/30d; mock data |
| Batch list & detail | ✅ | 🟡 | List wired 2026-05-22; process stepper now dynamic via `get_process_route` RPC on sub-batch detail + process log |
| Mixing Steps panel (MIXC/MIXE) | ✅ | ✅ | RPCs live — wire `MIXING_STEPS` mock in `lib/data.ts` to `log_mixing_step` + `update_mixing_step_status` |
| Mixing operator page (`/log/mixing/[batchId]`) | ✅ | ✅ | Wired — Add Step, Mark Complete, Void all call live RPCs (2026-05-21) |
| Mixing Ratio Calculator | ✅ | ✅ | Added 2026-06-11 — `/log/mixing/[batchId]` shows a collapsible card that reads the active recipe's `mixing_steps[].amount_kg` ratios and computes per-material quantities for an entered total batch size |
| Mixing ratio carry-over | ✅ | ✅ | Added 2026-06-19 — `lib/mixing/ratio-plan.ts` (`computePlan`/`toRatioRows`) back-solves next-material quantity from anchor (first material) amount + recipe ratios; `AddStepModal` receives `suggestedMaterial`/`suggestedQuantity`/`recipeId` props; `recipe_id` persisted in first `add_material` step's JSONB params (no schema change) |
| Header search (QR icon) | 🟡 | ✅ | Updated 2026-06-19 — `QrScanButton` removed from header; `CommandPalette` trigger/dialog icon changed to `IconQR`. **Gap:** QR icon in the search trigger and dialog input row needs to be a clickable button triggering the camera scanner and redirecting to the resolved entity page. |
| Unified process log (`/log`) | ✅ | ✅ | Updated 2026-06-19 — `GenericProcessLog` rewritten as vertical scrolling form (all sections visible, dimmed until prerequisites met); recipe pulling fixed: hardcoded `PARAMS_BY_CODE` deleted, params driven by `PROCESS_PARAM_FIELDS`, recipe JSONB fetched for read-only `target:` labels; old `/log/process-step` and `/log/mixing/[batchId]` kept as compatibility wrappers |
| Lot list & detail | 🟡 | ✅ | Wired 2026-05-22. **Gap:** No way to edit or delete which sub-batches/units compose a lot once created (currently read-only). |
| Process logging (vertical form) | ✅ | ✅ | Rewritten 2026-06-19 from wizard to vertical form; equipment_id/recipe_id + calibration gate + AwaitingQC closure preserved |
| QC logging wizard | ✅ | ✅ | Wired 2026-06-01; pass path creates output batch + `batch_status_changes` (2026-06-02); fail path puts input batch OnHold + audit row (2026-06-02) |
| QC override (`/qc-override`) | ✅ | ✅ | Built + wired 2026-06-02 — Engineer/Admin only; lists unoverridden failures; writes `qc_overrides`, `process_runs.status=Overridden`, batch `Released`, `batch_status_changes` |
| QR scanning | ✅ | ✅ | `@yudiel/react-qr-scanner` wired in `/scan` and `/log/process-step`; camera error shows amber "Camera unavailable" message with manual-entry fallback; equipment-code QR → `/machines?equipment=<code>` deep-link wired (2026-06-09) |
| Recipes (read/create/edit/version) | ✅ | ✅ | Wired 2026-06-02 — New/Edit/New Version all write to `recipes` + `recipe_parameters`; `parent_recipe_id` versioning; 23505 handling; page revalidates via `mutate('recipes')` |
| Recipe active toggle | ✅ | ✅ | Wired 2026-06-05 — `flipActive` PATCHes `recipes.is_active` by UUID, optimistic local update, in-flight guard against double-click; `tests/sprint4/recipes-toggle.spec.ts` |
| Machines / Maintenance | ✅ | ✅ | Wired 2026-06-02 — Add/Edit Equipment write to `equipment` (process dropdown uses real UUIDs, 23505 dup-code handling); Log Maintenance writes to `equipment_maintenance` (`performed_by`=user.id; reviewed_by/approved_by merged into single text field, written to both DB columns). **Gap:** The merged field is not displayed in the maintenance log history entries on the `/machines` page. |
| Maintenance checklist (per-machine) | ✅ | ✅ | Re-integrated 2026-06-05 (`feature/machines-maintenance-checklist`) — Admin defines task names per machine in Add/Edit Equipment (`equipment.checklist_template` JSONB); Log Maintenance renders a Task/Done/Remarks table from the template, saving Y/N + remarks to `equipment_maintenance.checklist_results` JSONB; expanded machine row shows saved results inline. Columns + 23 templates already live; migration `20260605000000` backfills the repo. `tests/sprint4/machines-checklist.spec.ts` (3). **Open:** Engineer-editable machine IDs still Admin-only |
| Machine add/edit/deactivate | ✅ | 🟡 | Add/Edit wired 2026-06-02. Active toggle + Delete wired 2026-06-05 (Admin-gated) — toggle PATCHes `equipment.is_active` (optimistic + rollback + double-click guard), Delete DELETEs by UUID with 23503 FK "in use" handling; `tests/sprint4/machines-toggle-delete.spec.ts`. Per-machine deactivate via the active toggle now persists |
| Reports — Batch/QC/Defect | ✅ | ✅ | Live Supabase queries wired 2026-06-03 — date range defaults to last 30 days; Batch Summary from `batches`+`materials`; QC Analysis from `qc_check_results`+`qc_check_definitions`+`users`; Defect Trends grouped from failed QC results |
| Reports — Compliance | ✅ | ✅ | Wired 2026-06-04 — live `qc_check_results`+`qc_overrides` over the date range → pass-rate/fail/override summary cards; Generate exports the summary as CSV (papaparse) |
| CSV export | ✅ | ✅ | Reads from live state arrays (2026-06-03) |
| XLSX export | ✅ | ✅ | Wired 2026-06-04 — SheetJS (`xlsx`) `json_to_sheet`/`writeFile` over each tab's live arrays |
| PDF export | ✅ | ✅ | Implemented |
| Recall investigation | ✅ | ❌ | Mock result |
| Genealogy Impact Map (`/recall`) | ✅ | ✅ | Wired to `trace_batch_genealogy` RPC (2026-05-22) |
| Admin — Users/Perms/Audit | ✅ | ✅ | Audit Log wired (2026-05-22); Users tab fully wired 2026-06-01 — Add/Edit/Delete/Toggle all call Supabase via server actions (service role key) |
| Login / Auth | ✅ | ✅ | `supabase.auth.signInWithPassword` wired; `middleware.ts` + `auth-context.tsx` complete; forgot-password UI-only (no reset flow). Routing-layer RBAC added 2026-06-01. |
| Material stock intake form | ❌ | ❌ | Fields in §5.1 |
| Auto battery yield calculation | ❌ | ❌ | Client requirement |

---

## 12. Frontend integration gap summary

### Not built at all
| Gap | Priority |
|-----|----------|
| RBAC enforcement — routing layer | ✅ Done 2026-06-01 — `/admin`, `/reports`, `/recall` gated in `middleware.ts` |
| RBAC enforcement — page-level `useAuth()` guards | ✅ Done — `/admin`, `/reports`, `/recall` pages guarded via `useAuth()` (confirmed 2026-06-02) |
| ~~Mixing operator page `/log/mixing/[batchId]`~~ | ✅ Wired 2026-05-21 |
| Mixing step RPC wiring (`add-step-modal`, `mixing-steps-panel`, sub-batch detail page) | ✅ Done 2026-06-01 — `log_mixing_step` + `update_mixing_step_status` wired; `MIXING_STEPS` mock deleted |
| `staff_code` not auto-generated on Add User (UI no longer leaks the UUID — shows "ID not available" as of 2026-06-19) | Medium — add field to Add User modal or auto-generate from role + count |
| `/log/process-step?subbatchId=` URL param not read by page — sub-batch "Log Process Step" button doesn't pre-fill batch number | Low |
| ~~Main batch detail page~~ | ✅ Done 2026-06-03 — `app/batches/[id]/page.tsx` added (parent-batch detail: 4 info cards, sub-batch table, status history, Engineer/Admin "Change status" via `transition_batch_status`). |
| ~~Sub-batch creation~~ | ✅ Done 2026-06-03. **GAP-03 closed 2026-06-25 (Sprint 8 J2+J5):** drawer now calls `create_sub_batch` RPC (single atomic call); locks parent, validates qty, inserts child, deducts parent, writes audit row all in one transaction. Over-allocation raises a DB exception surfaced as a user-facing error. Process run still inserted client-side as best-effort after RPC success. |
| ~~Alerts — generation, live wiring & dismiss~~ | ✅ MVP done 2026-06-04 (see §6b) — app-side scan generation from an admin-tunable `alert_rules` catalog, one `useAlerts` hook across all 4 surfaces, Engineer/Admin dismiss. DB triggers / generic rule-builder / auto-resolve KIV'd. |
| Material intake form (§5.1) | ✅ Done 2026-06-04 — `batch_raw_material_intake` INSERT wired in `create-batch-modal`; initial audit row + QR success screen added. Note: no `notes` column in the table so form notes field is not persisted. **2026-06-08:** added a "QC Approved from Lab? (Y/N)" gate (client request) — defaults to **No**; an unapproved batch registers `OnHold` (else `InProgress`), threaded through the `batches` INSERT + initial `batch_status_changes` row. Status+audit only, no schema change. `tests/sprint4/batch-lab-qc-gate.spec.ts` (4). |
| Per-process parameter forms (§5.3–5.8) | High — Mixing operator page done ✅; remaining processes still use generic wizard |
| QC integration into mixing operator workflow | Medium — Sequential: add materials → mix → QC check. Use `qc_check` step type in `mixing_steps`. |
| ~~Per-item QC checks (§4)~~ | ✅ Done 2026-06-25 — Sprint 9 L1: QC wizard rewritten with four branches (VisualManual+notes, ToolEquipment bounded, target-relative tolerance, Scrap defect-rate+throughput); `is_active` filter; 20 Playwright tests |
| ~~Calibration start-up flow~~ | ✅ Done 2026-06-04 — `process-step/page.tsx` shows a calibration confirmation gate (step 3) when `requires_calibration === true`; Continue gated until confirmed; no DB write. |
| ~~Dynamic process routes~~ | ✅ Done — `useProcessRoute` hook calls `get_process_route` RPC; used on sub-batch detail + process step logging. Stepper is dynamic per material. |
| ~~Machine add/edit/deactivate~~ | ✅ Done 2026-06-05 — active toggle + delete wired (Admin-gated) |
| Edit sub-batch (Engineer/Admin) | ✅ Done — `EditSubBatchDrawer` edits quantity, location, notes; role-gated in `identity-header.tsx` |
| Mixing ratio calculator | ✅ Done 2026-06-11 — `components/log/mixing-ratio-calculator.tsx` reads recipe `amount_kg` ratios, computes per-material quantities from total batch size |
| Profile settings / password change | Not built — no `/profile` or `/settings` route; no password change UI; no admin password reset |
| Maintenance form reviewed/approved merge | ✅ Done 2026-06-18 — merged two separate "Reviewed By" / "Approved By" fields into single "Reviewed & Approved By" field; updates `MaintenanceEntry` interface; writes same value to both `reviewed_by` and `approved_by` DB columns; `tests/sprint6/maintenance-reviewed-approved.spec.ts` verifies merge works correctly |
| Admin preset configuration (steps/stations) | Medium |
| Auto battery yield calculation | Medium |
| Material stock alerts | ✅ Done 2026-06-04 — "Active Alerts" KPI on dashboard counts all unresolved alerts (no dedicated low_stock rule exists yet). |
| First-pass yield % | ✅ Done 2026-06-04 — "First-Pass Yield (7d)" KPI card added to dashboard. |
| Top defective reason | ✅ Done 2026-06-04 — "Top Defect (7d)" KPI card added to dashboard. |
| Shift anomaly detection | Low |
| GAP-09 backend — Low-stock foundations | ✅ Done 2026-06-25 (Sprint 9 J2) — `low_stock` rule added to `alert_rules` (enabled, severity=warning). `materials.min_storage_threshold` is the existing column for stock thresholds (no `minimum_stock` column added — they are the same concept). **Sprint 10 frontend:** add `low_stock` builder to `scanAlerts()` that compares a material's current stock against `min_storage_threshold`. |
| GAP-15 — Alert DB triggers | ✅ Done 2026-06-25 (Sprint 9 J1) — `fn_alert_qc_fail` (AFTER INSERT on `qc_check_results` WHERE passed=false) and `fn_alert_batch_held` (AFTER UPDATE on `batches` WHERE status → OnHold/Quarantine/Scrapped). Both SECURITY DEFINER, dedup_key mirrors `scanAlerts()`, `alerts_dedup_active` index prevents duplicates. maintenance_overdue and expiry_soon triggers KIV'd. |
| Edit lot composition (sub-batches/units) after creation | Medium — Allow modifying/deleting sub-batches or units assigned to a lot after its initial generation (currently read-only) |

### Built in UI but not wired
| Gap | Notes |
|-----|-------|
| ~~Mixing operator page `/log/mixing/[batchId]`~~ | ✅ Wired 2026-05-21 |
| ~~Genealogy Impact Map `/recall`~~ | ✅ Wired 2026-05-22 |
| ~~Admin audit log tab~~ | ✅ Wired 2026-05-22 |
| ~~QR camera~~ | ✅ Wired 2026-06-09 — `@yudiel/react-qr-scanner` + local WASM; equipment-code QR → `/machines?equipment=` deep-link; typed `cameraErrorMessage` per `IScannerError.kind` |
| ~~Search~~ | ✅ Wired 2026-06-05 — ⌘K command palette (`components/command-palette.tsx`) live-searches batches/lots/recipes/machines and navigates to detail routes. `tests/sprint4/global-search.spec.ts` |
| Command palette QR scan button | QR scanner button inside search bar/palette trigger & input row — clickable button to open camera, scan QR, and redirect to batch/recipe/lot page (falls back to prefilled search palette on no exact match) |
| ~~Maintenance Log Reviewed & Approved By display~~ | ✅ Done 2026-06-25 (Sprint 8 GAP-18) — duplicate render removed; single styled "Reviewed & Approved By" line renders when `reviewed_by` or `approved_by` is set |
| CSV (PDF/XLSX) | ~~CSV wired 2026-06-03~~; ~~XLSX wired 2026-06-04 (SheetJS)~~; PDF still a toast/`// TODO` |
| Lot generation | ~~Wired 2026-06-03~~ — `generate_lot` RPC called; available sub-batches fetched live |
| Reports page | ~~Wired 2026-06-03~~ — Batch Summary / QC Analysis / Defect Trends all live |

### Corrections to existing mock data
| Issue | Correct Value | Status |
|-------|--------------|--------|
| Process codes in batch IDs | Must use MIXC, CTGC, CALC, DICC, DICA, CUTS, SLTS, SLTC, UTPC | ✅ Done |
| Process route (all materials show same steps) | Each material has a unique route (see §2) — use `get_process_route` RPC | ✅ Done — `useProcessRoute` hook calls RPC; sub-batch detail + process log both use dynamic routes |
| Operator history restriction | Operators should only see previous week, not all history | ✅ Done 2026-06-03 — `useBatches` + `useDashboard` filter to 7 days for Operator role |
| QC verdict field | Needs per-item results, not a single overall pass/fail | ✅ Done 2026-06-02 — QC wizard writes per-item `qc_check_results` rows |

---

## 13. Recommended next steps (frontend — updated 2026-05-21)

**Immediate — wire what's ready right now**
1. Wire mixing operator page `/log/mixing/[batchId]` — replace `MIXING_STEPS` mock in `lib/data.ts` with `log_mixing_step` + `update_mixing_step_status` RPC calls
2. Wire genealogy page `/recall` — replace mock with `trace_batch_genealogy` RPC
3. Wire admin audit log tab — query `audit_log` view

**Phase 2 — Core data wiring**
4. Replace `lib/data.ts` mock arrays with real Supabase query hooks (batches, processes, materials, recipes — read-only first)
5. Wire dashboard KPIs and yield chart
6. Fix process stepper to use `get_process_route` RPC per material

**Phase 3 — Logging & forms**
7. Build material intake form (§5.1) — POST to `batches` + `batch_raw_material_intake`
8. Update process logging wizard with per-step fields for remaining processes (§5.3–5.8)
9. Update QC wizard with per-item checks and calibration flow (§4)
10. Wire all form submissions with error handling and toasts
11. Wire all batch status changes through `transition_batch_status` RPC

**Phase 4 — Operations**
12. QR camera scanning (`getUserMedia` + QR decode library)
13. CSV export logic
14. ~~Search (⌘K)~~ ✅ Done 2026-06-05 — command palette over batches/lots/recipes/machines
14b. Integrate QR scanner button into search trigger / input row to launch camera scanner and redirect to resolved pages.
15. Auto battery yield calculation
16. Material stock alerts and first-pass yield on dashboard

**Phase 5 — Admin & polish**
17. RBAC enforcement — gate pages and actions by role
18. Machine add/edit/deactivate
19. Configure steps/stations (Admin presets)
20. Compliance report tab
21. Forgot password reset flow
22. Edit lot composition drawer/modal to add/remove sub-batches/units from existing lots.
23. ~~Display the "Reviewed & Approved By" field in the maintenance log history entries on the `/machines` page.~~ ✅ Done 2026-06-25 (Sprint 8 GAP-18)

---

## 14. Test accounts (Supabase — live)

Seeded 2026-05-14. Use these to log in during development.

| Name | Email | Password | Role | Staff code |
|------|-------|----------|------|------------|
| Dev Engineer | `dev.engineer@flintlabs.com` | `Test1234` | Engineer | ENG-DEV |
| Dev Admin | `dev.admin@flintlabs.com` | `Test1234` | Admin | ADM-DEV |
| (legacy) | `engineer@flintlabs.com` | `Test123` | Operator (no role set) | — |

**`dev.engineer@flintlabs.com`** is the recommended account for day-to-day testing — Engineer role covers all Operator actions plus QC overrides, batch status changes, recipes, and the dashboard. Use **`dev.admin@flintlabs.com`** to test the `/admin` page.

### Adding more test accounts

Direct SQL inserts into `auth.users` require **three steps** — skip any one and login will fail silently:

> ⚠️ **Critical:** `instance_id` must be set to `'00000000-0000-0000-0000-000000000000'` and token columns must be empty strings (not NULL). Omitting these causes GoTrue to return 400 on login even though the password hash is correct.

```sql
DO $$
DECLARE
  v_id   UUID := gen_random_uuid();
  v_email TEXT := 'operator@flintlabs.sg';
  v_name  TEXT := 'Ahmad Rizal';
  v_role_id UUID := '3468ba22-bc4e-446a-8539-70f4a53d1023'; -- Operator
  -- Role IDs: Admin    bdc93b0a-fb76-4498-a2e9-83bc7dc72ddf
  --           Engineer 752526b8-12e7-44fb-98f1-4fbef368ae82
  --           Operator 3468ba22-bc4e-446a-8539-70f4a53d1023
BEGIN
  -- 1. Auth user (email pre-confirmed)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, is_sso_user, is_anonymous, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',  -- required: GoTrue rejects login if NULL
    v_id, 'authenticated', 'authenticated', v_email,
    crypt('FlintTest2026!', gen_salt('bf', 10)),  -- cost 10 required; gen_salt('bf') defaults to 6 which GoTrue rejects
    now(), '', '', '',                       -- token columns must be '' not NULL
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name),
    false, false, false, now(), now()
  );

  -- 2. Identity row (required by GoTrue — missing this breaks login)
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_id, v_email,
    jsonb_build_object('sub', v_id, 'email', v_email,
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  -- 3. Public profile + role (trigger may have created the row; upsert handles both)
  INSERT INTO public.users (id, full_name, role_id, staff_code, is_active)
  VALUES (v_id, v_name, v_role_id, 'OPR-001', true)
  ON CONFLICT (id) DO UPDATE SET
    full_name  = v_name,
    role_id    = v_role_id,
    staff_code = 'OPR-001',
    is_active  = true;
END;
$$;
```

> **Note:** RLS is currently disabled on all 23 tables — any authenticated user can read/write everything. This is intentional during development. Enable RLS with policies before go-live (Priority 3, task 3A).

---

## 15. Feature test log

Last updated: 2026-06-02. ✅ = confirmed working · ❌ = confirmed broken · ⏳ = not yet tested.

**Automated tests** (`npm test`) run via Playwright — see `tests/sprint3/`. Manual tests below.

| # | Feature / Route | Result | Notes |
|---|----------------|--------|-------|
| T1 | Login (`/login`) | ✅ | `engineer@flintlabs.com` / `Test123`; `dev.engineer@flintlabs.com` / `Test1234` |
| T2 | Batch creation — material selector loads | ✅ | Fetches from `materials` table; requires JWT anon key (not `sb_publishable_*`) |
| T3 | Batch creation — end-to-end INSERT | ✅ | `MTC1-20260521-A20` confirmed in DB |
| T4 | Mixing page — page load & step fetch | ⏳ | Not yet tested |
| T5 | Mixing page — Add Step (RPC) | ⏳ | Not yet tested |
| T6 | Mixing page — Mark Complete (RPC) | ⏳ | Not yet tested |
| T7 | Mixing page — Void (RPC) | ⏳ | Not yet tested |
| T8 | Batches list / detail (mock data) | ⏳ | Not regression-tested |
| T9 | Lots, Recipes, Machines, Reports | ⏳ | All still mock data, not regression-tested |
| T10a | Recall — batch found (`MTC1-20260521-A20`) | ✅ | Affected records + genealogy map render; 1 node (no parent/child batches yet) |
| T10b | Recall — batch not found | ✅ | Error banner shown correctly |
| T11a | Admin audit log — empty state | ✅ | "No audit events yet" shown before any status changes |
| T11b | Admin audit log — event row | ✅ | "Status: InProgress → OnHold" row appears after `transition_batch_status` RPC |
| T12a | QC wizard `/log/qc` — step 1 renders, Continue disabled | ✅ | Playwright automated — `tests/sprint3/qc-wizard.spec.ts` |
| T12b | QC wizard — batch not found shows error | ✅ | Playwright automated |
| T12c | QC wizard — full pass path, output batch shown | ✅ | Playwright automated |
| T12d | QC wizard — full fail path, Failed shown, no output batch | ✅ | Playwright automated |
| T13a | QC override `/qc-override` — empty state | ✅ | Playwright automated — `tests/sprint3/qc-override.spec.ts` |
| T13b | QC override — pending failure cards render | ✅ | Playwright automated |
| T13c | QC override — Confirm button disabled without reason | ✅ | Playwright automated |
| T13d | QC override — full override write chain, success banner | ✅ | Playwright automated |
| T13e | QC override — already-overridden results filtered | ✅ | Playwright automated |

---

*Sources: `FLINT_SRS.md` (merged 2026-05-15, deleted) + `flint_backend_team_handoff.md` (merged 2026-05-15, deleted) + codebase analysis + backend session 2026-05-21*
