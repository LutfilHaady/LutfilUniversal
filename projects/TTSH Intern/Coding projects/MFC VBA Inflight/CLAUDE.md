# CLAUDE.md

Guidance for AI agents working in this repository.

## What this repo is

An **Excel VBA macro** that automates the **MFC (Missed Financial Counselling)** daily
report for the **Inflight Financial Counselling** team at Tan Tock Seng Hospital (TTSH).
The macro takes four Excel inputs (two eFC exports, an Epic Census export, and the
previous MFC daily list), filters and enriches the data, and produces a formatted `.xlsx`
report.

This is the **Inflight counterpart** to the NCID MFC macro (separate repo at
`../MFC VBA`). The Inflight team covers the main hospital wards (levels 3--13, ICH,
Renci, MIC), while NCID covers the infectious diseases wards. The data pipeline is
structurally identical -- the differences are in which wards are kept, which columns
appear in the output, and the Inflight FC Status dropdown values.

There is **no build system, no test runner, and no CLI**. The code is VBA that runs
inside Excel. You cannot execute or verify it from a terminal -- see "Verifying changes".

## CRITICAL: dual-source maintenance

The code exists in **two places that must be kept byte-for-byte in sync (logically)**:

1. The individual **`*.bas` module files** in the repo root (the dev source).
2. **`MFC_All_Modules.txt`** -- a single concatenation of every module. **This is the staff
   deliverable**: the user pastes it into Excel's VBA editor.

**Every code change MUST be applied to BOTH the relevant `.bas` file AND `MFC_All_Modules.txt`.**
After editing, verify the two are in sync (e.g. `grep` the changed lines in both).

- Keep `MFC_All_Modules.txt` in clean ASCII. Use `--` for dashes, never smart quotes or
  `?`-corruption. After any edit, confirm no stray `?` characters were introduced into the
  lines you touched (the only legitimate `?` in the file are inside MsgBox prompt text such
  as `"Continue anyway?"`).

## Repository layout

| Path | Purpose | Relation to NCID |
|------|---------|------------------|
| `MainMacro.bas` | `GenerateMFCReport` -- orchestrates all steps in order | Fork -- different step count (discharge filter is separate step) |
| `Helpers.bas` | File pickers, validation, `FindColByHeader`, `CreateConfigSheet` | Reuse -- update Config defaults for Inflight |
| `ConfigReader.bas` | Reads all Config sheet sections; hardcoded fallback defaults | New module |
| `CombineEFC.bas` | Stacks the "missed FC" EFC rows below the main EFC rows | Reuse as-is |
| `ExtractDate.bas` | Reformats Admission Date, inserts "Adm Date for MFC" column | Reuse as-is |
| `FilterFCStatus.bas` | Keep Draft/Missed rows; drop completed/attempted statuses | Fork -- Inflight removes ALL discharged (including Missed FC) |
| `FilterWard.bas` | Final Bed excludelist filter (prefix + NCID ward code matching) | Fork -- same Mid(bed,2,3) approach as NCID but excludelist, not allowlist |
| `FilterDischarge.bas` | Remove all rows where patient is discharged; captures them onto a hidden sheet for the Discharged output tab | New module |
| `EpicLookup.bas` | Bulk dictionary lookup of Bed + Admit Status from Epic by Encounter No/CSN | Fork -- different inserted column names |
| `FlagDuplicates.bas` | Highlights duplicate Encounter No + Patient Name rows red | Reuse as-is |
| `BuildOutput.bas` | `BuildMFCOutput` -- orchestrates output sheet creation and file save, plus the optional "Discharged" tab | Fork -- 15-column output (A--O, not A--P) |
| `OutputWriter.bas` | Writes/formats the A--O output cells, borders, font, freeze panes | Fork -- 15 columns |
| `Backlog.bas` | `BacklogSummary` -- carry-forward cols A--D + backlog counts | Reuse with minor column adjustments |
| `SummaryTable.bas` | Writes the bottom summary table (Total Cases, Backlog, CCF, EL) | Reuse as-is |
| `Dropdowns.bas` | Output dropdowns (Case Status, Inflight FC Status, Staff Follow Up) | Fork -- 20-item Inflight FC Status list |
| `FilePickerForm.bas` | Dashboard-style file selection with live validation and folder memory | Reuse as-is |
| `ProgressForm.bas` | Modeless progress-bar window shown during a run (UserForm) | Reuse as-is |
| `MFC_All_Modules.txt` | Concatenated deliverable -- keep in sync with the `.bas` files | Generated from all `.bas` files |
| `Inflight_Macro_Context.md` | Full domain context: inputs, export steps, ward reference, workflow | Authoritative domain reference |
| `Inflight_VBA_Structure.md` | VBA architecture, module classification, column maps | Architecture reference |
| `Inflight SW.txt` | Official Standard Work document (operational procedure for staff) | Reference only |

