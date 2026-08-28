# CLAUDE.md

Guidance for AI agents working in this repository.

## What this repo is

An **Excel VBA macro** that automates the **MFC (Missed Financial Counselling)** report
for the Financial Counselling team at Tan Tock Seng Hospital (TTSH). The macro takes four
Excel inputs (two eFC exports, an Epic Census export, and the previous MFC report),
filters and enriches the data, and produces a formatted `.xlsx` report.

There is **no build system, no test runner, and no CLI**. The code is VBA that runs
inside Excel. You cannot execute or verify it from a terminal — see "Verifying changes".

## CRITICAL: dual-source maintenance

The code exists in **two places that must be kept byte-for-byte in sync (logically)**:

1. The individual **`*.bas` module files** in the repo root (the dev source).
2. **`MFC_All_Modules.txt`** — a single concatenation of every module. **This is the staff
   deliverable**: the user pastes it into Excel's VBA editor.

**Every code change MUST be applied to BOTH the relevant `.bas` file AND `MFC_All_Modules.txt`.**
After editing, verify the two are in sync (e.g. `grep` the changed lines in both).

- Keep `MFC_All_Modules.txt` in clean ASCII. Use `--` for dashes, never smart quotes or
  `?`-corruption. After any edit, confirm no stray `?` characters were introduced into the
  lines you touched (the only legitimate `?` in the file are inside MsgBox prompt text such
  as `"Continue anyway?"`).

## Repository layout

| Path | Purpose |
|------|---------|
| `MainMacro.bas` | `GenerateMFCReport` — orchestrates the 9 steps in order |
| `Helpers.bas` | File pickers, validation, `FindColByHeader`, `CreateConfigSheet` |
| `CombineEFC.bas` | Stacks the "missed FC" EFC rows below the main EFC rows |
| `ExtractDate.bas` | Reformats Admission Date, inserts "Adm Date for MFC" column |
| `FilterFCStatus.bas` | `FilterFCStatus` — keep Draft/Missed rows before Epic lookup |
| `FilterBedCode.bas` | `FilterBedCode` — NCID ward allowlist filter; edit `NCID_WARDS` here |
| `EpicLookup.bas` | Bulk dictionary lookup of Bed + Admit Status from Epic by Encounter No/CSN |
| `FlagDuplicates.bas` | Reds duplicate Encounter No + Patient Name rows |
| `BuildOutput.bas` | `BuildMFCOutput` — orchestrates output sheet creation and file save |
| `OutputWriter.bas` | Writes/formats the A--P output cells, borders, font, freeze panes |
| `Backlog.bas` | `BacklogSummary` — carry-forward cols A-D + backlog counts |
| `SummaryTable.bas` | Writes the bottom summary table (Total Cases, Backlog, CCF, EL) |
| `Dropdowns.bas` | Output dropdowns (Resolution Status, Inflight FC Status, Staff Follow Up) |
| `FilePickerForm.bas` | Dashboard-style file selection with live validation and folder memory |
| `ProgressForm.bas` | Modeless progress-bar window shown during a run (UserForm) |
| `MFC_All_Modules.txt` | Concatenated deliverable — keep in sync with the `.bas` files |
| `docs/MFC_Macro_Context.md` | Full domain context: inputs, export steps, ward reference, workflow |
| `docs/superpowers/` | Design specs and plans for past features |

> **Note:** `docs/MFC_Macro_Context.md` is the authoritative domain reference, but parts of it
> have drifted from the code — specifically the output-column table and the large commented-out
> "Complete Code" appendix (which shows old hardcoded-column versions). Trust the `.bas` files
> for current behaviour; treat that appendix as historical.

## Architecture conventions (follow these)

- **Resolve columns by header, never by hardcoded index.** Use `FindColByHeader(ws, "Header Name")`
  (case-insensitive, whitespace/line-break tolerant via `NormHeader`). Input reports add/move
  columns over time; positional indexing breaks silently. This is the single most important
  invariant in the codebase.
