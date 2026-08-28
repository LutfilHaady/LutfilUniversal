# Attendance Analyzer — Context for Claude Code

## Purpose
Monthly macro tool for TTSH ICH PSO team. Managers export a "Monthly Punch List" report
from the ZKBio CVAccess attendance system, run a macro against it, and get back an Excel
workbook with attendance flagged by department (late, missing punches, no-punch days that
need manual verification, hours worked vs expected).

## Ideal state / target use case (user's vision, confirmed 2026-07-08)
The ZKBio CVAccess biometric scanner is used by **everyone in TTSH**, so the end goal is a
tool **any TTSH department can adopt** — potentially the user's most-used and most important
project — not just ICH PSO. See
`docs/superpowers/specs/2026-07-08-ttsh-wide-adoption-design.md` for the approved design.
The pillars:

1. **Verbatim copy-paste config, never transcription.** The punchlist format is stable
   across departments; only names and department strings vary. Managers paste those strings
   verbatim from their own punchlist into Config/Roster, so exact-match joins can't fail.
   The person join key is the punchlist's single name column (col B) — the Last Name column
   is always empty in real exports.
2. **Maximum Config-sheet flexibility, zero VBA for managers.** Everything a department
   needs to tune (schedules, grace period, hours unit, verification options, roster codes)
   lives in editable Config tables. Pre-provisioned blank department slots (generic
   `tblRoster_DeptN` tables with the department name typed *inside* the table, blank
   schedule rows) mean managers never create, rename, or resize an Excel Table — but
   nothing so dynamic that the code becomes undebuggable.
3. **Roster paste tolerance.** Managers paste their whole roster grid verbatim — colours,
   fonts, and stray rows are inert (loader reads values only); unknown codes are reported
   in end-of-run warnings, never silently dropped.
4. **Pre-run validation.** Before building sheets, the run reports punchlist names missing
   from the roster, departments missing from `tblSchedule`, and stale roster names — silent
   mismatch is impossible.
5. **Per-department distribution.** Each department's export contains only its own people,
   so each department gets its own configured copy of the `.xlsm`, cloned from a master
   template the user maintains. No shared workbook.
6. **Output = overview + depth.** One output workbook per run: an Overview landing sheet
   (headline numbers per unit, hyperlinks to detail) plus the existing per-department
   day-by-day sheets with per-employee summary blocks. Weekday/date matching stays derived
   automatically from the punchlist headers (`ParseDayHeaders`).

**This has NOT been run in live Excel/VBA.** It was written and logic-checked by porting the
same rules to Python and running them against a real punch export, but the VBA itself is
untested. Treat first-run debugging as expected, not a sign something is fundamentally wrong.

## Files in this delivery
- `Attendance_Analyzer.xlsx` — template workbook. Has a `Config` sheet (Excel Tables `tblSchedule`,
  `tblVerification`, `tblRosterCodes`; named ranges `GracePeriod` = Config!B3 and `HoursUnit` =
  Config!B4), a `Roster` sheet (one `tblRoster_<Unit>` table per department), and an `Instructions`
  sheet. Needs the 4 `.bas` modules and 2 UserForms imported via VBA editor, then Save As `.xlsm`.
- `Helpers.bas` — LoadConfig, LoadRoster, FindColByHeader, BuildScheduleKey,
  ClassifyInStatus/ClassifyOutStatus, ValidatePunchListFile.
- `PunchParser.bas` — ParsePunchCell (decodes raw punch text), ParseDayHeaders (reads date columns).
- `ReportBuilder.bas` — WriteDetailHeader, ApplyRowColor, FinalizeSheet (summary block + dropdown),
  BuildDepartmentSheets (main per-row/per-day loop).
- `MainMacro.bas` — `GenerateAttendanceReport`, the Alt+F8 entry point.
- `FilePickerForm.bas` (UserForm) — single-slot file picker for the Monthly Punch List export.
- `ProgressForm.bas` (UserForm) — modeless progress bar shown during the pipeline.

