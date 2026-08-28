# Roster Sheet — One Table Per Unit, Day-of-Month Matching — Design Spec

Date: 2026-07-07

**Amends** `2026-07-07-roster-leave-ingestion-design.md`: that spec's matching mechanism
(exact calendar date, discovered via `IsDate()` on column headers) is superseded by the
day-of-month mechanism below, based on a real sample of a unit's native roster. Everything
else in that spec (join key = `Attendance Name`, `tblRosterCodes`, exact-match-only,
`Case "NOPUNCH"` writing to the Verification column, graceful non-blocking degradation)
is unchanged.

## Purpose

The Roster sheet (added in `2026-07-07-roster-leave-ingestion-design.md`) currently holds
one shared `tblRoster` table (`Attendance Name` | `Roster Name` | date columns) that every
unit's rows get typed into together. In practice, each unit already keeps its own native
monthly roster (a name column plus one column per day-of-month), and a manager wants to
paste their whole unit's roster data into the tool in one action rather than retyping rows
into a table shared with other units.

This spec splits `tblRoster` into one table per unit (department), stacked vertically on
the Roster sheet, and changes how a day gets matched: from an exact calendar date to a
plain day-of-month number, matching how the native rosters actually look.

## What the native roster actually looks like (confirmed from a real sample)

A unit's native roster is a grid: one row per employee, one column per **day-of-month**
(`1`-`31`, plain numbers — not real dates, no month or year anywhere in the file), cells
holding a mix of duty/rotation codes (`CH Ref`, `C1`, `C2`, `FC`, `RD`, ...) and leave
codes (`AL`, `CCL`, ...), plus trailing summary rows (`Actual Man Day`, `Max Headcount...`)
that aren't employee data at all.

This changes two things from the original spec:

1. **No calendar date exists anywhere in the source data.** Matching by exact date
   (`IsDate()` on headers, keyed by `CLng(dateSerial)`) cannot work against data pasted
   from this format — every header would be a plain integer `1`-`31`, and while VBA's
   `IsDate()` technically accepts a bare number (treating it as an OLE date serial), that
   resolves to a nonsense date near the 1899/1900 epoch, not "the Nth day of this month."
   Silently wrong, not silently absent — the failure mode this spec exists to avoid.
2. **Summary rows aren't a special case to filter out.** `Actual Man Day` / `Max
   Headcount...` (and any other non-employee row) simply never match an `Attendance Name`
   in the punch export, so they're inert by the same "no match = no-op" rule that already
   applies to any other non-matching name — no extra filtering logic needed.

## Matching mechanism: day-of-month, not calendar date

`tblRoster_X` tables key their date columns by **plain day-of-month number** (`1`-`31`),
not by calendar date. Since nothing in the roster ever states which month it's for,
matching assumes the roster's currently-pasted data reflects whichever month the Monthly
Punch List being processed covers — consistent with the "replace monthly" refresh model
below (at any moment, the roster only ever holds one month's data).

- `rosterData` is now keyed `UCase(Trim(AttendanceName)) & "|" & dayOfMonth` (`dayOfMonth`
  a plain `Long`, `1`-`31`), not by date serial.
- `Helpers.LoadRoster`'s column discovery changes from `IsDate(hdrVal)` to a numeric check:
  a header counts as a day column only if it's numeric and in `1`-`31`
  (`IsNumeric(hdrVal) And CLng(hdrVal) >= 1 And CLng(hdrVal) <= 31`) — rejects blank
  headers, text headers, and out-of-range numbers, not just non-dates.
- `ReportBuilder.BuildDepartmentSheets`'s `Case "NOPUNCH"` branch builds its lookup key
  from `Day(dayDates(d))` (the day-of-month component of the punch list's actual date for
  that column) instead of `CLng(dayDates(d))` (the full date serial). This is the one
  change to `ReportBuilder.bas` this spec requires — everything else in that file is
  unaffected.

**Known limitation, accepted as-is**: if a roster is stale (still showing last month's
codes when this month's punch list is processed), a day-of-month match could pull the
wrong month's code for that day. This is the same trust placed in "replace monthly" as a
process discipline already, not a new risk introduced by this change — there is no way to
detect staleness without a month/year somewhere in the source data, which the native
format doesn't have.

## Table setup: static headers, monthly data-only refresh

Each `tblRoster_X` table's headers are **static and set up once**:
`Attendance Name | Roster Name | 1 | 2 | 3 | ... | 31` (33 columns total, covering the
longest possible month so no month-to-month resizing is ever needed). Every month, the
manager pastes **only the code grid** (existing employee rows × day-of-month columns)
directly into the `1`-`31` columns, overwriting last month's codes in place —
`Attendance Name`/`Roster Name` aren't re-pasted or re-typed each month, since employee
identity doesn't change monthly. This matches "replace monthly" (confirmed earlier): the
table always holds exactly one month's data, never accumulates.

## Table sizing

Confirmed: max real department size is 11 people. Each unit table is capped at **20 data
rows** — comfortable margin above the real max, without being open-ended.

## New layout

One table per department already defined in Config's `tblSchedule` (currently PSO,
INFLIGHT, Admissions Office), stacked vertically, each with a 3-row gap before the next:

```
Row 1      Title: "ROSTER -- paste each unit's monthly roster into its table below"
Row 2      (blank)
Row 3      "PSO ROSTER"
Row 4      tblRoster_PSO header: Attendance Name | Roster Name | 1 | 2 | ... | 31
Row 5-24   up to 20 data rows
Row 25-27  (blank gap)
Row 28     "INFLIGHT ROSTER"
Row 29     tblRoster_INFLIGHT header
Row 30-49  up to 20 data rows
Row 50-52  (blank gap)
Row 53     "ADMISSIONS OFFICE ROSTER"
Row 54     tblRoster_AdmissionsOffice header
Row 55-74  up to 20 data rows
```

Every table is created with the full 33-column header (`Attendance Name`, `Roster Name`,
`1`-`31`) from the start — not grown incrementally as date columns get added, since the
headers never change after setup.

`Attendance Name` is still filled in by hand per row — this is inherent to the
no-Employee-ID matching design (`2026-07-07-roster-leave-ingestion-design.md`), not
something a copy-paste can resolve, since the native roster doesn't carry the employee's
full punch-export name.

**Table naming convention**: `tblRoster_<Department with spaces removed>` (e.g.
`tblRoster_AdmissionsOffice`). Adding a new department later means also adding its own
`tblRoster_<Dept>` table here — a manual, documented step (mirrors the existing "Adding a
new department" step for `tblSchedule`), not a VBA change.

## `Helpers.LoadRoster` change

Currently, `LoadRoster` looks for one `ListObject` named exactly `tblRoster` and discovers
date columns via `IsDate()`. It changes to:

1. Iterate every `ListObject` on the Roster sheet whose name starts with `tblRoster`
   (prefix match) — discovery is by naming convention, not by cross-referencing
   `tblSchedule`'s department list. This keeps the loader simple and avoids fragile
   string-matching between sanitized department names and table names.
2. For each matching table independently: locate its `Attendance Name` column, discover
   its day-of-month columns (numeric `1`-`31` headers, per "Matching mechanism" above),
   read its rows into the same combined `rosterData` dictionary (keyed
   `UCase(Trim(AttendanceName)) & "|" & dayOfMonth`).
3. Duplicate-name and duplicate-day-column detection happens **across all tables
   combined** (first occurrence across all tables wins), with the warning message
   including which table the duplicate was found in, e.g. `"tblRoster_PSO has a
   duplicate Attendance Name (SYLVIA TAN) -- first occurrence used."`

