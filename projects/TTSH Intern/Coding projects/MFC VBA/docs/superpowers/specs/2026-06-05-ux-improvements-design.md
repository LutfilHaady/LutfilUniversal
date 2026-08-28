# MFC Report — UX Improvements

**Date:** 2026-06-05
**Status:** Draft (pending review)

## Background

Staff using the MFC report macro may not be deeply familiar with the internal
process. The current UX uses sequential file dialogs with no visual overview,
technical error messages, and a dense final summary popup. This spec covers
three improvements to make the macro friendlier for first-time and
occasional users.

Note on source files: every VBA module lives both as an individual `.bas` file
(working copy) and concatenated inside `MFC_All_Modules.txt` (the deliverable
staff copy into Excel). **Both must be kept in sync for every change.**

---

## Feature 1: File Selection Dashboard (UserForm)

Replace the 4 sequential file picker dialogs with a single UserForm that
shows all 4 file slots at once. Users can select files in any order and see
at a glance what is valid, invalid, or still missing.

### Current flow (sequential)

```
[File Dialog 1: EFC Main] → [File Dialog 2: EFC Missed] →
  row count guard → [File Dialog 3: Epic] → [File Dialog 4: Previous MFC]
```

If the user picks the wrong file at step 3, they must cancel, re-run the
macro, and re-pick files 1 and 2 again.

### New flow (dashboard)

```
 ┌──────────────────────────────────────────────────────┐
 │              MFC Report — Select Input Files          │
 ├──────────────────────────────────────────────────────┤
 │                                                      │
 │  EFC Report (without Missed FC)                      │
 │  [Browse...]   report_05062026.xlsx          ✓ Valid  │
 │                                                      │
 │  EFC Report (with Missed FC)                         │
 │  [Browse...]   report_missed_05062026.xlsx   ✓ Valid  │
 │                                                      │
 │  Epic Census Report                                  │
 │  [Browse...]   (not selected)                ○        │
 │                                                      │
 │  Previous MFC Report                                 │
 │  [Browse...]   MFC 04.06.2026.xlsx           ✓ Valid  │
 │                                                      │
 ├──────────────────────────────────────────────────────┤
 │                    [Generate Report]  (disabled)      │
 │                    [Cancel]                           │
 └──────────────────────────────────────────────────────┘
```

### Behaviour

- 4 rows, each with: a label, a `[Browse]` button, a filename label (initially
  `(not selected)`), and a status indicator (`✓ Valid`, `✗ Invalid`, `○`).
- Clicking `[Browse]` opens a standard file picker. The UserForm stays open.
- On file selection, the macro immediately validates the file headers using the
  existing `ValidateFileHeaders` function. The status updates to `✓ Valid`
  (green) or `✗ Invalid` (red).
- If `✗ Invalid`, the user can re-click `[Browse]` on that same slot to pick
  a different file. The previous file is closed.
- Duplicate file guard: if the user selects the same file for both EFC slots,
  the second slot shows `✗ Same file as EFC Main`.
- Row count guard: if both EFC files are valid, the form checks for suspicious
  row counts (same count, or missed > main). If triggered, a small warning
  label appears between the two EFC rows:
  `⚠ Both files have the same row count — verify they are different exports.`
  This is a non-blocking warning; the user can still proceed.
- `[Generate Report]` button is enabled only when all 4 slots show `✓ Valid`.
- `[Cancel]` closes any opened workbooks and exits.
- Each `[Browse]` dialog remembers the folder from the last file picker in the
  same session (using `Application.FileDialog.InitialFileName`).

### Implementation

#### [NEW] FilePickerForm.frm

New VBA UserForm with the following controls:

