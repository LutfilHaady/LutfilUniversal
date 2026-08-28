# Roster/Leave Ingestion — Auto-Resolve NO PUNCH Days — Design Spec

Date: 2026-07-07

> **Partially superseded (2026-07-08):** the "Clock-In Status is never changed" rule below
> was revised. A roster-confirmed `[-]` day now DOES change `Clock-In Status` to
> `NO PUNCH - ROSTER: <code>` with a light-blue row color, and the summary block gained a
> `Roster-Resolved` column. See `CLAUDE.md` "Key invariants", `Attendance_Analyzer_Context.md`,
> and `2026-07-08-ttsh-wide-adoption-design.md`. Everything else in this spec stands.

## Purpose

Today, any `[-]` ("no punch captured") day is always flagged `NO PUNCH - VERIFY` with a
blank Verification dropdown, left entirely to manual tagging — because no leave data was
available when the tool was built, and auto-classifying a guess was explicitly rejected
(`Attendance_Analyzer_Context.md`, `CLAUDE.md` "Key invariants").

Every unit already keeps its own monthly roster (a manager-maintained Excel grid: one row
per staff, one column per day, cells mixing duty-rotation codes like `C1`/`FC`/`CH Ref`
with leave codes like `AL`/`MC`/`FCL`) as their leave/MC record of truth. This spec adds a
path for that roster data to reach the analyzer, so a `[-]` day that the roster confirms
as leave gets pre-filled instead of left fully manual — while a `[-]` day the roster
doesn't explain (or that a unit hasn't set up a roster for at all) behaves exactly as it
does today.

This is not a file importer for units' native roster workbooks (format varies per unit,
first-name-only identification, monthly tab layout that would need a fragile per-unit
parser). Instead, managers copy their roster into a small standardized table inside
`Attendance_Analyzer.xlsx` itself, using the same "Config sheet, Excel Table, no VBA
change needed" pattern `tblSchedule`/`tblVerification` already establish. No Employee ID
lookups are required — the table carries its own name-to-name mapping (below), so
managers work entirely with names they already recognize.

## New data: Roster sheet + `tblRoster` table

A new sheet, **"Roster"**, in `Attendance_Analyzer.xlsx`, holding one Excel Table,
**`tblRoster`**:

| Attendance Name | Roster Name | 1-May-2026 | 2-May-2026 | ... |
|---|---|---|---|---|
| Fieda Binte Ahmad | Fieda | AL | | ... |
| Sylvia Tan Wei Ling | Sylvia | | MC | ... |

- **Attendance Name** — the employee's name exactly as it appears in the raw punch
  export/output (i.e. matching `fName` in `ReportBuilder.BuildDepartmentSheets`, built as
  `Trim(FirstName & " " & LastName)`). **This is the join key** used to match a `[-]` day
  to a roster row — not Employee ID.
- **Roster Name** — the name as it appears in the unit's own native monthly roster (often
  just a first name, e.g. `"Fieda"`). Informational only, not used in matching — it exists
  so a manager copying data in can visually cross-reference which row of `tblRoster`
  corresponds to which row of their native roster while pasting in that row's codes. This
  is the two-column mapping that replaces needing an Employee ID at all: the manager
  writes the one name they may not immediately recognize (`Attendance Name`, looked up
  once against the punch export or output sheet) next to the name they already know
  (`Roster Name`, straight from their native roster).
- **Date columns** — real calendar dates (entered as actual Excel date values, not
  weekday names or text), one column per day that has at least one relevant code to
  record. Because matching is by literal date rather than by fixed column position or
  weekday, the table doesn't need to be resized or relaid-out for month length —
  managers can either replace the table's date columns each month or keep appending new
  ones over time; both work identically since date columns are discovered dynamically
  (see below), not hardcoded to a fixed range.
- A cell is left blank for any day with nothing worth recording (normal working day, or a
  duty/rotation code the analyzer doesn't care about — see next section).
- Matching on `Attendance Name` is case-insensitive and trimmed (names are more prone to
  casing/whitespace slips than an ID would be), but otherwise an exact string match — a
  name that doesn't match exactly (typo, missing middle name, nickname vs legal name)
  simply doesn't resolve, same safe fallback as any other non-match.

## New Config table: `tblRosterCodes`

A new small table in the existing **Config** sheet, **`tblRosterCodes`**, single column
`Code`, listing the exact codes recognized as leave, regardless of department:

```
AL
MC
OIL
FCL
PH
SLWOMC
UL
BL
```

This list is Config-driven (not a hardcoded VBA constant) so adding a 9th code later is a
Config edit only, consistent with how `tblSchedule`/`tblVerification` already work — no
VBA change, no re-import.

Matching against this list is **exact match only** (case-insensitive, trimmed) — a cell
value has to equal one of these codes exactly. Variants that aren't exact matches (e.g.
`AL(PM)`, `AL (PN)`, `MC/AL`, `UFCL`) do **not** match and are treated the same as any
other unrecognized code: the day stays `NO PUNCH - VERIFY`, unaffected. Duty/rotation
codes (`A`, `O`, `T`, `C1`, `C2`, `FC`, `CH Ref`, `Ref`, `Standby`, `Course`, etc.) are
never in this list and are always ignored by this feature.

