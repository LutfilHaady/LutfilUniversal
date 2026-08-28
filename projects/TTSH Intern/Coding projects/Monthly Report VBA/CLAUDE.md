# CLAUDE.md -- FC Completion Report Macro

## What this repo is

An **Excel VBA macro** that automates the **Monthly FC Completion Report** for the Financial Counselling team at Tan Tock Seng Hospital (TTSH). The macro takes two eFC Excel exports, cleans and deduplicates the data, calculates FC completion statistics broken down by team and status category, and produces a formatted `.xlsx` report for the monthly department meeting.

It is produced **4 working days after the last day of each month**, by the team lead taking minutes for that month.

There is **no build system, no test runner, and no CLI**. The code is VBA that runs inside Excel. You cannot execute or verify it from a terminal.

---

## UI/UX Design -- match the MFC VBA macro

This macro must follow the same UI/UX pattern as the existing TTSH MFC VBA macro:

- **FilePickerForm** -- a dashboard-style modeless UserForm showing all input file slots at once. Each slot has a `Browse...` button and a live status indicator (`✓ Valid` / `✗ Invalid` / `○`). The `Generate Report` button is only enabled when all slots are valid. `Cancel` closes any opened workbooks and aborts.
- **ProgressForm** -- a modeless progress-bar window shown during processing. Updates a label and progress bar as each step completes.
- **Application.StatusBar** -- also updated at each step for users who minimise the form.
- **MsgBox prompts** -- used for errors, warnings, and the final success summary only. No silent failures.
- **File picker dialogs** -- all file selection via `Application.FileDialog`. No hardcoded paths.
- **Config sheet** -- a hidden sheet in the macro workbook storing configurable dropdown lists (e.g. staff name lists, team mappings). Created once via a setup sub.

---

## CRITICAL: dual-source maintenance

The code exists in **two places that must be kept in sync**:

1. Individual **`*.bas` module files** in the repo root (dev source).
2. **`FCCompletion_All_Modules.txt`** -- concatenation of every module. This is the staff deliverable: the user pastes it into Excel's VBA editor.

**Every code change MUST be applied to both the relevant `.bas` file AND `FCCompletion_All_Modules.txt`.**

Keep `FCCompletion_All_Modules.txt` in clean ASCII. Use `--` for dashes, never smart quotes or `?`-corruption.

---

## Inputs

Two files selected via the FilePickerForm dashboard:

### File A -- FC Summary Report
- **Source**: eFC -> FC Summary Report function
- **Filters on export**: full month date range, Admission Type = Emergency (+ Elective Inpatient for NCID AO)
- **Header row**: Row 1
- **Sheet**: confirm from actual export (typically Sheet1)
- **Key columns** (confirm letters from a real export -- do NOT hardcode positions):
  - FC ID, Encounter Number (col C confirmed), FC Mode, FC Status (col F confirmed), FC Created By, FC Created On, FC Last Updated By, FC Last Updated On, Admission Date, Admission Type, Admission Status, 1st CCF ETBS, Latest CCF Creation User, Point of Care
- **Validation**: check for FC ID, Encounter Number, FC Status, FC Mode columns

### File B -- Inflight Missed FC Report
- **Source**: eFC -> Inflight FC Report, with Missed FC indicator ticked
- **Header row**: Row 1
- **Sheet**: confirm from actual export (typically Sheet1)
- **Key columns** (standard Inflight FC Report format, A-AW):
  - Encounter No -> col C (text, e.g. `100241111111`)
  - Admission Status -> col I (values: Actualised, Planned, Cancelled, Discharged)
  - Missed FC -> col AO (value: "Yes" or blank)
  - Admission Type -> col G
  - FC Mode -> confirm column (may not exist in Inflight FC Report format; verify)
- **Validation**: check for Encounter No, Missed FC, Admission Status columns
- **Workaround flag**: if Missed FC column is entirely blank, warn the user and prompt them to use the manual eFC dashboard workaround export instead

---

## Processing Logic

### File A workflow (in order)

**Step 1 -- Filter FC Mode.**
Delete rows where FC Mode is not `"Financial Counselling - AH"` or `"Financial Counselling - Downtime"`. This removes Shopper mode and any other non-relevant modes.

**Step 2 -- Delete Cancelled Admissions.**
Delete rows where Admission Status = `"Cancelled"`.

**Step 3 -- Sort.**
Sort ascending by: (1) Latest CCF Creation Date-Time, then (2) Encounter Number. This ensures the latest FC ID appears at the bottom of each encounter group.

**Step 4 -- Highlight Duplicate Encounter Numbers.**
Apply red fill to all cells in the Encounter Number column that are duplicates (i.e. appear more than once). This is a visual aid -- staff review duplicates manually.