| Control | Type | Name | Purpose |
|---------|------|------|---------|
| Label | Label | lblEFCMain | "EFC Report (without Missed FC)" |
| Button | CommandButton | btnEFCMain | Opens file picker for EFC main |
| Label | Label | lblEFCMainFile | Shows selected filename |
| Label | Label | lblEFCMainStatus | Shows ✓/✗/○ status |
| Label | Label | lblEFCMissed | "EFC Report (with Missed FC)" |
| Button | CommandButton | btnEFCMissed | Opens file picker for EFC missed |
| Label | Label | lblEFCMissedFile | Shows selected filename |
| Label | Label | lblEFCMissedStatus | Shows ✓/✗/○ status |
| Label | Label | lblWarning | Row count / duplicate warning (hidden by default) |
| Label | Label | lblEpic | "Epic Census Report" |
| Button | CommandButton | btnEpic | Opens file picker for Epic |
| Label | Label | lblEpicFile | Shows selected filename |
| Label | Label | lblEpicStatus | Shows ✓/✗/○ status |
| Label | Label | lblPrev | "Previous MFC Report" |
| Button | CommandButton | btnPrev | Opens file picker for previous MFC |
| Label | Label | lblPrevFile | Shows selected filename |
| Label | Label | lblPrevStatus | Shows ✓/✗/○ status |
| Button | CommandButton | btnGenerate | "Generate Report" (disabled initially) |
| Button | CommandButton | btnCancel | "Cancel" |

Module-level variables store the 4 opened Workbooks. Each Browse button calls
a shared `SelectFile` helper that:
1. Opens a file dialog (seeded to `lastFolderPath` if set).
2. If the slot already had a file, closes it.
3. Opens the new workbook, validates headers, updates status label.
4. Sets `lastFolderPath` to the folder of the file just selected.
5. Calls `CheckAllValid` to enable/disable the Generate button.

The `btnGenerate_Click` handler hides the form and sets a module-level
`Cancelled = False` flag. The `btnCancel_Click` handler closes all opened
workbooks and sets `Cancelled = True`.

#### [MODIFY] MainMacro.bas

Replace lines 31–82 (the 4 sequential `PickAndValidateFile` calls and the
row-count / duplicate guards) with:

```vba
    ' --- Step 1: Select input files via dashboard ---
    Application.StatusBar = "Step 1/9: Select input files..."
    Dim picker As New FilePickerForm
    picker.Show vbModal

    If picker.Cancelled Then GoTo Cleanup

    Set wbMain   = picker.SelectedMain
    Set wbMissed = picker.SelectedMissed
    Set wbEpic   = picker.SelectedEpic
    Set wbPrev   = picker.SelectedPrev
```

All guards (duplicate file, row count similarity) move into the UserForm logic
so the user sees the warning immediately, not after selecting all 4 files.

#### [MODIFY] Helpers.bas

`PickFile` and `PickAndValidateFile` remain as-is (they are still useful for
any future single-file-pick use case), but `GenerateMFCReport` no longer calls
them directly.

#### [MODIFY] MFC_All_Modules.txt

Sync with all changes above. The UserForm `.frm` code is included as a new
module section.

---

## Feature 2: Cleaner Error Messages

Replace internal/technical error messages with short, action-oriented text
that tells the user what went wrong and what to do. Keep messages to 1–2 lines.

### Message changes

| Module | Current message | New message |
|--------|----------------|-------------|
| FilterRows | `FilterFCStatus: 'FC Status' column not found.` | `Error: EFC file is missing the 'FC Status' column. Check your EFC export.` |
| FilterRows | `FilterFCStatus: No rows matched the Draft FC Status or Missed FC filter.` | `No active cases found. All rows were filtered out — check your EFC date range.` |
| FilterRows | `FilterFCStatus: Error {N} - {desc}` | `Unexpected error during FC Status filter: {desc} (code {N})` |
| FilterRows | `FilterBedCode: 'Bed Point Of Care' column not found.` | `Error: 'Bed Point Of Care' column missing. The Epic lookup may have failed.` |
| FilterRows | `FilterBedCode: No rows matched the NCID ward filter.` | `No NCID ward matches found. Check the Epic Census Report date.` |
| FilterRows | `FilterBedCode: Error {N} - {desc}` | `Unexpected error during bed filter: {desc} (code {N})` |
| ExtractDate | `ExtractAdmissionDate: 'Admission Date' column not found in EFC report.` | `Error: EFC file is missing 'Admission Date'. Check your EFC export.` |
| EpicLookup | `LookupEpicData: Required column not found in Epic report. Missing: ...` | `Error: Epic file is missing required columns: {list}. Check your Epic export.` |
| EpicLookup | `LookupEpicData: Required column not found in EFC report. Missing: ...` | `Error: EFC file is missing columns needed for Epic lookup: {list}` |
| FlagDuplicates | `FlagDuplicateRows: Required column not found in working sheet. Missing: ...` | `Error: Missing columns for duplicate check: {list}` |
| BuildOutput | `BuildMFCOutput: No data rows found in working sheet.` | `No data to output — all rows were filtered out.` |
| BuildOutput | `BuildMFCOutput: Required column not found in working sheet. ...` | `Error: Output cannot be built — missing columns: {list}` |
| BuildOutput | `BacklogSummary: 'Encounter Number' column not found...` | `Previous report missing 'Encounter Number'. All cases treated as new.` |
| BuildOutput | `AddDropdowns: 'Config' sheet not found...` | `Config sheet not found. Run 'CreateConfigSheet' first (Alt+F8).` |
| BuildOutput | `AddDropdowns: Both dropdown lists...empty.` | `Config sheet lists are empty. Add values under Config tab.` |
| BuildOutput | `This file is already open and cannot be overwritten...` | `Cannot save — file is open. Close it and click Retry, or click Cancel to save a copy.` |
| Helpers | `No file selected. Macro will exit.` | `No file selected — macro cancelled.` |
| Helpers | `The selected file ... does not match the expected structure for: ...` | `Wrong file selected for {desc}. Please pick the correct file.` |