## Workflow steps (macro execution order)

1. **Open & validate input files** -- file selection dashboard
2. **Combine EFC files** -- stack missed FC rows below main EFC rows
3. **Extract Admission Date** -- reformat to DD/MM/YYYY, insert "Adm Date for MFC" column
4. **Filter FC Status** -- keep Draft variants + Missed FC rows; drop completed/attempted
5. **XLOOKUP from Epic** -- dictionary lookup of Final Bed + Epic Admission Status via CSN
6. **Filter by bed code** -- excludelist filter on Final Bed for non-Inflight wards
7. **Filter discharged** -- remove ALL rows where patient is discharged (unlike NCID, no exceptions for Missed FC); runs after the bed filter so the captured Discharged tab only ever contains Inflight-ward beds
8. **Flag duplicates** -- highlight Encounter No + Patient Name duplicates in red
9. **Build output** -- create output workbook, write data, apply formatting/dropdowns
10. **Backlog summary** -- compare against previous MFC, carry forward manual columns

## Current output layout (cols A--O)

`BuildMFCOutput` writes these headers. Cols A--D + E are manual; F--O come from the data.

| Col | Header | Source |
|-----|--------|--------|
| A | Inflight FC Status | Manual dropdown (20 values from Config); carried forward from prev MFC |
| B | Date Updated (DD/MM/YYYY) | Manual; dropdown of recent dates; carried forward |
| C | Staff Follow Up (if any) | Manual dropdown (Config); carried forward |
| D | Remarks | Manual; carried forward |
| E | Case Status | Manual dropdown: `Follow Up` / `Resolved` / `U-turn` (drives row colour: amber / green / yellow) |
| F | FC ID | EFC col A (blank for Missed FC rows) |
| G | Encounter Number | EFC col C (used as the backlog/carry-forward key) |
| H | MRN | EFC col D |
| I | Patient Name | EFC col F |
| J | Adm Date for MFC | EFC col H, reformatted DD/MM/YYYY |
| K | FC Status | EFC col AQ (blank for Missed FC rows) |
| L | Point of Care | EFC col K |
| M | Final Bed | Epic col H (via CSN lookup) |
| N | Admission Level Of Care | EFC col L |
| O | Epic Admission Status | Epic col E (via CSN lookup) |

## Discharged cases report ("Discharged" tab)

`FilterDischarged` (`FilterDischarge.bas`, step 7) no longer just deletes discharged rows --
it captures them onto a hidden temp worksheet (the `dischargedWs` out-parameter) before
removing them from the main pipeline. `BuildMFCOutput` (`BuildOutput.bas`) uses that
captured sheet to add a second **"Discharged"** tab to the same output workbook, alongside
the main "MFC Report" tab.

`FilterDischarged` runs **after** `FilterByBedCode` (step 6), not before -- so
non-Inflight-ward rows are already gone by the time discharged rows get captured. The
Discharged tab therefore only ever contains the same Inflight-ward beds as the main report,
never discharged patients from wards Inflight doesn't cover (e.g. ED beds).

- **Purpose:** lets the manager close these cases out directly in eFC -- not Epic. Epic is
  only used to detect the discharge trigger and the bed; the columns that let the manager
  find and close the case (FC ID, Encounter Number, MRN, Patient Name, FC Status) come from
  eFC.