## Raw input format (Monthly Punch List export)
Single sheet. Row 1 = title. Row 2 = dates (one column per day of the month, starting col E).
Row 3 = weekday names. Row 4+ = one row per employee: ID, First Name, Last Name, Department,
then one cell per day.

Punch cell formats (confirmed by parsing the actual June 2026 export, 571 non-blank cells,
zero unrecognized):
| Raw text | Meaning |
|---|---|
| `07:47-17:00` | Normal — clock-in and clock-out both captured |
| *(blank)* | Not scheduled to work that day — verified against real rosters (PSO never has Saturday data; INFLIGHT's rotating Saturday off-weeks are blank too, not `[-]`) |
| `[-]` | Scheduled to work, **zero punches captured** — could be forgot to punch, approved leave, MC, or genuine absence. The raw export cannot distinguish these. |
| `09:27-]` | Clocked in, never clocked out |
| `[-17:01` | Never clocked in, clocked out |

Departments in the raw file: PSO, INFLIGHT, and `ADMISSION OFFICE(TTSH)` (all three have real
data and a matching `tblSchedule` entry — note `tblSchedule`'s Department column must read
`ADMISSION OFFICE(TTSH)` exactly, not `Admissions Office`, since matching is exact string
comparison, not fuzzy), plus TTSH, EDFC (blank placeholder rows, no punch data — not in
Config, will land on the "Unmapped" sheet if ever populated).

## Known limitation, partially addressed via the Roster sheet (see below)
The system's Leave module and Appended Log (manual supplementary punch) are what actually
distinguish "on approved leave" from "forgot to punch" from "no-show" — none of that is in
the raw punch export itself. **No Leave/Appended Log export from ZKBio CVAccess is
available.** However, units already maintain their own leave/duty roster by hand, so as of
2026-07-07 a `[-]` day can be auto-resolved against that roster instead: see "Roster
sheet / tblRoster" below and `docs/superpowers/specs/2026-07-07-roster-leave-ingestion-design.md`
for the full design. A `[-]` day with no matching roster entry (or a department that hasn't
set up a Roster sheet at all) still gets `NO PUNCH - VERIFY` (purple) with a manual dropdown
column (Verification, col Q) exactly as before. A `[-]` day the roster *does* confirm gets
`Clock-In Status` = `NO PUNCH - ROSTER: <code>` (e.g. `NO PUNCH - ROSTER: AL`), row color light
blue instead of purple, and the Verification column pre-filled with that code — auto-resolution
only ever happens when the manager's own roster data confirms it, never as a guess.

## Lateness/early-leave rules (confirmed with user)
- Grace period: 10 minutes, stored in `Config!B3` (named range `GracePeriod`), applies
  symmetrically to both late clock-in and early clock-out.
- Hours-tracking unit: `Config!B4` (named range `HoursUnit`), text value `"Hours"` (default)
  or `"Minutes"`. Controls both `Hours Worked`/`Expected Hours` (decimal, e.g. `9.42`) vs
  `Minutes Worked`/`Expected Minutes` (whole numbers, e.g. `565`) — column headers relabel
  to match. `Hours Worked` is capped at the scheduled start time: arriving early earns no
  extra credit, but time worked past the scheduled end is still counted in full.
- Three-tier classification per side: On Time / Within Grace / Late (or Early Leave).
- Schedules (in `Config` → `tblSchedule`, one row per Department × Weekday, editable without
  touching VBA):
  - PSO: Mon–Thu 07:50–17:15, Fri 07:50–17:10, no Saturday/Sunday.
  - INFLIGHT: Mon–Fri 08:15–17:00, Sat 08:00–15:00, no Sunday.
- A department not present in `tblSchedule` at all → rows go to an "Unmapped" sheet instead
  of being silently dropped or guessed at.

### Renaming a department (when the punchlist string changes)
If the ZKBio export ever changes a department's name (e.g. `ADMISSION OFFICE(TTSH)` →
`Office of Admissions`), the only edit needed is the `Department` column of `tblSchedule` —
the rename cannot cascade (roster matching is by staff name, output sheet names auto-derive,
and the summary/dropdown key off employee ID, so none depend on the dept string). See
`docs/superpowers/specs/2026-07-14-department-rename-procedure-design.md` for the full
blast-radius analysis.

