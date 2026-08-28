# FC Completion Report -- Output Naming & Staff Roster Check Addendum

Date: 2026-06-11
Status: Draft for review
Builds on: `2026-06-10-fc-completion-report-design.md`

## 1. Purpose

Two additions to the `BuildOutput.bas` design from 2026-06-10:

1. An updated output file naming convention.
2. A new "Staff Roster Check" output sheet (placeholder name) -- a roster-coverage
   check.

## 2. Output File Naming

**New pattern:** `FCReportSummary_<FullMonthName><Year>.xlsx`

- Example: `FCReportSummary_June2026.xlsx`
- `FullMonthName` = full English month name (e.g. "June"), `Year` = 4-digit year,
  concatenated with no separator.
- Source: derived from the most common Admission Date month/year in cleaned File A
  (the report period). Used as the suggested default filename passed to
  `Application.FileDialog(msoFileDialogSaveAs)` -- the user can still rename it in the
  dialog.

**Note -- supersedes 2026-06-10 spec, section 9 item 1 (file name portion only):** the
2026-06-10 spec specified `FCSummaryReport_<Month><Year>.xlsx` (e.g.
`FCSummaryReport_Jul2025.xlsx` -- abbreviated month, word order "Summary Report"). The
pattern in this addendum (`FCReportSummary_<FullMonth><Year>.xlsx`, full month name,
word order "Report Summary") is the one to implement.

The EM / EL / Missed FC / Summary / Methodology **sheet names** from the 2026-06-10
spec are unaffected by this change and remain placeholders, to be finalised by the
user before/at implementation.

## 3. Staff Roster Check Sheet (new, placeholder name "Staff Roster Check")

### 3.1 Purpose

A roster-coverage check mirroring a sheet in the team's existing manual report: for
each team in the Config roster, list every staff member and whether they appear
anywhere in this month's cleaned File A data (i.e. had FC activity logged this month).

### 3.2 Data source

The in-memory, deduplicated File A dataset that `BuildOutput.bas` already holds
(combined EM+EL, post-`ResolveDuplicateEncounters`). No changes needed to
`Helpers.bas` or `DeduplicateEncounters.bas`.

### 3.3 "Matched" lookup set

Build a `Scripting.Dictionary` (`CompareMode = vbTextCompare`) containing every
distinct, trimmed, non-blank value found in the `FC Created By` and
`Latest CCF Creation User` columns across all rows of the combined dataset.

### 3.4 Layout

One table per Config roster team, in this fixed order, **skipping "Others"**:

1. ED/EDFC
2. Inflight
3. NCID AO
4. ICH PSO
5. Admin/Managers

For each team:

- Header row: team name (bold).
- Sub-header row: `Staff Name | Matched`.
- One row per staff member in that team (from `LoadStaffRoster`, in roster order):
  - Column A: Staff Name
  - Column B: `Matched` or `Not Matched` (membership in the lookup set from 3.3,
    case-insensitive, trimmed)
  - If `Not Matched`: red fill on both cells of that row (same red used for duplicate
    Encounter Number highlighting elsewhere).
- Blank separator row between teams.

No summary counts (e.g. "X of Y matched") -- decided against per user direction.

### 3.5 Edge cases

- **Config sheet missing or roster empty** (no Staff Name/Team rows): instead of
  empty tables, write a single informational row: "Config roster is empty -- run
  CreateConfigSheet (Alt+F8) and add staff names/teams before this check is
  meaningful."
- **A team with zero staff members in the roster**: still write its header +
  sub-header rows, with no data rows below, so staff can see the team exists and needs
  roster entries.
- A staff member belongs to exactly one team (`LoadStaffRoster` is a 1:1 Dictionary)
  -- no cross-team duplication handling needed.

### 3.6 Module placement

New `Sub BuildStaffRosterCheckSheet(...)` in `BuildOutput.bas`, called from the
top-level output-orchestration sub alongside the EM/EL/Missed FC/Summary/Methodology
sheet builders (per the 2026-06-10 spec's section 8 module table). Takes the combined
deduplicated File A array and the Config roster Dictionary as inputs -- both already
available to `BuildOutput.bas` for the other sheets.

## 4. Open Items

- **File-naming discrepancy with the 2026-06-10 spec** (section 2 above) -- this
  addendum's pattern is authoritative going forward.
- **Placeholder sheet name "Staff Roster Check"** -- to be finalised by the user along
  with the other output sheet names before/at implementation.