- **Population:** every pending-FC case (Draft or Missed FC) that turned out to be
  discharged -- exactly the rows the discharge filter used to delete outright.
- **Columns:** identical A-O layout to the main report, including the Inflight FC Status /
  Staff Follow Up dropdowns (the existing `Discharged -- MCAF` / `Discharged - No MCAF`
  values are meant for this tab) and duplicate red-flagging.
- **No carry-forward:** fresh snapshot every run -- no comparison against a previous
  discharged list, no backlog logic.
- If no rows were discharged in a given run, `dischargedWs` is `Nothing` and no "Discharged"
  tab is created.

## Key differences from NCID

| Aspect | NCID | Inflight |
|--------|------|----------|
| Admission Type | Emergency + Elective Inpa | Emergency only |
| Ward filter method | Bed code allowlist (`Mid(bed,2,3)`) | Bed code prefix excludelist + NCID auto-tag |
| Ward filter values | 12 NCID ward codes | 10 prefix excludes; NCID wards kept & tagged |
| Discharged Missed FC | Kept (staff follow up) | Removed (all discharged deleted) |
| Output columns | 16 (A--P) | 15 (A--O) |
| Inflight FC Status values | 5 generic | 20 Inflight-specific |
| Discharge filter | Embedded in FilterFCStatus | Separate step (FilterDischarge.bas) |

## Inflight ward filter (Final Bed excludelist)

The macro filters on the **Final Bed** column (from Epic lookup). A row is **excluded** if:

1. Bed is blank or exactly `"NONE"`
2. Bed starts with any of these prefixes:
   `AUC, EDC, EDTC, EDX, EDXO, O14, O15, RES, TWAS, TWDS`

**All NCID building wards pass through**, not excluded. After the output is built and
backlog is processed, `TagAndGroupNCID` auto-tags rows whose `Mid(bed, 2, 3)` matches
a ward in "All NCID Wards" but NOT in "Included NCID Wards" with `Case Status = "NCID"`.

- **Included NCID Wards** (Config col E): Inflight-covered wards in the NCID building.
  Default: `08F`. These pass through untagged.
- **All NCID Wards** (Config col K): Every ward in the NCID building.
  Default: `03E, 05F, 06F, 07E, 07F, 08E, 08F, 09F, 11E, 11F, 12E, 14F`
  Wards here but NOT in col E are tagged NCID.

Both lists are Config-driven with hardcoded fallbacks.

## Inflight FC Status dropdown (20 values)

1. No Attempt
2. Attempted - Pending FC
3. FC Complete - CCF left with NOK
4. FC Complete - CCF signed
5. FC Completed @ ED
6. FC Declined @ ED
7. FC Declined @ Inflight
8. Discharged -- MCAF
9. Discharged - No MCAF
10. Uncontactable NOK with MCAF
11. Transfer to NCID/Renci
12. Planned Transfer
13. C Class with MediFund Activated
14. Nursing Home Case / No NOK
15. Deceased
16. Received unsigned CCF/FC/ReFC
17. Non-Inflight Case
18. Explained CCF but Declined FC form
19. LOG Template
20. Others (to indicate in Remarks)

## FC Status filter logic

**Delete** rows with these FC Status values:
- Completed
- Attempted-Unable to complete
- Acknowledge By Other Means
- Attempted-Virtual FC Completed, pending signature
- Attempted-Patient/NOK declines to sign

**Keep** rows where:
- `Missed FC = "Yes"` (always kept regardless of other status), OR
- FC Status is a Draft variant: `Draft`, `Draft (ETBS Generated)`, `Draft (CCF Generated)`

Uses `Encounter No` for `lastRow` because FC Status is blank in Missed FC rows.

## Architecture conventions (follow these)

- **Resolve columns by header, never by hardcoded index.** Use `FindColByHeader(ws, "Header Name")`
  (case-insensitive, whitespace/line-break tolerant via `NormHeader`). Input reports add/move
  columns over time; positional indexing breaks silently. This is the single most important
  invariant in the codebase.
- **Load--process--write in bulk.** Read a range into a `Variant` array once, do all logic in
  memory (arrays + `Scripting.Dictionary`), write back in one assignment. Epic is ~20,000 rows;
  per-cell COM access is far too slow.