**Step 5 -- Add PRIORITISE column.**
Insert a new column (header: `"PRIORITISE"`) immediately after the last data column. Populate with a priority score per FC Status value. The priority order (lowest number = highest priority = row to keep):

| Priority | FC Status |
|----------|-----------|
| 1 | Completed |
| 2 | Acknowledgement by other means |
| 3 | Attempted - Virtual FC Completed, pending signature |
| 4 | Attempted - patient/NOK declines to sign |
| 5 | Attempted - Patient is unable to sign |
| 6 | Attempted - unable to complete |
| 98 | Draft / other |
| 99 | Voided / Deleted -- excluded from denominator entirely |

**Step 6 -- Add deduplication flag column.**
Insert a column (header: `"YES for Unique + highest Priority"`). For each row, flag `"YES"` if it is the single row to retain for that Encounter Number: the row with the lowest priority score. If two FC IDs share the same priority, retain the one with the largest (latest) FC ID. All other rows for that encounter get blank.

**Step 7 -- Mass delete obvious duplicates.**
Delete in bulk all rows meeting ALL three conditions simultaneously:
- The encounter number is a duplicate (red-highlighted)
- At least one other row for that encounter has FC Status = `"Completed"` or `"Acknowledgement by other means"`
- The current row's FC Status is neither `"Completed"` nor `"Acknowledgement by other means"`

**Step 8 -- Flag remaining duplicates for manual review.**
After mass deletion, the remaining duplicate encounter rows are surfaced to the user. The macro should display the count and ask the user to review them manually (or provide a helper to step through them). The deduplication flag column (Step 6) guides which to delete.

**Step 9 -- Exception: Inflight-created duplicates.**
During deduplication, if a duplicate pair has one FC ID created by an Inflight staff member (identified via FC Created By column), the Inflight-created row is deleted regardless of FC Status. This prevents EDFC workload from being undercounted. In such cases the Acknowledged row may be retained over the Completed one.

Staff names / identifiers for Inflight team in FC Created By: **[TO BE FILLED BY USER]**

**Step 10 -- Separate EM and EL admissions.**
Use Admission Type column to split rows into:
- Emergency (EM) -- handled by EDFC, Inflight, and NCID AO
- Elective Inpatient (EL) for NCID AO only -- filter by Point of Care matching NCID ward E or F values

Exact Point of Care text values for NCID E/F: **[TO BE FILLED BY USER]**

### File B workflow (in order)

**Step 1 -- Filter FC Mode** (if column exists).
Delete rows where FC Mode = Shopper or any non-FC mode.

**Step 2 -- Delete Cancelled and Planned Admissions.**
Delete rows where Admission Status = `"Cancelled"` or `"Planned"`. (Cancelled = upstream cancellation; Planned = patient never actualised in ward.)

**Step 3 -- EDVW discharge handling.**
Patients discharged from EDVW may be short-stay cases not covered by EDFC (e.g. Hand Surgery, Ortho, General Surgery). **[TO BE CONFIRMED: auto-exclude or flag for manual review?]**

**Step 4 -- Retain missed FC CSNs.**
Remaining rows after cleaning = genuinely missed FC cases. Count is added to the denominator.

---

## Denominator and Numerator

**Denominator** = unique encounter count from cleaned File A (excluding Voided/Deleted FC IDs, priority 99) + missed FC CSN count from cleaned File B.

**Numerator** -- count rows from cleaned File A by team, using Latest CCF Creation User column to identify who closed the CCF:

| Metric | Column | Criteria |
|--------|--------|----------|
| FC completed by EDFC (initial) | FC Created By | EDFC staff names: **[TO BE FILLED]** |
| FC completed by EDFC (full CCF) | Latest CCF Creation User | Same EDFC staff names |
| FC completed by Inflight | Latest CCF Creation User | Inflight staff names: **[TO BE FILLED]** |
| FC completed by NCID AO | Latest CCF Creation User | NCID AO staff names: **[TO BE FILLED]** |

---

## Output

### Colour-coded completion categories

| Colour | Group Label | FC Statuses |
|--------|-------------|-------------|
| Green | FC Completed with written acknowledgement | Completed, Acknowledgement by other means |
| Pink | CCF Explained but not signed | Attempted - Virtual FC Completed, pending signature |
| Light Green | Attempted, no further follow-up | Attempted - patient/NOK declines to sign, Attempted - Patient is unable to sign |
| Orange | FC Not Completed | Attempted - unable to complete |
| Grey/Blank | Missed FC | No FC ID created (from File B) |

### Percentage breakdown by who closed the CCF

Groups: CCF closed by Inflight staff / Admin staff / ED staff / AO staff / others / CCF not generated.

**Output sheet name**: **[TO BE FILLED BY USER]**

**Output file name pattern**: e.g. `FC Completion Report MMM YYYY.xlsx`

---