### Implementation

Each message is a simple string replacement in the `MsgBox` call. No logic
changes. The title bar text of each MsgBox also simplified:

- `"Column Not Found"` → `"Missing Column"`
- `"No Matches"` → `"No Data"`
- `"Invalid File Structure"` → `"Wrong File"`

### Files to change

- `FilterRows.bas` — 6 MsgBox calls
- `ExtractDate.bas` — 1 MsgBox call
- `EpicLookup.bas` — 2 MsgBox calls
- `FlagDuplicates.bas` — 1 MsgBox call
- `BuildOutput.bas` — 5 MsgBox calls
- `Helpers.bas` — 2 MsgBox calls
- `MFC_All_Modules.txt` — sync all of the above

---

## Feature 3: Improved Final Success MsgBox

Update the completion popup to include a short post-run checklist so users
know exactly what manual steps remain.

### Current message

```
MFC Report generated successfully!

Total Cases     : 42
Backlog         : 12
Today's Cases   : 30

To Follow Up on CCF and EL Admissions are entered manually
in the summary table.

Saved to:
C:\...\MFC 05.06.2026 TO 05.05.2026.xlsx
```

### New message

```
MFC Report generated successfully!

Total Cases   : 42
Backlog       : 12
Today's Cases : 30

Next Steps:
1. Check RED rows — review and delete duplicates
2. Fill YELLOW cells — enter CCF and EL counts in the summary table
```

### Implementation

#### [MODIFY] MainMacro.bas

Replace the final MsgBox (lines 146–153) with the updated text. Drop the
`Saved to:` line (the file is already open and visible). Drop the wordy
explanation of manual fields in favour of the numbered checklist.

#### [MODIFY] MFC_All_Modules.txt

Sync the same MsgBox change.

---

## Files to change

| # | File | Changes |
|---|------|---------|
| 1 | `[NEW] FilePickerForm.frm` | File selection dashboard UserForm |
| 2 | `MainMacro.bas` | Replace file selection with UserForm call; update final MsgBox |
| 3 | `Helpers.bas` | Simplify 2 error messages |
| 4 | `FilterRows.bas` | Simplify 6 error messages |
| 5 | `ExtractDate.bas` | Simplify 1 error message |
| 6 | `EpicLookup.bas` | Simplify 2 error messages |
| 7 | `FlagDuplicates.bas` | Simplify 1 error message |
| 8 | `BuildOutput.bas` | Simplify 5 error messages |
| 9 | `MFC_All_Modules.txt` | Sync all changes above |
| 10 | `docs/MFC_Macro_Context.md` | Update Step 1 description and error message examples |

## Out of scope

- Changing the processing logic (filter, lookup, output column order).
- Adding new data columns or changing the output structure.
- Automated testing (no VBA test harness exists).

## Verification

Manual testing in Excel:
- UserForm displays correctly, all 4 Browse buttons work.
- Selecting wrong file type shows `✗ Invalid`; selecting correct shows `✓ Valid`.
- Generate button disabled until all 4 are valid.
- Cancel closes all opened files cleanly.
- Duplicate / row-count warnings display correctly in the form.
- All error messages throughout the macro are shorter and actionable.
- Final MsgBox shows the numbered checklist.
- Full end-to-end run produces the same output as before.
