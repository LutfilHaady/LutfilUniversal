# Process Log Redesign — Design Spec

**Date:** 2026-06-28
**Branch:** `feature/process-log-redesign`
**Status:** Design — pending user review

---

## 1. Goal

Convert the process log from a step-by-step wizard into a single scrolling page, add a live timer to **every** process run (not just mixing), and give operators a way to leave the page and resume an active run. The redesign also makes recipes drive the form: auto-selecting the active recipe, pre-filling parameter fields from it, and flagging operator deviations.

The audience is factory-floor operators on mobile. Priorities, in order: data quality (recipe pre-fill + deviation tracking), reduced cognitive load (single page + collapse), and floor ergonomics (large targets, resumable runs, sticky actions).

---

## 2. Background — current state

- `components/log/generic-process-log.tsx` is a 6-step wizard (`StepHeader` + `step` state machine: Scan → Process Step → Calibration → Parameters → Confirm → Done). Only one step is visible at a time.
- Mixing (MIXC/MIXE) is a **separate surface**: selecting a mixing step redirects to `MixingWorkspace` (`/log/mixing/[batchId]` or an in-shell swap in `/log`). It uses `AddStepModal`, `TimerCard`, `StepHistory`, `MixingQCGate`, and `MixingRatioCalculator`.
- Non-mixing runs are logged **retroactively in one submit**: `process_runs` is INSERTed and immediately PATCHed to `AwaitingQC` in the same `handleSubmit`. There is no live timer and no resumable in-progress state.
- The mixing `TimerCard` already computes elapsed time from the DB row's `created_at`, so it survives navigation — but there is no shortcut back to it.
- Recipe data is fetched and shown as read-only `target:` hints; values are **not** auto-filled. `recipe_unchanged` is hardcoded `true`.

### Relevant data relationships (all already in the DB)
- `batches.material_id` → `get_process_route(material_id)` returns ordered, material-specific process steps (via `materials.first_process_id` + `processes.sequence_hint`).
- `recipes.process_id` links a recipe to one process; `recipes.is_active` filters active ones; `recipes.params` (JSONB) holds the targets.
- `process_runs`: `operator_id`, `equipment_id`, `recipe_id`, `start_date`, `start_time`, `end_date`, `end_time`, `status` (`InProgress` → `AwaitingQC`), `recipe_unchanged`.
- `process_run_inputs`: `input_batch_id`, `quantity_consumed`.
- `process_run_parameters`: `parameter_key`, `parameter_value`, `is_modified_from_recipe`.
- `PROCESS_LOG_FIELDS` (in `lib/constants.ts`) defines per-process operator fields keyed by process code.

---

## 3. Page layout — single scrolling form

The whole log lives on one scrollable page. Numbered sections reveal progressively as prerequisites are met; completed sections collapse to a one-line summary with an edit affordance.

| # | Section | Reveals when | Collapsed summary |
|---|---------|--------------|-------------------|
| 1 | Scan batch | always | `Batch — <batch_number>` |
| 2 | Process step | batch resolved | `<process name>` |
| 3 | Equipment and recipe | step selected (non-UTPC) | `<equipment> · <recipe>` |
| 4 | Parameters **or** Mixing steps | step selected | (stays expanded while active) |
| 5 | Review and start | params ready | — |

- **Header:** `N / 5` progress counter replaces the wizard's `StepHeader` bar. No `step` state machine.
- **Collapse-on-complete:** finished section → `[green check] Name — value` + edit icon. Tapping edit re-expands.
- **Invalidation rules on edit:**
  - Change **batch** → clear sections 2–5.
  - Change **process step** → clear equipment, recipe, params (3–5).
  - Change **recipe** → re-pre-fill params (existing edited values are overwritten; warn inline before overwriting if any field was modified).
- **Sticky action bar** at the bottom of the viewport holds the primary button.

---

## 4. Data flow & recipe logic

Chain: **batch → material → process route → process step → recipe → param pre-fill**.

1. **Batch lookup** (section 1): scan or manual entry → resolve `batches` row → keep `id`, `material_id`, `batch_number`.
2. **Process step** (section 2): dropdown populated from `get_process_route(material_id)` — only valid steps for that material. Selecting `MIXC`/`MIXE` switches section 4 into mixing mode (see §6). Selecting `UTPC` switches to multi-batch input (see §7).
3. **Equipment** (section 3): query `equipment WHERE process_id = step.process_id AND is_active = true`.
   - 1 result → auto-select.
   - Multiple → dropdown; pre-select last-used for this process from `localStorage` if present.
4. **Recipe** (section 3): query `recipes WHERE process_id = step.process_id AND is_active = true`.
   - 1 result → auto-select, hide the dropdown (show as a labelled value).
   - Multiple → dropdown sorted by `version` descending; pre-select last-used from `localStorage`, else latest version.
   - 0 results → "No active recipes"; fields left empty for manual entry.
