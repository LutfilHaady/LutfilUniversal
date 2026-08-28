# CLAUDE.md

Guidance for AI agents working in this repository.

## What this repo is

An **Excel VBA macro** that cleans up and reshapes the **FC Training & Assessment
Masterlist** for the Financial Counselling (FC) team at Tan Tock Seng Hospital
(TTSH). The Masterlist tracks FC Fundamentals / eFC Stages / Competency
training records for PSC staff, one row per training/assessment event. This
macro (1) canonicalizes messy Designation values and cleans Department text,
(2) restores a broken "Employment Type" pivot field, (3) reshapes the
long (one row per event) Data Entry sheet into a wide sheet (one row per
Employee No., with repeating columns per competency cycle), and (4)
colour-codes that wide sheet with an accompanying Legend sheet.

There is **no build system, no test runner, and no CLI**. The code is VBA
that runs inside Excel. You cannot execute or verify it from a terminal --
see "Verifying changes".

## CRITICAL: the source workbook is password-protected

`FC Training & Assessment Masterlist.xlsx` is encrypted (open password
`fctraining` as of Jul 2026). It is also **PDPA-sensitive** -- Lutfil
deliberately strips Name/Employee No./ADID/Email before sharing copies of it
in AI tools. Never ask for or expect a copy with real identifying data filled
in; all development and testing here uses synthetic data with fake Employee
Nos that mimic the real column layout.

## CRITICAL: dual-source maintenance

The code exists in **two places that must be kept in sync (logically)**:

1. The individual **`*.bas` module files** in the repo root (the dev source).
2. **`FC_Masterlist_All_Modules.txt`** -- a single concatenation of every
   module. **This is the staff deliverable**: paste it into Excel's VBA
   editor (Alt+F11 -> right-click project -> Import File, or paste each
   module in as its own class/standard module).

**Every code change MUST be applied to BOTH the relevant `.bas` file AND
`FC_Masterlist_All_Modules.txt`.**

## Repository layout

| Path | Purpose |
|------|---------|
| `Helpers.bas` | `FindColByHeader`/`NormHeader` (header lookup), `CleanText` (value cleanup), `LastUsedColumn`/`DescribeUnlabeledColumnsWithData` (data-extent safety net -- see below), Designation Map sheet creation + lookup |
| `DesignationCleanup.bas` | Canonicalizes Designation, cleans Department -- runs **in place** on Data Entry |
| `ReshapeBuilder.bas` | Long -> wide reshape, keyed on Employee No., writes new "Data Entry (Wide)" sheet (non-destructive) |
| `PivotRepair.bas` | Restores the "Employment Type" column, re-points and refreshes PivotCaches so Training Breakdown's `#REF!` GETPIVOTDATA formulas resolve |
| `ColorCoding.bas` | Colour-codes Data Entry (Wide) (row status, Employment Type, Competency Result per cycle) and builds the "Legend" sheet |
| `MainMacro.bas` | `RunFCMasterlistCleanup` -- orchestrates all of the above with a confirmation dialog and summary |
| `docs/FC_Masterlist_Context.md` | Full domain context: schema decisions, Designation Map rationale, open questions |
| `FC_Masterlist_All_Modules.txt` | Concatenated deliverable -- keep in sync with the `.bas` files |

## Architecture conventions (follow these)

- **Resolve columns by header, never by hardcoded index** -- use
  `FindColByHeader(ws, "Header Name")`, same pattern as the MFC VBA project.
  Exception: the four "Assessed By" columns share an identical header, so
  they're resolved positionally as `(Assessment Date column) + 1`, verified
  against the actual workbook layout.
- **Never silently guess a Designation mapping.** If a raw Designation isn't
  in the Designation Map, pass it through `CleanText()`-only and tag the row
  `UNMAPPED - REVIEW` / add it to Data Quality Flags. Only extend the seeded
  map in `Helpers.EnsureDesignationMapSheet` (or let Lutfil edit the
  "Designation Map" sheet directly) with human sign-off, not an inferred guess.
- **Load-process-write in bulk** for the reshape (Range.Value into a Variant
  array, process with Dictionaries/arrays, write back per output row) --
  Data Entry is currently ~500 rows but this should scale without becoming
  per-cell-COM-call slow.
- **Non-destructive reshape.** `ReshapeBuilder` always writes to a new
  "Data Entry (Wide)" sheet; it never modifies Data Entry. `DesignationCleanup`
  and `PivotRepair` DO modify Data Entry in place (that's inherent to the ask
  -- "clean up the master file"), which is why `MainMacro` shows a
  confirmation dialog before running and recommends the user back up first.
