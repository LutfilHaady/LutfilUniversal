# Hours Worked — Cap at Scheduled Start + Hours/Minutes Preference — Design Spec

Date: 2026-07-06

## Purpose

`ReportBuilder.bas`'s `BuildDepartmentSheets`, `Case "NORMAL"` branch (currently around
line 246), computes `Hours Worked` as a raw `outT - inTime` delta. This over-counts
early arrivals: an employee scheduled 8:00-17:00 who punches in at 7:30 currently gets
9.5h credited instead of 9h. Late departures (punching out after the scheduled end)
should keep being credited in full — this is the desired behavior already and doesn't
change.

Separately, the team wants the choice of tracking these columns in decimal hours
(today's behavior) or whole minutes, as a report-wide setting rather than a fixed
format.

## Behavior change 1: cap at scheduled start

Within `Case "NORMAL"`:

- **Scheduled days** (`isSched = True`): clamp the clock-in time to the scheduled
  start before computing the delta:
  `effectiveIn = Application.WorksheetFunction.Max(inTime, schedStart)`
  Early arrival is dropped; time worked past `schedEnd` is untouched (no cap on the
  out side).
- **Unscheduled days** (`isSched = False`): leave `hrsWorked` as `Empty` (blank cell)
  instead of computing a raw delta. The department has no shift defined for that
  weekday, so the employee isn't considered to be working a countable shift at all —
  this mirrors how `Expected Hours` (`expHrs`) already stays blank for unscheduled
  days (line 252, `If isSched Then expHrs = ...`).

No other `Case` branches change — `MISSING_IN`, `MISSING_OUT`, `NOPUNCH`, and
unrecognized-format rows already leave `hrsWorked` as `Empty`.

## Behavior change 2: Hours/Minutes preference

A new Config sheet setting controls the unit for **both** `Hours Worked` and
`Expected Hours` (detail columns O/P and their summary-block counterparts):

- **New named range**: `Config!B4` = `HoursUnit`, a text cell holding `"Hours"` or
  `"Minutes"` — same pattern as the existing `GracePeriod` named range at `Config!B3`.
  This is a manual addition to `Attendance_Analyzer.xlsx` (the workbook isn't in this
  repo) — not a VBA change by itself, but `Helpers.LoadConfig` will read it.
- **`Helpers.bas`**: new `Public HoursUnitIsMinutes As Boolean`, set in `LoadConfig`:
  ```vba
  Dim hoursUnitRaw As String
  On Error Resume Next
  hoursUnitRaw = CStr(cfgWs.Range("HoursUnit").Value)
  On Error GoTo 0
  HoursUnitIsMinutes = (UCase(Trim(hoursUnitRaw)) = "MINUTES")
  ```
  If the named range doesn't exist yet (older Config sheet), `hoursUnitRaw` stays
  `""`, `HoursUnitIsMinutes` defaults to `False` — same behavior as today (decimal
  hours) — no error, no forced Config sheet migration.
- **`ReportBuilder.BuildDepartmentSheets`**, `Case "NORMAL"`:
  ```vba
  If HoursUnitIsMinutes Then
      hrsWorked = Round((outT - effectiveIn) * 1440, 0)   ' whole minutes
  Else
      hrsWorked = Round((outT - effectiveIn) * 24, 2)     ' decimal hours (today)
  End If
  ```
  Same branching applies to `expHrs` (`* 1440` rounded to 0 vs `* 24` rounded to 2),
  computed once per row when `isSched = True`, replacing the current unconditional
  `Round((schedEnd - schedStart) * 24, 2)` at line 252.
- **Column headers relabel dynamically** based on `HoursUnitIsMinutes`, both in
  `WriteDetailHeader` (columns O/P) and `FinalizeSheet`'s summary header array
  (columns AC/AD): `"Hours Worked"/"Expected Hours"` when `False`,
  `"Minutes Worked"/"Expected Minutes"` when `True`.
- **`FinalizeSheet`'s summary `SUMIFS` formulas** (columns 29/30) currently hardcode
  `ROUND(..., 2)`. Round to `0` when `HoursUnitIsMinutes`, `2` otherwise, so summed
  minute totals don't show decimal points.

## Out of scope

- No change to `Late (min)` / `Early (min)` columns (already minute-based, unaffected
  by this preference) or grace-period logic.
- No per-column mixed units — `Hours Worked` and `Expected Hours` always share the
  same unit, set by the one Config toggle.

## Files touched

- `Helpers.bas` — `HoursUnitIsMinutes`, `LoadConfig` read (source of truth)
- `ReportBuilder.bas` — `WriteDetailHeader`, `BuildDepartmentSheets`, `FinalizeSheet`
  (source of truth)
- `Attendance_All_Modules.txt` (regenerated via `./regen_modules.ps1` after source
  edits, per the dual-source maintenance convention in `CLAUDE.md`)
- `Attendance_Analyzer_Context.md` — document the new `HoursUnit` named range
  alongside the existing `GracePeriod` description
- Manual step (not in this repo): add `HoursUnit` named range to
  `Attendance_Analyzer.xlsx`'s `Config` sheet