5. **Param pre-fill** (section 4): on recipe select, fetch `recipes.params`, flatten (scalars + arrays as `key[i]`), and **populate** each matching field in `PROCESS_LOG_FIELDS[step.code]`. Show a note: "Pre-filled from `<recipe_number> v<version>`. Edit any field to override." Each pre-filled field also shows a `target: X` hint.
6. **Deviation tracking:** if an operator edits a pre-filled value away from its recipe target → field turns amber + a "modified" tag appears. Reverting clears it.
7. **Bounds warning (non-blocking):** if the recipe/QC def carries `acceptance_criteria_min`/`max` for a field and the entered value is outside, show an inline amber "outside recipe range (min–max)" note. Does **not** block starting the run.
8. **last-used persistence:** on successful run start, write `{ [processId]: { equipmentId, recipeId } }` to `localStorage`.

---

## 5. Timers on every process run

The defining change: **all** process runs (not just mixing) get a live timer and a resumable in-progress state.

### Lifecycle
1. Operator fills sections 1–4, then taps **Start run** (section 5 / sticky bar).
2. INSERT `process_runs` with `operator_id`, `equipment_id`, `recipe_id`, `start_date`, `start_time`, `status = 'InProgress'`. INSERT `process_run_inputs` (input batch + qty). INSERT `process_run_parameters` (with `is_modified_from_recipe` per field). Compute and store `recipe_unchanged = (no field modified)`.
3. The **active-run drawer** (§8) appears with a timer counting up from `start_date`+`start_time`.
4. Operator may navigate away and return; the drawer/timer rehydrate from the DB timestamp (no client-only timer state).
5. Operator taps **Complete run** → PATCH `end_date`, `end_time`, `status = 'AwaitingQC'`. `mutate(['process-timeline', batchId])`.
6. Section 5 / drawer shows a success confirmation with "Log another" and "Return to batch".

### Timer display
- Counts **elapsed** from start (mirrors the existing `TimerCard` math: `Date.now() - start`).
- **Target/expected duration is optional.** Mixing rounds already carry `durationMinutes` from recipe — those show elapsed/remaining + overrun warning (unchanged). Non-mixing runs count up with no target unless a recipe field supplies one; no overrun logic when there's no target. (No schema change; a target is purely presentational if absent.)

### Behavioral change to flag
Today non-mixing runs open and close in one submit. After this change a non-mixing run **stays `InProgress`** until the operator completes it. This better reflects real floor time but means an operator can have multiple open runs (handled by the drawer + dashboard chip).

---

## 6. Mixing (MIXC/MIXE) — inline, strict gating preserved

**Decision:** Approach A (full inline). Mixing is absorbed into section 4 of the single page — no redirect. **Strict sequential gating is kept** (user confirmed): each material must pass QC before the next material can be added.

