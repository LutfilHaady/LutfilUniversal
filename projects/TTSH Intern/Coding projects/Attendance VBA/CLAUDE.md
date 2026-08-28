# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Excel VBA macro that converts a ZKBio CVAccess "Monthly Punch List" export into a per-department
attendance report (late/early flags, missing punches, hours worked vs expected). Built for the
TTSH ICH PSO team as a monthly manual-run tool (Alt+F8), not an application with a build/test
pipeline — there is no compiler, package manager, or automated test suite in this repo. See
`Attendance_Analyzer_Context.md` for the full functional spec (input format, classification
rules, output layout, and known limitations) — read it before making behavior changes, since it
documents decisions already made with the user (e.g. why `[-]` days are flagged for manual
verification instead of auto-classified).

**Status: untested in live Excel.** Logic was ported to Python and validated against a real punch
export, but the VBA itself has never been run. Treat first-run failures as expected debugging,
not evidence of a deeper design problem.

## Working with this codebase

There's no build step — "compiling" means importing the 4 `.bas` files and 2 UserForms into the VBA editor inside
`Attendance_Analyzer.xlsx` and running Debug → Compile VBAProject to catch syntax errors. There's
no headless test runner; verification means running `GenerateAttendanceReport` (in `MainMacro.bas`)
against a real Monthly Punch List export and inspecting the output workbook by eye (row colors,
summary formulas, Unmapped sheet). `Attendance_All_Modules.txt` is the paste-ready deliverable — a concatenation of all
6 `.bas`/UserForm files, regenerated via `regen_modules.ps1` after any source edit.
Edit the individual `.bas` files, never the `.txt` directly, then re-run the script.

When changing classification or parsing logic, follow the testing checklist and "honest weak
points" section at the bottom of `Attendance_Analyzer_Context.md` rather than re-deriving test
priorities from scratch.

## Dual-source maintenance

The code exists in two places that must be kept in sync:

1. The individual `.bas`/UserForm files in the repo root (the dev source).
2. `Attendance_All_Modules.txt` — the concatenated deliverable pasted into Excel's
   VBA editor.

**Every code change must be applied to the `.bas` file, then `Attendance_All_Modules.txt`
regenerated via `./regen_modules.ps1`.** Keep the `.txt` in clean ASCII (`--` for dashes,
`ChrW(...)` for status glyphs in UserForm code, no smart quotes).

## Architecture

Four .bas modules plus two UserForms, single execution path, no classes:

- **`MainMacro.bas`** — `GenerateAttendanceReport`, the only entry point (Alt+F8). Shows
  `FilePickerForm.ShowFilePicker()` to select and validate the source file, then runs a 4-step
  pipeline behind `ProgressForm`: load Config sheet → parse date headers → build department
  sheets → finalize and save output as `Attendance_Report_<YYYY>_<MM>.xlsx` next to
  `ThisWorkbook`. All steps run inside one `On Error GoTo ErrHandler` so a mid-run failure still
  restores `Application.ScreenUpdating`, closes `ProgressForm` (guarded by a `progressShown` flag
  so it's never closed if it was never shown), and closes the source workbook.
- **`Helpers.bas`** — Config sheet access and pure classification logic. `LoadConfig` reads the
  `Config` sheet's Excel Tables (`tblSchedule`, `tblVerification`) and the `GracePeriod` named
  range into an in-memory `Scripting.Dictionary` keyed `"DEPT|WEEKDAY"` (see `BuildScheduleKey`) —
  this dictionary is the single source of truth for whether a department/weekday is scheduled and
  what the shift times are, consulted throughout `ReportBuilder`. `LoadConfig` also reads the
  `HoursUnit` named range (`Config!B4`) into module-level `HoursUnitIsMinutes`, which controls
  whether hours-worked columns report decimal hours or whole minutes. `ClassifyInStatus`/
  `ClassifyOutStatus` apply the grace-period rule (`Config!B3`, named range `GracePeriod`) to
  produce On Time / Within Grace / Late (or Early Leave). `LoadRoster` separately discovers every
  `tblRoster_<Unit>` table on the `Roster` sheet plus `tblRosterCodes` on `Config`, building the
  name/day-of-month → leave-code lookup that `ReportBuilder` uses to auto-resolve `[-]` days.
- **`PunchParser.bas`** — Two independent parsers: `ParsePunchCell` decodes one raw punch-cell
  string into a status code (`NORMAL`/`NOPUNCH`/`MISSING_IN`/`MISSING_OUT`/`BLANK`/`UNKNOWN`) plus
  in/out `Double` times; `ParseDayHeaders` reads row 2 (dates) / row 3 (weekday names) of the raw
  export starting at column E and returns only columns with a valid date, so it self-adjusts to
  28/29/30/31-day months. Punch-cell formats are documented at the top of the file and in the
  context doc — don't add new formats without checking the raw export first.
- **`ReportBuilder.bas`** — The bulk of the logic. `BuildDepartmentSheets` is the main per-employee/
  per-day double loop: for each raw data row (starting row 4) it looks up whether the row's
  department has any schedule entries (`Helpers.DeptHasScheduleRows`); if yes, rows are routed to a
  per-department output sheet (created lazily, one per distinct department name, sheet name
  truncated to 31 chars); if no, rows go to a shared "Unmapped" sheet instead of being dropped.
  Per-department state (current output row, unique-employee collection) is tracked via three
  parallel `Scripting.Dictionary` objects keyed by department name. `FinalizeSheet` then adds the
  Verification data-validation dropdown and appends a summary block starting at column U, built
  entirely from live `COUNTIFS`/`SUMIFS` formulas (not computed values) keyed off each employee's
  ID, so the summary stays correct if a manager edits a Verification tag by hand afterward.
  `ApplyRowColor` maps `Clock-In Status` to a fill color for quick visual scanning — including a
  distinct light blue for `NO PUNCH - ROSTER: <code>` rows (roster-confirmed), separate from the
  purple used for unresolved `NO PUNCH - VERIFY` rows.
- **`FilePickerForm.bas`** (UserForm) — single-slot file picker for the Monthly Punch
  List export. `ShowFilePicker()` shows the form modally and returns whether the user
  clicked Generate vs. Cancel; the selected workbook is exposed via `SelectedSrc`.
  Validity is gated by `Helpers.ValidatePunchListFile`, a structural check (valid date
  columns in row 2 + at least one data row) since this file has no header row to scan.
- **`ProgressForm.bas`** (UserForm) — modeless progress bar shown during the pipeline.
  `ShowProgress`/`Update`/`CloseProgress`; forces a repaint via `Me.Repaint` + `DoEvents`
  since the macro runs with `ScreenUpdating = False`.

## Data flow

`Attendance_Analyzer.xlsx` (`Config` sheet: `tblSchedule`, `tblVerification`, `tblRosterCodes`,
`GracePeriod`/`HoursUnit` named ranges; `Roster` sheet: one `tblRoster_<Unit>` table per
department) + a raw Monthly Punch List export → `GenerateAttendanceReport` → new output workbook,
one sheet per mapped department plus "Unmapped", columns A–R per-punch detail and columns U+
per-employee summary. Config/Roster changes (shift times, grace period, hours unit, verification
dropdown options, roster codes) require no VBA changes — only editing the `Config`/`Roster` sheet
tables.

## Key invariants to preserve

- A department absent from `tblSchedule` must route to "Unmapped", never be silently dropped or
  guessed at (`Helpers.DeptHasScheduleRows` is the gate for this).
- Blank punch cell = not scheduled that day, and is not flagged as an error — this was verified
  against real roster data (see context doc).
- `[-]` ("no punch captured") is never *guessed* at — it's always `NO PUNCH - VERIFY`, left to
  the manual Verification dropdown, unless the unit's own Roster sheet data (`tblRoster_*` +
  `tblRosterCodes`) confirms a leave code for that name/day-of-month. A confirmed roster match
  is real data, not a guess, so it's allowed to change `Clock-In Status` to
  `NO PUNCH - ROSTER: <code>` (and the row color from purple to light blue) — see
  `ReportBuilder.bas`, `Case "NOPUNCH"`. Don't add heuristics beyond an exact roster-code match;
  auto-classifying without roster confirmation was rejected as guessing.
- Summary block values must stay formulas (`COUNTIFS`/`SUMIFS`), not hardcoded numbers, so they
  recalculate after manual Verification edits.