Do the rename in **one atomic operation** so a department can't be split across rows (the
name repeats on every scheduled weekday row): select the `Department` column of `tblSchedule`,
press `Ctrl+H`, Find = old string, Replace = new string **copied verbatim from the punchlist**
(casing/outer spaces don't matter — matching is `UCase(Trim())` — but words and punctuation
must be identical), set "Within: Selection", then **Replace All**. Verify by running the macro
once: if the department gets its own output sheet (and its people aren't on "Unmapped"), the
rename matched.

## Roster sheet / tblRoster_* (auto-resolving NO PUNCH days)
- `Roster` sheet: as of 2026-07-07, one table per unit (`tblRoster_PSO`,
  `tblRoster_INFLIGHT`, `tblRoster_AdmissionsOffice`), stacked vertically, each capped at
  20 data rows (real max unit size is 11). `Helpers.LoadRoster` auto-discovers any table
  whose name starts with `tblRoster` -- adding a new unit means adding its own
  `tblRoster_<Unit>` table (see Instructions sheet, "Adding a new department"), no VBA
  change needed. See
  `docs/superpowers/specs/2026-07-07-roster-per-unit-tables-design.md`.
- Each unit table's headers are **static and set up once**: `Attendance Name` (must match
  the employee's name as constructed from the punch export's First+Last columns -- this
  is the join key; per the 2026-07-08 TTSH-wide design this becomes the punchlist's single
  name column, col B, since Last Name is always empty in real exports), `Roster Name` (the
  name as it appears in the unit's own native roster,
  informational only), then `1` through `31` (plain day-of-month numbers). Every month,
  the manager pastes only the code grid into the existing `1`-`31` columns -- headers
  never get re-pasted or resized.
- **Matching is by day-of-month, not calendar date** -- confirmed from a real sample of a
  unit's native roster, which has no month/year anywhere in it, only a day-number column
  per day. This assumes the roster's currently-pasted data reflects whichever month the
  punch list being processed covers (a stale roster could match the wrong month's code
  for a given day-of-month -- an accepted trade-off, not detectable without a month/year
  in the source data).