## Architecture conventions (same as MFC VBA -- follow exactly)

- **Resolve columns by header, never by hardcoded index.** Use `FindColByHeader(ws, "Header Name")` (case-insensitive, whitespace/line-break tolerant via `NormHeader`). Column positions change when eFC adds fields.
- **Load-process-write in bulk.** Read a range into a `Variant` array once, do all logic in memory (arrays + `Scripting.Dictionary`), write back in one assignment.
- **No hardcoded file paths.** All file selection goes through `Application.FileDialog`.
- **One responsibility per module.** Keep orchestration in `MainMacro`.
- **`Option Explicit`** in every module.
- **`FindColByHeader` returns 0 when absent** -- always check before use.
- **`IIf()` is NOT short-circuit** -- never use `IIf(col > 0, arr(i, col), "")`. Use explicit `If` guards.

---

## Suggested module structure

| Module | Responsibility |
|--------|---------------|
| `MainMacro.bas` | `GenerateFCCompletionReport` -- orchestrates all steps |
| `Helpers.bas` | `FindColByHeader`, `NormHeader`, `PickFile`, `CreateConfigSheet` (reuse from MFC macro) |
| `FilterFileA.bas` | Steps 1-10 for File A: mode filter, cancellations, sort, dedup logic |
| `FilterFileB.bas` | Steps 1-4 for File B: mode filter, cancellations, EDVW, count |
| `DeduplicateEncounters.bas` | Priority scoring, dedup flag, mass delete, Inflight exception |
| `BuildOutput.bas` | Creates output sheet, writes colour-coded summary, % breakdown table |
| `FilePickerForm.bas` | Dashboard UserForm (2-slot version of MFC macro's form) |
| `ProgressForm.bas` | Modeless progress bar (reuse from MFC macro) |
| `FCCompletion_All_Modules.txt` | Concatenated deliverable |

---

## VBA gotchas (same as MFC macro)

- `IIf()` evaluates both branches -- use explicit `If` guards when indexing arrays.
- `.Value` arrays are 1-based; single-cell range returns a scalar, not a 2-D array.
- `FindColByHeader` returns 0 on miss -- always guard before use.
- Scripting.Dictionary keys are case-sensitive by default -- use `.CompareMode = vbTextCompare` or `UCase()` consistently.

---

## Verifying changes

You cannot run the macro from a terminal. To verify:
1. `grep` for dangling references, duplicate Sub/Function names, and `.bas` <-> `FCCompletion_All_Modules.txt` sync.
2. Ask the user to compile: `Alt+F11` -> **Debug -> Compile VBAProject**.
3. Ask the user to run `GenerateFCCompletionReport` with real input files.

---

## Outstanding blanks -- get these from the user before implementing

1. FC Summary Report (File A) -- exact column letters (need a real export)
2. File B -- confirm whether FC Mode column exists
3. Inflight staff names / identifiers in FC Created By / Latest CCF Creation User
4. EDFC staff names
5. NCID AO staff names
6. Exact Point of Care text values for NCID E/F wards
7. EDVW discharge handling decision: auto-exclude or flag?
8. Output sheet name and file name pattern
9. Any additional output format or save-location requirements

---

## Progress tracking

**Primary progress log: [`docs/VBA_Code_Progress.md`](docs/VBA_Code_Progress.md)**

This is the single source of truth for what has been implemented, what compiles, and what is blocked on colleague input. **Read it before starting any implementation work** so you don't duplicate existing code or attempt blocked items.

It tracks:

- **Done** -- which modules/subs are implemented and compiling, with notes on design decisions (e.g. ASCII-only status indicators, safe-to-build-now rationale for dedup logic).
- **Not started** -- items blocked on outstanding questions from the process flow doc (`docs/FC_Completion_Report_Process_Flow_for_Review.md`) or CLAUDE.md blanks.
- **Compile status** -- whether `FCCompletion_All_Modules.txt` compiles cleanly in the VBA editor, and as of which date.

**After every implementation session, update `docs/VBA_Code_Progress.md`** to reflect:
1. What was added or changed (module, sub/function name, which CLAUDE.md step it covers).
2. Any design decisions or deviations from the spec.
3. Updated compile status if the user tested it.
4. Any items that moved from "Not started" to "Done" or became unblocked.

Related docs:
- `docs/FC_Completion_Report_Process_Flow_for_Review.md` -- colleague-facing process flow with 8 open questions (Q1-Q8) that gate remaining implementation.
- `CLAUDE.md` (this file) -- spec, architecture conventions, and outstanding blanks list.

---

## Git / process

- **Only commit when the user explicitly asks.**
- Keep commits focused; mention both the `.bas` change and the `FCCompletion_All_Modules.txt` mirror.
- **After every change, output a summary listing each file edited and the exact lines/sections changed.**
