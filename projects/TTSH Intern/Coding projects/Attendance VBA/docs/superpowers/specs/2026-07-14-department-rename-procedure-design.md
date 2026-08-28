# Department Rename — Safe Edit Procedure (No Code Change) — Design Spec

Date: 2026-07-14

## Purpose

The ZKBio CVAccess punchlist's department strings may change over time (e.g.
`ADMISSION OFFICE(TTSH)` -> `Office of Admissions`). When that happens the manager must
update the department name in `Config` -> `tblSchedule` so the exact-match join keeps
routing that department to its own sheet instead of "Unmapped". This spec documents a
safe, one-operation way to do that rename and confirms it cannot cascade to anything
else. **No VBA change** — this is a documentation deliverable only.

## Why this is safe (blast radius of a department rename)

A department rename touches exactly one thing that matters: the `Department` column of
`tblSchedule`. Everything else is dept-name-independent, confirmed by reading the code:

- **Schedule match** — `Helpers.BuildScheduleKey` keys on `UCase(Trim(dept))`, so the
  punchlist string and the `tblSchedule` string only have to agree on words and
  punctuation, not casing or leading/trailing spaces. This is the *only* consumer of the
  dept string for routing (`Helpers.DeptHasScheduleRows`).
- **Roster `[-]` auto-resolve** — matches on staff name + day-of-month only
  (`ReportBuilder.bas`, `Case "NOPUNCH"`, `rKey = UCase(Trim(fName)) & "|" & Day(...)`).
  It never consults the department, so a rename has zero effect on roster resolution.
  The `tblRoster_<Unit>` table *name* is only used for discovery, not matching.
- **Output sheet name** — auto-derived from the dept string each run (truncated to 31
  chars); no manual edit needed.
- **Summary block + Verification dropdown** — keyed on employee ID (col A) and status
  strings, never the dept string.

So the rename is contained. The only real hazard is *within* `tblSchedule`: the
department name repeats on every scheduled weekday row for that department (e.g. 5 rows
for a Mon-Fri unit). Hand-editing the rows one at a time risks changing some but not all,
which would silently split one department into two partial matches.

## The procedure (eliminates the split-department hazard)

Rename in a single atomic operation using Excel's Find & Replace, scoped to the table so
nothing outside `tblSchedule` is touched:

1. Select the `Department` column of `tblSchedule` (click the column's data cells, or the
   whole `tblSchedule` range).
2. Press `Ctrl+H` (Find & Replace).
3. **Find what:** the old department string, exactly as it currently appears in
   `tblSchedule`.
4. **Replace with:** the new department string, copied *verbatim from the punchlist*
   (never retyped — copy the cell from the export). Casing and outer spaces don't matter
   because the match normalizes them, but words and punctuation must be identical.
5. Ensure "Within: Selection" (expand Options if needed) so the replace stays inside the
   table, then **Replace All**.

Because Replace All updates every weekday row for that department at once, it is
impossible to fix some rows and miss others. No other sheet, table, or the roster needs
any edit.

### Verifying the rename worked

Run `GenerateAttendanceReport` once against the new punchlist. If the department now has
its own output sheet (and no unexpected rows on "Unmapped"), the rename matched. If its
people land on "Unmapped", the `tblSchedule` string still differs from the punchlist
string in words or punctuation — re-copy the punchlist cell verbatim.

## Out of scope

- **No mismatch warning / validation feature.** A future run-time check that flags a
  punchlist department missing from `tblSchedule` was considered and deliberately
  deferred (see the TTSH-wide adoption spec's pre-run validation pillar) — not part of
  this change.
- **No `tblDepartments` indirection / single-source dept table.** Rejected for now: it
  adds a lookup layer to the untested matching core, against the project's
  "keep it debuggable" principle. Revisit only after the tool has a successful live run.
- **No single department-name cell.** Only viable for single-department workbooks;
  current workbooks hold several departments at once.

## Files touched

- `Attendance_Analyzer_Context.md` — add a short "Renaming a department" subsection under
  the schedule/Config documentation, pointing to this procedure.
- Manual step (not in this repo): paste the same procedure text into the workbook's
  `Instructions` sheet (the `.xlsx` is a binary and not editable from this repo — exact
  copy to paste will be provided).
- No `.bas` change, so no `regen_modules.ps1` run and no `Attendance_All_Modules.txt`
  update.