## `tblVerification` extension

The same 8 codes are added as 8 new rows in the existing `tblVerification` table,
alongside the current 6 generic options (`Approved Leave`, `MC (Medical Certificate)`,
`Off-Roster Change`, `Genuine Absence`, `Forgot to Punch (Whole Day)`,
`Other - see notes`). This makes them valid values in the Verification dropdown for
manual selection too, and is what the auto-fill (below) writes into that column.

`tblRosterCodes` (what the matcher checks against) and `tblVerification`'s list (what's
selectable in the dropdown) are two separate tables kept in sync by content, not by
formula reference — same independence `tblSchedule` and `tblVerification` already have
from each other.

## Processing change: `BuildDepartmentSheets`, `Case "NOPUNCH"`

Currently (`ReportBuilder.bas`, around line 226):
```vba
Case "NOPUNCH"
    statusIn = "NO PUNCH - VERIFY"
    statusOut = "N/A"
```
No Verification value is written; the cell is left for manual dropdown selection.

New behavior, same branch:
1. Look up `UCase(Trim(fName)) & "|" & CLng(theDaysDate)` in the in-memory roster
   dictionary (built by the new loader, below), where `fName` is the same
   `Trim(FirstName & " " & LastName)` value already computed earlier in
   `BuildDepartmentSheets` for this row.
2. If found, and the stored code is (case-insensitively, trimmed) an exact match to one of
   `tblRosterCodes`, write that code into the Verification column (Q) for this row.
3. Otherwise — no roster entry for this employee's name, no date column for this day,
   roster data unavailable this run, or a code present but not in `tblRosterCodes` —
   behavior is completely unchanged from today: Verification stays blank, `Clock-In
   Status` still reads `NO PUNCH - VERIFY`.

~~`Clock-In Status` is **never** changed by this feature — the row stays visually flagged
(still gets `ApplyRowColor`'s purple highlight) either way. Only the Verification cell
gets pre-filled when there's a confirmed match.~~ *(Superseded 2026-07-08 — see note at
top: a confirmed match now changes `Clock-In Status` and the row color.)* No other `Case`
branch (`NORMAL`, `MISSING_IN`, `MISSING_OUT`, `BLANK`, `UNKNOWN`) is touched by this
feature at all.

## New loader

A new `LoadRoster` routine (in `Helpers.bas`, alongside `LoadConfig`) reads `tblRoster` +
`tblRosterCodes` into:
- `rosterCodes As Object` (`Scripting.Dictionary`, the 8 recognized codes, UCase-keyed, for
  O(1) membership checks)
- `rosterData As Object` (`Scripting.Dictionary`, keyed
  `UCase(Trim(AttendanceName)) & "|" & CLng(dateSerial)` → raw code string)

Date columns in `tblRoster` are discovered the same way `PunchParser.ParseDayHeaders`
already discovers date columns in the raw punch export: scan the header row, keep only
columns where `IsDate(header) = True`, skip anything else silently (see error handling
below) rather than assuming a fixed column count or position.

`MainMacro.GenerateAttendanceReport` calls `LoadRoster` once, right after `LoadConfig`,
passing the results into `BuildDepartmentSheets` alongside the existing `schedule` and
`verifyOptions` parameters.

## Error handling & validation