**Error-handling scope change**: today, a missing `Attendance Name` column disables
roster matching for the entire run. With multiple tables, this scopes down to just the
one broken table — a mistake in one unit's table no longer disables roster matching for
every other unit. A table with no `Attendance Name` column is skipped (with a warning
naming that table), and the loader continues to the next `tblRoster_*` table.

If the Roster sheet has no `tblRoster*` tables at all, behavior is unchanged from today:
`rosterData` stays empty, every `[-]` day behaves exactly as it does without this
feature.

## `ReportBuilder.bas` change

`BuildDepartmentSheets`, `Case "NOPUNCH"` (the only place that reads `rosterData`) changes
its lookup key from the full date serial to the day-of-month:

```vba
rKey = UCase(Trim(fName)) & "|" & Day(dayDates(d))
```

(previously `UCase(Trim(fName)) & "|" & CLng(dayDates(d))`). Nothing else in this branch,
or any other `Case`, changes — `Clock-In Status` is still never touched by this feature,
and a non-match still leaves the Verification cell blank exactly as before.

## Documentation

- Instructions sheet: "Adding a new department" gains an optional second step —
  *(optional)* create a `tblRoster_<Dept>` table on the Roster sheet if you also want
  that department's `[-]` days auto-resolved from a roster. Skipping this step is safe;
  that department's `[-]` days behave exactly as they do today.
- `Attendance_Analyzer_Context.md` — update the Roster sheet / `tblRoster` description to
  describe the per-unit table structure and day-of-month matching instead of a single
  shared table matched by exact date.

## Out of scope

- No month/year tracking anywhere in the Roster sheet — day-of-month matching accepts the
  staleness risk described above as a process-discipline trade-off, not a gap to close in
  code.
- No automatic creation/renaming of `tblRoster_*` tables when `tblSchedule` changes —
  adding a department's roster table stays a manual, documented step.
- No support for units accumulating multiple months' data in one table (ruled out by the
  confirmed "replace monthly" model) — headers are permanent, only the code grid refreshes.
- No change to `tblRosterCodes`, the exact-match-only rule, or anything in
  `ReportBuilder.bas` outside the one `rKey` line above.

## Files touched

- `Helpers.bas` — `LoadRoster`: table discovery loop (prefix match instead of single
  exact name), day-of-month column discovery (numeric `1`-`31` instead of `IsDate()`),
  per-table error scoping, warning messages naming the source table.
- `ReportBuilder.bas` — `BuildDepartmentSheets`, `Case "NOPUNCH"`: `rKey` built from
  `Day(dayDates(d))` instead of `CLng(dayDates(d))`.
- `Attendance_All_Modules.txt` (regenerated via `./regen_modules.ps1` after source edits,
  per the dual-source maintenance convention in `CLAUDE.md`)
- `Attendance_Analyzer_Context.md` — document the per-unit Roster table structure and
  day-of-month matching.
- `Attendance_Analyzer.xlsx` (tracked in this repo) — Roster sheet rebuilt into the
  per-unit stacked layout above, each table created with the full static
  `Attendance Name | Roster Name | 1..31` header (`tblRoster_PSO`, `tblRoster_INFLIGHT`,
  `tblRoster_AdmissionsOffice`, replacing the single `tblRoster` table); Instructions
  sheet gets the new optional step.