- `Config` sheet, table `tblRosterCodes`: the 8 codes recognized as leave, regardless of
  department -- `AL, MC, OIL, FCL, PH, SLWOMC, UL, BL`. Matching is exact (case-insensitive,
  trimmed) -- variants like `AL(PM)` or `MC/AL` don't match and leave the day fully manual,
  by explicit choice (see the design spec's "Out of scope").
- Duty/rotation codes (`C1`, `C2`, `FC`, `CH Ref`, `RD`, `Ref`, `Standby`, `Course`, etc.)
  are never in `tblRosterCodes` and are always ignored by this feature. Trailing summary
  rows in a native roster (e.g. "Actual Man Day", "Max Headcount...") are likewise inert
  if pasted in by mistake -- they simply never match an `Attendance Name`.
- Both the Roster sheet and `tblRosterCodes` are optional -- a department with neither set
  up behaves exactly as before this feature existed. Malformed roster data (missing
  `Attendance Name` column in one unit's table, duplicate names/day columns) degrades
  gracefully with a warning appended to the completion message box, scoped to the
  affected table only, never a blocking error for the whole run.
- A confirmed match changes `Clock-In Status` to `NO PUNCH - ROSTER: <code>` (e.g.
  `NO PUNCH - ROSTER: AL`) and the row color to light blue (`RGB(215,235,250)`), instead of
  the purple `NO PUNCH - VERIFY` used when the roster doesn't resolve the day -- see
  `ReportBuilder.ApplyRowColor`. This is the only visible trace of the cross-check besides
  the Verification column itself.

## Output structure (per department sheet)
Columns A–R: Personnel ID, Name, Department, Date, Weekday, Raw Punch, Clock In, Clock Out,
Sched Start, Sched End, Clock-In Status, Clock-Out Status, Late (min), Early (min), Hours
Worked (or Minutes Worked, per `Config!B4`), Expected Hours (or Expected Minutes),
Verification (dropdown), Notes (free text).

Columns U onward: per-employee summary block, built with live `COUNTIFS`/`SUMIFS` formulas
(not hardcoded values) so it recalculates if a manager edits a Verification tag later.

Row color by `Clock-In Status`: purple = NO PUNCH - VERIFY, light blue = NO PUNCH - ROSTER: <code>
(roster-confirmed), light red = Late/Missing Clock-In, amber = Within Grace, bright red =
UNRECOGNIZED FORMAT (should never fire — see Testing section).

## Architecture decisions already made — do not re-litigate without a good reason
1. Config lives as a sheet inside the same macro workbook (not a separate file) — matches
   the user's existing MFC macro pattern.
2. Output is a brand-new workbook every run, saved next to the tool as
   `Attendance_Report_<YYYY>_<MM>.xlsx` — matches the MFC macro pattern, not overwritten sheets.
3. Blank cell = not scheduled that day (not an error, not flagged) — this was verified against
   real roster data, not assumed.
4. `[-]` days are never *guessed* at — but as of 2026-07-07, a `[-]` day confirmed by the
   unit's own Roster sheet data (`tblRoster_<Unit>` + `tblRosterCodes`) auto-fills the
   Verification column and changes `Clock-In Status`/row color (`NO PUNCH - ROSTER: <code>`,
   light blue), since that's the manager's own record, not a guess. Absent a roster match,
   the day still falls back to fully manual tagging (`NO PUNCH - VERIFY`, purple) as before.

## Testing checklist for Claude Code
Since none of this has run in real Excel, prioritize in this order:
1. **Import all 4 modules and compile** (Debug → Compile VBAProject in the VBA editor) before
   running anything — catches syntax errors immediately.
2. **Run against the real sample file** (`Referral_Data_2026_1.xlsx` is unrelated — use a real
   Monthly Punch List export, e.g. `Monthly_Punch_List_20260703102553.xls`; note this file's
   actual bytes are OOXML/xlsx format despite the `.xls` extension — Excel opens it fine, but
   if VBA's `Workbooks.Open` chokes on the extension mismatch, that's the first thing to check).
3. **Verify `Application.GetOpenFilename` file filter** doesn't exclude the real file due to
   the extension mismatch above.
4. **Check the `Scripting.Dictionary` late-bound object usage compiles** on the target machine
   (CreateObject("Scripting.Dictionary") requires the Windows Script Host runtime — should be
   present on any standard TTSH Windows machine, but confirm, don't assume).
5. **Check `Set dict(key) = worksheetObject` pattern in `ReportBuilder.BuildDepartmentSheets`**
   — this is a known-working VBA idiom but worth a breakpoint check on first run since it's the
   least common pattern in the codebase.
6. **Confirm the summary block's employee list matches the detail rows** — the uniqueness
   trick (`Collection.Add item, Key:=empID` wrapped in `On Error Resume Next`) silently skips
   duplicates; if it silently skips something it shouldn't, employees could be missing from
   the summary block. Worth an explicit row-count assertion during testing.
7. **Any `UNRECOGNIZED FORMAT` rows (bright red) in a real run are a signal the punch cell
   regex-equivalent logic in `PunchParser.ParsePunchCell` doesn't cover a format that exists
   in production** — go back to the raw data and find what pattern wasn't anticipated, don't
   just suppress the flag.

## Honest weak points to watch for (not yet stress-tested)
- `ParsePunchCell` assumes exactly one dash separates in/out — untested against multi-punch
  days (e.g., lunch break clock-out/in) if the real system ever produces those; none appeared
  in the June sample but that doesn't rule it out in other months.
- `ParseDayHeaders` assumes date columns are contiguous starting at column E with no gaps —
  if the export template changes (inserted column, moved department field), this breaks
  silently rather than erroring loudly. Consider adding a header-name check as a guard rail.
- No handling yet for an employee who changes department mid-month (unlikely for this data
  but not structurally impossible) — current logic groups strictly by the Department value on
  that employee's row, one row = one department, so this isn't actually a bug, just noting it
  as an assumption.
