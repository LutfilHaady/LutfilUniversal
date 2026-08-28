# File Picker + Progress Bar — Design Spec

Date: 2026-07-03

## Purpose

Replace `MainMacro.bas`'s current `Application.GetOpenFilename` (plain OS dialog) and
`Application.StatusBar` text updates with a UserForm-based file picker and a modeless
progress bar, reusing the UI/validation scaffolding already proven in the MFC Inflight
project (`../MFC VBA Inflight/FilePickerForm.bas`, `ProgressForm.bas`, and the
`ValidateFileHeaders`/`FindColByHeader`/`NormHeader` pattern in its `Helpers.bas`).

This is a UI/UX change only — no changes to classification logic, punch parsing, or
report-building behavior in `PunchParser.bas` / `ReportBuilder.bas`.

## Why this differs from the MFC source pattern

The MFC picker is a 4-slot dashboard because MFC's macro needs 4 separate input files
(2 EFC exports, an Epic Census export, a previous MFC report). Attendance only has
**one** input file — the raw Monthly Punch List export — because the Config
(schedule/verification/grace period) already lives inside `ThisWorkbook`, not a
separate file. So:

- The picker form needs **one row/slot**, not four.
- There are no cross-slot warnings (duplicate-file conflict, row-count mismatch) —
  those only make sense when comparing two files against each other.
- MFC's header-based validation (`ValidateFileHeaders` scanning row 1 for named
  columns) doesn't apply: the punch list's row 1 is a title, row 2 is dates, row 3 is
  weekday names, row 4+ is positional data (columns A–D have no header labels at all).
  Validation must be structural instead (see below).

## Components

### 1. `FilePickerForm.bas` (new UserForm)

- `Public Function ShowFilePicker() As Boolean` — resets state, `Me.Show vbModal`,
  returns `Not Cancelled`.
- `Public SelectedSrc As Workbook`, `Public Cancelled As Boolean`.
- One row: bold label "Monthly Punch List Export", "Browse..." button, filename label
  (default "(not selected)"), status glyph label ("○" / "✓ Valid" / "✗ Invalid").
- `UserForm_Initialize` builds all controls via `CreateLabel`/`CreateButton` helpers
  (copied verbatim from the MFC source, same signatures).
- Browse handler opens `Application.FileDialog(msoFileDialogFilePicker)` filtered to
  `*.xlsx; *.xlsm; *.xls`, remembers `m_lastFolder`, seeds `fd.InitialFileName`, calls
  `AppActivate Me.Caption` after the dialog closes.
- Opens the picked file with `Workbooks.Open(filePath, ReadOnly:=True)` — preserves the
  `ReadOnly:=True` invariant already present in the current `MainMacro.bas` (the raw
  export must never be written to). This is the one deliberate deviation from the MFC
  source, which opens without `ReadOnly` — attendance's CLAUDE.md doesn't mandate it,
  but the existing code already does it, so the picker preserves that behavior rather
  than silently dropping it.
- Runs `Helpers.ValidatePunchListFile(wb)` on selection, sets the status glyph/color,
  enables the "Generate Report" button only when valid (no cross-slot state to
  recompute, so this is a direct set rather than MFC's
  `UpdateValidationStatus`-recomputes-everything pattern — there's nothing to
  recompute with only one slot).
- Single-slot equivalent of MFC's `CloseSlotWorkbook`: since there's only one slot,
  re-picking a file just closes the previous `SelectedSrc` before opening the new one
  (no shared-instance-across-slots edge case is possible with one slot).
- "Generate Report" button (disabled until valid) sets `Cancelled = False`, hides form.
- "Cancel" button sets `Cancelled = True`, closes `SelectedSrc` if open, hides form.
- `UserForm_QueryClose` blocks the native X button, routing to the Cancel handler,
  matching the MFC source.

### 2. `ProgressForm.bas` (new UserForm)

Copied near-verbatim from the MFC source — this component is fully domain-agnostic.
Only the caption text changes: `"Attendance Report — Generating"`. Same
`ShowProgress(totalSteps)` / `Update(stepNum, message)` / `CloseProgress()` API, same
lazy/idempotent `BuildControls`, same `Me.Repaint` + `DoEvents` on update, same
`UserForm_QueryClose` X-button block.

### 3. `Helpers.bas` — `ValidatePunchListFile` (new function)

```
Public Function ValidatePunchListFile(wb As Workbook) As Boolean
```

Structural validator, single check gating the picker's ✓/✗ glyph:

1. Calls `PunchParser.ParseDayHeaders` on `wb.Sheets(1)`, wrapped in
   `On Error Resume Next` — that function already raises `vbObjectError + 1` when row 2
   has no valid date columns starting at column E; the validator catches that and
   returns `False` instead of letting the error propagate to the picker form.
2. Additionally checks `wb.Sheets(1).Cells(4, 1).Value <> ""` — at least one data row
   with a non-blank Personnel ID in column A.
3. Returns `True` only if both checks pass.