- **Blank Employee No. rows never merge with each other.** There's no way to
  know if two blank-key rows are the same person; each stays its own row,
  flagged `NO EMPLOYEE NO.`.
- **Never compute "last column" from the header row alone.** Use
  `Helpers.LastUsedColumn`, not `Cells(1, Columns.Count).End(xlToLeft).Column`
  directly. Data Entry has real, populated columns beyond the last named
  header (see "Code review findings" in the context doc) -- a header-only
  scan silently truncates them out of any range built from it.
- **A single VBA statement tops out at ~24 line continuations (`_`).** Don't
  build large literals (seed data, long lookup tables) as one continued
  statement -- write a small helper Sub/Function and call it once per row/item
  instead (see `Helpers.SeedRow`).
- **Never read a raw cell/array value with a bare `CStr(...)`.** This
  workbook has broken formulas scattered through it (see the `#REF!` pivot
  issue and the unlabeled-column issue above); a cell holding an Excel error
  value (#N/A, #REF!, #VALUE!, etc.) will make a bare `CStr()` raise a
  runtime error whose `Err.Number` equals that error's code (2042 for #N/A --
  this is what surfaced as "error 2042" against the real file). Always use
  `Helpers.SafeStr`/`SafeVal`, and check `Helpers.IsErrorValue` before using a
  value in a direct comparison (`=`/`<>`) or string search. Error cells are
  treated as blank (never used, never silently guessed) and reported via a
  `SOURCE ERROR VALUE` Data Quality Flag naming the affected column(s).
- **ColorCoding.bas's column offsets are hardcoded to match ReshapeBuilder's
  layout** (`STATIC_COLS = 12`, `COLS_PER_CYCLE = 7`,
  `CYCLE_RESULT_OFFSET = 3`). If you change the wide-sheet column layout in
  `ReshapeBuilder.bas`, update these constants in the same commit or the
  colour coding will land on the wrong cells.

## Known open questions (see docs/FC_Masterlist_Context.md for detail)

- No "VAS" designation currently exists anywhere in the data or in the
  original Dropdown & Filter lists -- the Employment Type category exists in
  the pivot schema but nothing maps to it. Confirm with Lutfil whether VAS
  staff should be added, or whether this category is now unused/legacy.
- Several Designation Map entries are seeded with a best-guess canonical form
  and flagged `REVIEW` in the Notes column (e.g. "Senior Nurse" -> which
  grade?, generic "Manager" -> Clinic Manager?). These need a human decision,
  not code.
- The wide-format column layout (7 columns per competency cycle: Year,
  Calendar Year, Result, Date, Attempts, Assessed By, Cert No.) is a
  reasonable default, not a confirmed requirement -- nobody downstream
  consumes this sheet yet (per Lutfil, he's not responsible for the
  visualisation), so the shape can change freely if a real reporting need
  surfaces later.

## Verifying changes (no CLI available)

You cannot run the macro from a terminal, and the source workbook can't be
shared with real data for testing (see PDPA note above). To verify:

1. **Static checks you can do:** `grep` for dangling references to functions
   you removed, duplicate `Sub`/`Function` names, confirm `.bas` <->
   `FC_Masterlist_All_Modules.txt` are in sync.
2. **Algorithm checks:** the grouping/sort/flag logic in `ReshapeBuilder` was
   validated by porting it to a standalone Python script run against
   synthetic data covering: multi-cycle merge, case-insensitive Employee No.
   matching, chronological cycle ordering, unmapped-designation flagging,
   non-merging blank-Employee-No rows, inconsistent-date flagging, resigned-
   text detection (including when it's on a non-latest cycle), and Excel
   error values (#N/A etc.) in both identity fields and the Employee No. key
   itself. All assertions passed. If you change the VBA grouping/sort logic,
   update and re-run the equivalent Python check before considering the
   change verified.
3. **Ask the user to compile:** Alt+F11 -> Debug -> Compile VBAProject.
4. **Ask the user to run** `RunFCMasterlistCleanup` (Alt+F8) against a
   **backup copy** of the real file first, and report the result or any
   popup/error.

## Git / process

- **Only commit when the user explicitly asks.** Do not commit proactively.
- **After every change, output a summary listing each file edited and the
  exact lines/sections changed.** This lets Lutfil apply manual edits without
  having to read diffs.