Section 4 in mixing mode renders:
- **Recipe-driven plan:** the ratio plan (`lib/mixing/ratio-plan.ts` `computePlan`/`toRatioRows`) lists materials with target quantities, derived from the recipe and the first (anchor) material's actual amount. Replaces the collapsible `MixingRatioCalculator` with an always-visible plan checklist.
- **Sequential checklist:** completed materials show with a green check + "QC passed"; the active material is editable inline; upcoming materials are locked with a lock icon and their target quantity shown.
- **Inline add-material form** (replaces `AddStepModal`'s material section): material select (`useMaterials`), quantity (pre-filled from plan), unit. On submit it creates the child batch (`{parent}-{materialCode}`) and opens the inline QC gate.
- **Inline QC gate** (reuse `MixingQCGate` logic): blocks the next material until QC is logged for the child batch. Fail → child batch `OnHold`.
- **Inline mix-round timer** (reuse `TimerCard`): the mix-round timer is part of the active-run drawer (§8) when a round is `in_progress`.
- **Step history** accumulates inline (reuse `StepHistory`).

Existing mixing RPCs and components are reused: `log_mixing_step`, `update_mixing_step_status`, `TimerCard`, `StepHistory`, `MixingQCGate`. They are recomposed into the inline layout rather than rewritten.

---

## 7. UTPC (Assembly) — multi-batch input

Assembly has no recipe pre-fill and no per-material ratio. Section 4 shows the existing multi-batch input (primary batch + add additional input batches). Timer/start/complete lifecycle is identical to other non-mixing runs.

---

## 8. Active-run drawer + dashboard chip

### Drawer (process log page only)
A persistent bar pinned to the bottom of the **process log page** (not global). It appears whenever the current operator has an active (`InProgress`) run.
- **Collapsed:** pulsing green dot · round/step label · batch number · live elapsed timer · chevron-up.
- **Expanded:** label + target, large elapsed timer, progress bar (when a target exists), and primary actions — **Complete run / Complete round** and **Void** (mixing) or **Complete run** (non-mixing). For mixing, a compact step summary.
- Source: query `process_runs WHERE operator_id = me AND status = 'InProgress'` (+ active `mixing_steps` for mixing rounds). Timer derives from DB timestamps.

### Dashboard chip (minimal)
A single compact row on the dashboard — **not** a full timer widget — to avoid clutter (user requirement):
- `1 active run` · `<batch> — <step> <elapsed>` · arrow → navigates to `/log` where the drawer takes over.
- With 2+ runs: `N active runs` with a condensed inline list of `<batch> <elapsed>` pairs.

---

## 9. Calibration & success

- **Calibration gate:** when `selectedStep.requires_calibration`, an inline checkbox appears within section 4 (not a separate wizard step). Start run is disabled until confirmed. No DB write (unchanged behavior).
- **Success state:** inline banner in section 5 / drawer (not a full-screen takeover) naming the process + batch, with "Log another" (resets) and "Return to batch".

---

## 10. Inline validation & ergonomics

- Per-field state: green when valid/matching recipe, amber when modified, red + hint when invalid (e.g. negative quantity).
- Touch targets ≥ 44px; existing input height bumped to match.
- Scan-first hierarchy retained (camera primary, manual fallback).
- Network failure on start/complete: surface a plain message and preserve entered values for retry.

---

## 11. Components affected

| File | Change |
|------|--------|
| `components/log/generic-process-log.tsx` | Rewrite: wizard → single-page sections; collapse-on-complete; recipe auto-select + pre-fill + deviation; start/complete lifecycle; inline calibration; inline mixing mode. |
| `components/log/active-run-drawer.tsx` | **New** — collapsed/expanded drawer driven by the operator's `InProgress` runs. |
| `components/mixing/mixing-workspace.tsx` | Refactor: its composition moves into section 4 of the process log (inline mixing). The standalone page becomes a thin wrapper or is retired. |
| `components/mixing/add-step-modal.tsx` | Material/round entry inlined into section 4 (modal shell dropped for the in-log flow; may remain for the sub-batch page if still used there). |
| `components/mixing/timer-card.tsx`, `step-history.tsx`, `mixing-qc-gate.tsx` | Reused, recomposed inline. |
| `components/log/mixing-ratio-calculator.tsx` | Superseded by the always-visible plan checklist in section 4 (remove or repurpose). |
| Dashboard (`components/dashboard/*` / `app/dashboard`) | Add the compact active-run chip + a small hook for the operator's `InProgress` runs. |
| `lib/hooks/*` | New hook(s): active runs for current operator; possibly a shared timer hook. |
| `app/log/page.tsx`, `app/log/process-step/page.tsx`, `app/log/mixing/[batchId]/page.tsx` | Adjust wrappers to the inline model; keep compatibility routes working. |

---

## 12. Schema

No schema changes required. Everything uses existing columns:
- `process_runs.status` stays `InProgress` until completion (already supported).
- Timers derive from `start_date`/`start_time` (+ `end_date`/`end_time` on completion).
- `process_run_parameters.is_modified_from_recipe` and `process_runs.recipe_unchanged` get **correctly computed** values (currently `recipe_unchanged` is hardcoded `true`).

If a non-mixing target duration is ever wanted, it would live in `recipes.params` (no migration), read presentationally. Out of scope for v1.

---

## 13. Testing (Playwright, mocked Supabase)

New specs under `tests/<sprint>/`:
- Single-page reveal: sections unlock in order; collapse-on-complete; edit re-expands; batch change invalidates downstream.
- Recipe auto-select (1 active) and pre-fill; deviation turns a field amber; `recipe_unchanged`/`is_modified_from_recipe` in the INSERT bodies reflect edits.
- Start run → `process_runs` INSERT body has `status=InProgress`; drawer appears.
- Complete run → PATCH body has `end_date`/`end_time`/`status=AwaitingQC`.
- Resume: with a mocked `InProgress` run for the operator, the drawer renders on `/log` and the dashboard chip renders on `/dashboard`.
- Mixing inline: strict gating — next material locked until QC logged; fail sets child `OnHold`.
- UTPC multi-batch input still works.
- Calibration gate gates Start run when `requires_calibration`.

All Supabase REST/RPC mocked via `page.route()`; `/rest/v1/users` left real; stateless mocks (no call counters). Run `npm test` green before any push to `dev`.

---

## 14. Out of scope (v1)

- Per-process target durations / overrun for non-mixing runs.
- Global (all-pages) active-run drawer — drawer is process-log-only; dashboard gets the chip.
- Usage-frequency recipe ranking / ML recommendations.
- Auto battery-yield calculation (separate client requirement).
- Any change to RLS, RPCs, or table structure.

---

## 15. Workflow

Feature branch `feature/process-log-redesign` → implement with Playwright coverage → `npm test` green → update `docs/SESSION_LOG.md` + `docs/FLINT_REFERENCE_21052026.md` → merge to `dev` → push. **No push to `main`** without explicit go-ahead. Local dev shares the live Supabase, so no destructive SQL and no bulk test data.