**Roster-specific, all non-blocking** (a broken or absent Roster setup must never stop
report generation for departments that don't use it):

- **"Roster" sheet or `tblRoster` missing entirely** → not an error. Treated as "not
  adopted yet" — `rosterData` stays empty, every `[-]` day behaves exactly as today.
- **`tblRoster` missing its `Attendance Name` column** → Roster matching is skipped for
  the entire run (not per-row), with one warning recorded (see Surfacing, below).
- **Invalid/non-date column header in `tblRoster`** → that column is silently skipped,
  same self-adjusting behavior `ParseDayHeaders` already has — no warning, no error (this
  mirrors how the punch list export already tolerates non-date columns).
- **Duplicate Attendance Name rows** in `tblRoster` (case-insensitive) → first occurrence
  wins; the duplicate name is added to the warnings list.
- **Duplicate date columns** (two columns resolving to the same calendar date) → same
  treatment: first occurrence wins, warning recorded.
- **`tblRosterCodes` missing** → treated as an empty list (no codes recognized); every
  `[-]` day behaves exactly as today. Not an error, since this table is only meaningful
  together with `tblRoster`.
- **Any unexpected error while reading the Roster sheet** (e.g. corrupted table) is caught
  inside `LoadRoster` itself, not propagated to `MainMacro`'s top-level `ErrHandler` —
  falls back to "no roster data" behavior for the whole run, with a warning recorded.

**Surfacing:** warnings collected during `LoadRoster` are appended to the existing
completion `MsgBox` in `MainMacro.bas` (the one that already reads "Attendance report
generated... check purple rows") as an additional paragraph, rather than interrupting
mid-run — consistent with the existing "run once, inspect by eye afterward" workflow.

**General hardening pass (existing code, found while designing this feature):**

`Helpers.LoadConfig` currently has several unguarded operations that would surface as
generic, hard-to-diagnose VBA runtime errors (still caught by `MainMacro`'s top-level
`ErrHandler` today, so nothing crashes silently or corrupts output — but the message
doesn't say what actually went wrong):

- `cfgWs.Range("GracePeriod").Value` (line 34) — throws a generic error if the named range
  is missing or renamed. Add an existence check first; raise a named error
  (`"GracePeriod named range not found in Config sheet"`) if absent.
- `cfgWs.ListObjects("tblSchedule")` / `"tblVerification"` (lines 43, 66) — same treatment:
  check existence first, raise a named error identifying which table is missing.
- `CDbl(tbl.DataBodyRange(i, 4).Value)` / `(i, 5)` (lines 56-57) — throws a generic Type
  Mismatch if a Start/End Time cell has non-numeric content, with no indication of which
  row. Guard with `IsNumeric` first; if it fails, raise a named error including the
  department and weekday of the offending row (`"tblSchedule row for PSO/Saturday has a
  non-numeric Start Time"`).
- Add `LastAction` updates inside the `tblSchedule`/`tblVerification` loops (e.g.
  `"LoadConfig: reading tblSchedule row 5 (dept=PSO, weekday=Saturday)"`), matching the
  per-row granularity `BuildDepartmentSheets` already has, so a failure's `MsgBox`
  (`MainMacro.bas` line ~79, `"Last action: " & LastAction`) points at the exact row
  instead of just "Loading Config sheet."
- The new `LoadRoster` code follows this same hardened pattern from the start (named
  errors, per-row `LastAction`), for consistency with the rest of the codebase.

This doesn't add a new error-handling layer or change the single-top-level-`ErrHandler`
architecture — it makes the messages that already reach that handler specific and
actionable instead of generic.

## Out of scope

- No per-department code vocabulary or code-to-category translation table. The 8-code
  list in `tblRosterCodes` is global and department-agnostic, per the "streamlined list,
  duty codes never matter" decision.
- No fuzzy/substring/prefix matching for code variants (`AL(PM)`, `MC/AL`, `UFCL`, etc.) —
  exact match only, by explicit choice. These variants simply don't auto-resolve.
- No automated import of units' native roster workbooks (e.g. the PSO monthly-tab
  format) — managers copy into `tblRoster` by hand.
- ~~No change to `Clock-In Status`, row coloring, or any `Case` branch besides `NOPUNCH`.~~
  *(Superseded 2026-07-08 — `Clock-In Status` and row color do change on a confirmed
  match; still no `Case` branch besides `NOPUNCH` is touched.)*
- No change to how blank punch cells are handled (still always skipped regardless of
  schedule or roster data — this is what already makes the Admissions Office alternating-
  Saturday schedule safe).

## Files touched

- `Helpers.bas` — new `LoadRoster` sub, `rosterCodes`/`rosterData` structures, hardening
  of `LoadConfig` (named-error checks, per-row `LastAction`, `IsNumeric` guards)
- `ReportBuilder.bas` — `BuildDepartmentSheets`, `Case "NOPUNCH"` branch (Verification
  auto-fill), new parameters threaded through from `MainMacro`
- `MainMacro.bas` — call `LoadRoster` after `LoadConfig`; append collected warnings to the
  completion `MsgBox`
- `Attendance_All_Modules.txt` (regenerated via `./regen_modules.ps1` after source edits,
  per the dual-source maintenance convention in `CLAUDE.md`)
- `Attendance_Analyzer_Context.md` — document the new Roster sheet/`tblRoster`,
  `tblRosterCodes`, and the 8 new `tblVerification` rows
- `Attendance_Analyzer.xlsx` (tracked in this repo) — manual/scripted edits: new "Roster"
  sheet + `tblRoster` table (`Attendance Name` | `Roster Name` | date columns), new
  `tblRosterCodes` table in Config, 8 new rows in `tblVerification`