- **No hardcoded file paths.** All file selection goes through `Application.FileDialog`.
- **One responsibility per module.** Keep orchestration in `MainMacro`.
- **`Option Explicit` in every module.**
- **Guard `FindColByHeader` returns.** Always check for 0 before using the column index.
- **No `IIf()` with array access.** `IIf()` is NOT short-circuit -- it evaluates both branches.
  Never write `IIf(col > 0, arr(i, col), "")`. Use explicit `If col > 0 Then` guards.
- **Use `Encounter No` for `lastRow`.** FC ID is blank in Missed FC rows.

## Input files

4 Excel files selected by the user through a file selection dashboard:

1. **EFC export WITHOUT Missed FC** -- main EFC file (has FC ID numbers)
2. **EFC export WITH Missed FC** -- missed FC file (no FC ID numbers)
3. **Epic Census Snapshot Report** -- patient bed and admission status
4. **Previous MFC daily list** -- for backlog tracking and carry-forward

## Config sheet layout (cols A--K)

The Config sheet is the single point of customization for non-technical staff. All
values have hardcoded fallback defaults in `ConfigReader.bas`, so the macro works
identically even without a Config sheet.

| Col | Header | Content |
|-----|--------|---------|
| A | Inflight FC Status | Dropdown values (20 items) |
| B | Staff Follow Up | Staff names for dropdown |
| C | Output Headers | 15 header names for output cols A--O |
| D | Excluded Bed Prefixes | Bed code prefixes to exclude (AUC, EDC, etc.) |
| E | Included NCID Wards | Inflight-covered wards in NCID building (default: 08F) |
| F | All NCID Wards | Every ward code in the NCID building (12 codes incl. 08F) |
| G | Case Status | Status dropdown values (paired with col H) |
| H | Case Status Color | Fill color per status as `R,G,B` |
| I | FC Status Keep Values | Draft variants to keep through the filter |
| J | Settings | Key names (see below) |
| K | (Values) | Values for col J keys |

Settings keys (col J--K):

| Key | Default | Purpose |
|-----|---------|---------|
| Filename Prefix | MFC | Output filename prefix |
| Sheet Name | MFC Report | Output sheet tab name |
| Font Name | Aptos Narrow | Table font |
| Font Size | 11 | Table font size |
| Header Color | 31,73,125 | Header row background (R,G,B) |
| Header Font Color | 255,255,255 | Header row font (R,G,B) |
| Border Color | 89,89,89 | Grid line color (R,G,B) |
| Duplicate Color | 255,0,0 | Duplicate row highlight (R,G,B) |
| Date Dropdown Days | 30 | Number of recent dates in date picker |

Run `CreateConfigSheet` (Alt+F8) to create or upgrade the Config sheet. If the Config
sheet exists but is missing the new columns (C--J), it adds them with defaults while
preserving existing Inflight FC Status and Staff Follow Up lists.

## Verifying changes (no CLI available)

You cannot run the macro from a terminal. To verify:

1. **Static checks you can do:** `grep` for dangling references to functions you removed,
   duplicate `Sub`/`Function` names, and confirm `.bas` <-> `MFC_All_Modules.txt` are in sync.
2. **Ask the user to compile:** in Excel press `Alt+F11`, then **Debug -> Compile VBAProject**.
3. **Ask the user to run** `GenerateMFCReport` (Alt+F8) with real input files and report the
   result or any popup.

## Domain reference

For full input file column structures, how each report is exported, Epic Census setup, and
the complete operational procedure, read:
- **`Inflight_Macro_Context.md`** -- full macro context and domain reference
- **`Inflight_VBA_Structure.md`** -- VBA architecture, module specs, column maps
- **`Inflight SW.txt`** -- official Standard Work document (staff operational procedure)

## Git / process

- **Only commit when the user explicitly asks.** Do not commit proactively.
- Keep commits focused; mention both the `.bas` change and the `MFC_All_Modules.txt` mirror.
- **After every change, output a summary listing each file edited and the exact lines/sections changed.**