- **Load–process–write in bulk.** Read a range into a `Variant` array once, do all logic in
  memory (arrays + `Scripting.Dictionary`), write back in one assignment. Epic is ~20,000 rows;
  per-cell COM access is far too slow.
- **No hardcoded file paths.** All file selection goes through `Application.FileDialog`.
- **One responsibility per module.** Keep orchestration in `MainMacro`.

## Current output layout (cols A–P)

`BuildMFCOutput` writes these headers. Cols A–D + E are manual; F–P come from the data.

| Col | Header | Source |
|-----|--------|--------|
| A | Inflight FC Status | Manual dropdown (Config); carried forward from prev MFC |
| B | Date Updated (DD/MM/YYYY) | Manual; dropdown of recent dates; carried forward |
| C | Staff Follow Up (if any) | Manual dropdown (Config); carried forward |
| D | Remarks | Manual; carried forward |
| E | Resolution Status | Manual dropdown: `Follow Up` / `Resolved` (drives row colour) |
| F | FC ID | EFC |
| G | Encounter Number | EFC (used as the backlog/carry-forward key) |
| H | MRN | EFC |
| I | Patient Name | EFC |
| J | Adm Date for MFC | EFC, reformatted DD/MM/YYYY |
| K | FC Status | EFC |
| L | Admit Status | EFC |
| M | Point of Care | EFC |
| N | Point of Care Final Bed | Epic Bed |
| O | Admission Level Of Care | EFC |
| P | Epic Admission Status/Discharged | Epic |

The **previous MFC** workbook comparison searches for the sheet named **`"MFC Report"`** first, then falls back to **`"MFC"`**, sheet 3 (legacy fallback), and finally sheet 1. This ensures it is compatible with both legacy files and its own generated output files.

## VBA gotchas that have actually bitten us

- **`IIf()` is NOT short-circuit.** It evaluates *both* the true and false branches. Never write
  `IIf(col > 0, arr(i, col), "")` — when `col = 0` it still evaluates `arr(i, 0)` and throws
  *runtime error 9 (subscript out of range)*. Use an explicit `If col > 0 Then ...` guard instead.
- **`.Value` arrays are 1-based**, and a **single-cell** range returns a *scalar*, not a 2-D array
  (so `UBound` blows up). Guard for the single-data-row case where it matters.
- Always `Option Explicit` (already set in every module).
- `FindColByHeader` returns **0** when a header is absent — always check for 0 before using the index.

## Verifying changes (no CLI available)

You cannot run the macro from a terminal. To verify:

1. **Static checks you can do:** `grep` for dangling references to functions you removed,
   duplicate `Sub`/`Function` names, and confirm `.bas` ↔ `MFC_All_Modules.txt` are in sync.
2. **Ask the user to compile:** in Excel press `Alt+F11`, then **Debug → Compile VBAProject**.
   A "silent / nothing happens" failure at runtime is almost always a **compile error** (often
   from re-importing modules, partial imports, or having both the combined module *and* the
   individual modules loaded, which creates duplicate `Sub` names).
3. **Ask the user to run** `GenerateMFCReport` (Alt+F8) with real input files and report the
   result or any popup.

When debugging, prefer the `superpowers:systematic-debugging` skill: find the root cause from the
actual symptom before proposing a fix. Many failure modes here surface as a specific MsgBox.

## Workflow & domain detail

For input file definitions, how each report is exported, the full step-by-step workflow, the
NCID ward allowlist and reference table, filter logic, and downtime procedures, read
**`docs/MFC_Macro_Context.md`**.

## Git / process

- **Only commit when the user explicitly asks.** Do not commit proactively.
- Keep commits focused; mention both the `.bas` change and the `MFC_All_Modules.txt` mirror.
- **After every change, output a summary listing each file edited and the exact lines/sections changed.** This lets the user apply manual edits without having to read diffs.