This reuses `ParseDayHeaders`'s existing self-adjusting date-column logic rather than
duplicating it, so the 28/29/30/31-day-month handling stays in one place.

### 4. `MainMacro.bas` changes

Current 6-step flow collapses to a picker step + 4 progress-bar steps:

| Old step | New home |
|---|---|
| 1. Select raw file | `FilePickerForm.ShowFilePicker()` (before progress bar starts) |
| 2. Load configuration | Progress step 1: "Loading configuration..." |
| 3. Open raw punch data | Folded into the picker (`Workbooks.Open` happens on Browse) |
| 4. Parse date headers | Progress step 2: "Parsing date headers..." |
| 5. Classify + build report | Progress step 3: "Classifying attendance and building department sheets..." |
| 6. Finalize | Progress step 4: "Finalizing and saving report..." |

Flow:

```
If Not FilePickerForm.ShowFilePicker() Then Exit Sub   ' user cancelled, no MsgBox needed
                                                         ' (picker's own Cancel already closed the file)
Set srcWb = FilePickerForm.SelectedSrc
Set srcWs = srcWb.Sheets(1)

ProgressForm.ShowProgress 4
ProgressForm.Update 1, "Loading configuration..."
... LoadConfig ...
ProgressForm.Update 2, "Parsing date headers..."
... ParseDayHeaders ...
ProgressForm.Update 3, "Classifying attendance and building department sheets..."
... BuildDepartmentSheets ...
ProgressForm.Update 4, "Finalizing and saving report..."
... finalize / SaveAs ...
ProgressForm.CloseProgress
MsgBox "Attendance report generated..." ...
```

`ErrHandler` gains `On Error Resume Next: ProgressForm.CloseProgress: On Error GoTo 0`
before its existing cleanup, so a mid-run failure never leaves the modeless progress
window stuck open (mirrors the existing pattern of always restoring
`ScreenUpdating`/`StatusBar` on error).

`Application.ScreenUpdating = False` stays in effect during the pipeline exactly as
today — `ProgressForm.Update`'s `Me.Repaint` + `DoEvents` is what makes the bar visibly
redraw despite that, same mechanism as the MFC source.

## Deliverable structure

- Add `Attendance_All_Modules.txt` — concatenation of `MainMacro.bas`, `Helpers.bas`,
  `PunchParser.bas`, `ReportBuilder.bas`, `FilePickerForm.bas`, `ProgressForm.bas`, each
  separated by a `MODULE: <name>` banner (same format as MFC's `_All_Modules.txt`).
- Add `regen_modules.ps1` — rebuilds the `.txt` from the `.bas` files on demand (adapted
  from `MFC VBA/regen_modules.ps1`; no line-number sync-check script needed since there's
  no "modified subset" to diff — just regenerate the whole thing each time).
- Each UserForm `.bas` file gets the same "IMPORT NOTE" header block used in the MFC
  source (VERSION/Begin/Attribute lines + instructions to Insert > UserForm, set
  `(Name)`, paste from `Option Explicit` down).
- **Retire `files.zip`** — delete it. `Attendance_All_Modules.txt` + `regen_modules.ps1`
  become the sole paste-ready deliverable convention. `Attendance_Analyzer.xlsx` is
  unaffected (it's the template workbook, not part of the module-sync mechanism).
- Update `CLAUDE.md`:
  - Add a "dual-source maintenance" section (matching MFC Inflight's wording): every
    code change must land in both the `.bas` file and `Attendance_All_Modules.txt`;
    after editing, confirm the two are in sync.
  - Document `FilePickerForm.bas`, `ProgressForm.bas`, and `Helpers.ValidatePunchListFile`
    in the Architecture section.
  - Remove the now-stale reference to `files.zip` as a duplicate delivery bundle.

## Testing / verification

No CLI or test runner exists for this project (per CLAUDE.md). Verification is manual:

1. Import `FilePickerForm.bas`/`ProgressForm.bas` as UserForms (per their IMPORT NOTE
   blocks) and the updated `.bas` modules; Debug → Compile VBAProject to catch syntax
   errors.
2. Run `GenerateAttendanceReport` (Alt+F8):
   - Cancel on the picker with no file selected → macro exits cleanly, no error.
   - Pick a non-Monthly-Punch-List file (e.g. an unrelated xlsx) → status glyph shows
     "✗ Invalid", Generate button stays disabled.
   - Pick a real Monthly Punch List export → status glyph shows "✓ Valid", Generate
     enables, click it → progress bar shows all 4 steps and visibly redraws, report
     generates as before.
   - Trigger a mid-run error (e.g. corrupt Config sheet) → confirm the progress window
     closes rather than being left stuck open.
3. Confirm `Attendance_All_Modules.txt` matches the `.bas` files after every edit
   (`regen_modules.ps1`).

## Out of scope

- No changes to classification rules, punch parsing, schedule matching, or the
  output/summary layout.
- No changes to the Config sheet structure.
- Not adding a "recent files" list or multi-file batch mode — single file, single run,
  matching current behavior.
