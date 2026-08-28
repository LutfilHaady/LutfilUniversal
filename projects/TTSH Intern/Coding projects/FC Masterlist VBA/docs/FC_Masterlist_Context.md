# FC Training & Assessment Masterlist -- Cleanup & Reshape Context

Full domain reference for this build. `CLAUDE.md` is the quick orientation;
this doc has the detail behind each decision.

## Background

`FC Training & Assessment Masterlist.xlsx` (in the TTSH Intern folder) tracks
FC Fundamentals / eFC Stages / Competency training and assessment records for
PSC staff across TTSH. It's a standalone tracking file -- Lutfil is not
responsible for any downstream visualisation or reporting off it, and nothing
else consumes it automatically.

**File is encrypted.** Open password: `fctraining` (as of Jul 2026).

**File is PDPA-sensitive.** The copy used to scope and build this tool has
Name / Employee No. / ADID / Email deliberately blanked out (Lutfil's call,
to avoid exposing real staff data to an AI tool). All design and testing here
was done against synthetic data with the same column layout. The real file,
with real identifiers filled in, should only ever be opened/run through this
macro locally in Excel -- never uploaded anywhere for AI assistance.

## Error 2042 fix + colour coding (Jul 2026, post-first-run against the real file)

Running the macro against the real file (first time with real data, not
synthetic) surfaced a crash: **runtime error 2042 in the ADID section**.
2042 is not a generic VBA error -- it's Excel's internal code for `#N/A`.
Touching a Variant that holds an Excel error value with a bare `CStr()`
raises a runtime error whose number equals that error's own code (2042 for
`#N/A`, 2023 for `#REF!`, 2015 for `#VALUE!`, etc.) rather than a normal type
mismatch. `NzStr` in `ReshapeBuilder.bas` didn't guard against this, and some
cell in the real ADID column holds a real `#N/A` (almost certainly from a
broken lookup formula elsewhere -- consistent with everything else found
already in this workbook: `#REF!` in GETPIVOTDATA, orphaned unlabeled
columns, corrupted conditional-formatting rules referencing `#REF!`).

Fix: `Helpers.SafeStr`/`SafeVal`/`IsErrorValue` -- shared, error-aware
accessors used everywhere a raw cell or array value is read across all five
modules (previously each module had its own ad hoc `CStr(...)` or a
module-private `NzStr`/`NzVal`). An error value is now treated as blank
(never used, never overwrites a good value) and reported via a
`SOURCE ERROR VALUE (e.g. #N/A) in: <column names>` Data Quality Flag,
naming exactly which field(s) were affected for that employee. An error in
Employee No. itself falls into the same "no reliable identifier" bucket as a
blank one (its own singleton row), rather than grouping every error-valued
row together under a literal `"#ERROR"` key.

### Colour coding + Legend sheet

Per Lutfil's request for "maximum colour coding" plus a legend, `ColorCoding.bas`
was added and wired into `MainMacro` as a final step. Two layers, both
described in full on the generated "Legend" sheet (with actual colour
swatches, not just text):

1. **Row-level status colour** (priority order, first match wins; skipped
   entirely for resigned rows since grey already covers it): orange = no
   Employee No., yellow = unmapped Designation, purple = source error value
   found, light blue = onboarding dates inconsistent across the person's own
   rows.
2. **Cell-level tints**, independent of row status: Employment Type cell
   (Nurse/FC Competency Required/Others/unmapped), and each cycle's
   Competency Result cell (green = C, red = NYC, yellow = any other result).
   These still show even on a resigned (grey) row -- pass/fail history stays
   visible regardless of employment status.

`ColorCoding.bas`'s column offsets (`STATIC_COLS = 12`, `COLS_PER_CYCLE = 7`,
`CYCLE_RESULT_OFFSET = 3`) are hardcoded to match `ReshapeBuilder.bas`'s
layout -- if that layout changes, these must be updated in the same change.

Red (native Excel "Highlight Duplicate Values" on the original sheet) and
yellow (confirmed dead formatting debt, per Lutfil) from the ORIGINAL Data
Entry sheet are deliberately not recreated -- documented on the Legend sheet
itself under "not carried over," so this decision doesn't get silently
re-litigated later.

## Code review findings (Jul 2026, post-first-draft)

The first draft of this macro compiled with a "Too many line continuations"
error and was reviewed end to end afterward. Findings, all fixed:

1. **Compile error, `Helpers.bas`.** `EnsureDesignationMapSheet` built its seed
   data as one `Array(...)` literal with 51 line-continuation (`_`)
   characters. VBA caps a single logical statement at ~24 continuations.
   Fixed by replacing it with a `SeedRow` helper called once per row (no
   statement needs more than 1 continuation now).
2. **Silent data loss, `ReshapeBuilder.bas` + `PivotRepair.bas`.** Both
   computed the sheet's last column via
   `Cells(1, Columns.Count).End(xlToLeft).Column`, which only finds the last
   column with a **header**. Checked against the real workbook: Data Entry
   has columns beyond "FC Certificate Number" (as of Jul 2026, columns AB, AC,
   AF) with **no header text but real data** -- column AC alone has a Yes/No
   value in 445 of 511 rows. This is almost certainly the old "Employment
   (Y/N)" field (referenced in the stale pivot cache, see below) with its
   header text lost rather than the column being deleted. The header-only
   scan was silently excluding these from the reshape's read range and from
   the pivot cache's re-pointed source range. Fixed with a new
   `Helpers.LastUsedColumn` that takes the max of the header-row extent and
   the sheet's actual `UsedRange` extent. A new `Helpers.
   DescribeUnlabeledColumnsWithData` now surfaces any such column in the
   final run summary rather than staying silent about it -- it does not try
   to guess what the column means or fold it into the reshape output.
3. **Fragile pivot cache repoint, `PivotRepair.bas`.** `PivotCache.SourceData`
   was being set via a hand-built A1-style address string. Excel's object
   model documents this property as accepting either a `Range` object or a
   String, but the String form is ambiguous about notation (A1 vs R1C1) and
   is the one part of this fix that can't be verified without a live Excel
   session. Changed to assign a `Range` object directly, which removes the
   ambiguity.

This means the "Employment Type / Endorsement Type / Employment (Y/N) /
Remarks / FY" fields referenced by the stale pivot cache (see "Employment
Type / GETPIVOTDATA fix" below) may not all have been deleted -- at least one
(Employment Y/N) is very likely still physically present, just orphaned.
Worth checking the other stale field names against the unlabeled-column
report the macro now prints before assuming they're gone for good.

## Sheet structure (as found, Jul 2026)

| Sheet | Purpose |
|---|---|
| `Data Entry` | The actual training log. ~511 rows x 32 cols. One row per training/assessment event (NOT one row per person). |
| `Pivot`, `Sheet2` | Pivot tables summarizing Data Entry (competency pass/fail counts) |
| `Training Breakdown` | Pivot + GETPIVOTDATA summary table, monthly training counts by Employment Type -- **had `#REF!` errors before this fix** |
| `Passing Rate` | Pivot + summary table, pass rates by month/competency attempt |
| `Dropdown & Filter` | Reference lists: Designation, Nurses, Departments for COO Endorsement, Types of PSAs, Employment (Y/N/NA), Results (C/NYC/NA) |
| `Sheet1` | Empty |

### Data Entry columns (as currently laid out)

`S/N, Employee No., Name, ADID, Designation, Department, Email, Year of
training, Date of FC Fundamentals, Date of eFC Stages, Calendar Year of
Competence, Competency, Date of Competence, No. of Attempts, 1st Assessment
Date, Assessed By, 1st Result, 2nd Assessment Date, Assessed By, 2nd Result,
3rd Assessment Date, Assessed By, 3rd Result, 4th Assessment Date, Assessed
By, 4th Result, FC Certificate Number`

Note "Assessed By" appears 4 times with an identical header -- each instance
sits immediately after its corresponding Assessment Date column. Code
resolves these positionally from that anchor rather than by header lookup
(see `Helpers.bas`).

## Why this isn't a simple "long to wide" pivot

Each employee can appear across **multiple rows** -- one per training/
competency cycle (initial FC Fundamentals/eFC Stages onboarding happens once,
but Competency gets reassessed periodically, so the same person accumulates a
new row roughly every year). The reshape needs to:

1. Group rows by **Employee No.** (the join key -- confirmed with Lutfil;
   Name has known variant-spelling issues, e.g. "binte" vs "bte", that make
   it unreliable as a key on its own).
2. Within each employee's rows, order them chronologically (by Date of
   Competence, falling back to Calendar Year of Competence, then Year of
   training) to assign Cycle 1, Cycle 2, Cycle 3...
3. Collapse the "identity" columns (Name, ADID, Email, Designation,
   Department) to a single value per employee -- **last non-blank wins**,
   walking the rows in chronological order, since these can be filled in
   inconsistently across a person's records (e.g. a promotion mid-way
   through their history should show the latest Designation).
4. Flag rows where something looks wrong rather than silently resolving it:
   - No Employee No. at all -- can't group, stays a singleton row
   - Designation not recognised in the Designation Map
   - FC Fundamentals / eFC Stages date differs across a person's own rows
     (should be constant -- a mismatch usually means a data entry error)

### Output layout: `Data Entry (Wide)`

Static columns (1 per employee): `Employee No., Name, ADID, Email,
Designation (Canonical), Department, Employment Type, Date of FC
Fundamentals, Date of eFC Stages, No. of Training Records, Resigned, Data
Quality Flags`.

**Resigned column + grey row fill.** The original Data Entry sheet greys out
resigned staff via a conditional-formatting rule keyed on an "Employment
(Y/N)" column. That column is now completely empty (confirmed: 0 of 511 rows
have anything in it) -- the rule is dead and can't be revived from that
source. Substitute confirmed with Lutfil: 84 rows have literal `"Resigned"` /
`"Resign and left on ..."` text typed into the FC Certificate Number column
instead. Any employee with that text in ANY of their merged rows gets
`Resigned = "Yes"` and the whole output row filled grey (`RGB(166,166,166)`,
an approximation of the original's conditional-format grey, applied as a
flat fill rather than a live rule since there's nothing left to condition
on).

**Red duplicate-highlighting is not recreated.** The original sheet's red
highlighting is Excel's built-in "Highlight Duplicate Values" rule on
Employee No., not a custom rule. It's moot on the wide sheet by construction
-- duplicate Employee Nos are exactly what gets merged into one row, so
there's nothing left to flag as a duplicate there.

**Yellow highlighting was not investigated further.** Its rules are formula
based (e.g. `AND($C3<>ISNA($C3),$B2=ISNA($B2))`) and heavily corrupted with
`#REF!` errors from historical row insertions/deletions. Per Lutfil, this is
dead formatting debt -- not carried into the reshape.

Then repeating blocks, one per competency cycle found (`Cycle 1`, `Cycle 2`,
... up to whatever the highest count is across all employees), 7 columns
each: `Year of Training, Calendar Year of Competence, Competency Result,
Date of Competence, No. of Attempts, Assessed By (Final), FC Certificate
Number`. "Assessed By (Final)" takes the assessor from the last non-blank
attempt round (1st/2nd/3rd/4th) for that cycle, rather than exporting all 4
rounds -- in the real data, 2nd+ attempts are rare (76 of 511 rows have a 2nd
assessment, 7 have a 3rd, 1 has a 4th), so per-attempt detail is preserved in
the untouched original Data Entry sheet if anyone needs it; the wide sheet
optimizes for "what actually happened" per cycle.

**This layout is a reasonable default, not a locked requirement** -- since
nobody downstream consumes this sheet yet, it can change if a real reporting
need surfaces.

## Designation cleanup

The raw Designation column has heavy inconsistency: case variants ("PATIENT
SERVICE ASSOCIATE EXECUTIVE" vs "Patient Service Associate Executive"),
non-breaking spaces, double spaces, trailing periods, pluralization typos
("Management Associates" vs "Management Associate"), and Roman-numeral typos
("Senior Nurse ll" instead of "II"). This is the "spaces, formatting" part of
the original cleanup ask.

Fix: a **"Designation Map" sheet** (created by the macro on first run, left
alone on every subsequent run) with columns `Raw variant | Canonical
designation | Employment Type | Notes`, seeded with every variant found in
the current data as of Jul 2026. `DesignationCleanup.bas` looks up each raw
value (case/whitespace-insensitive) and replaces it with its canonical form.
**Anything not in the map is left as cleaned-but-unchanged text** and flagged
`UNMAPPED - REVIEW` -- the macro never invents a mapping on its own.

Several seeded entries are themselves flagged `REVIEW` in the Notes column
because the canonical mapping required a judgment call this project
shouldn't make silently:

- "Senior Nurse" / "Staff Nurse" / "Sr Staff Nurse" (no grade suffix) --
  mapped to grade I as a default guess. Confirm actual grades with HR/roster
  if precision matters.
- "Manager" (generic) -- mapped to "Clinic Manager" as a guess.
- "Management  Intern" -- mapped to "Management Associate"; confirm this is
  the right bucket (an intern designation is a real edge case, not
  necessarily equivalent to a Management Associate).

Edit the "Designation Map" sheet directly to correct any of these -- the
macro will use your edits on the next run.

## Employment Type / GETPIVOTDATA fix

Training Breakdown's monthly-by-category formulas
(`=GETPIVOTDATA("Date of eFC Stages",...,"Employment Type\n(FC/Nurse/VAS/
Others)","FC Competency Required",...)`) were returning `#REF!`. Root cause,
confirmed against the workbook: the pivot caches (`Pivot`, `Sheet2`) were
built when Data Entry had an "Employment Type (FC/Nurse/VAS/Others)" column
that has since been removed from the sheet -- along with "Endorsement Type",
"Employment (Y/N)", "Remarks", and "FY (Training complete)", which also no
longer exist. Only Employment Type is restored here since it's the only one
the live GETPIVOTDATA formulas actually reference.

Fix: `PivotRepair.bas` re-inserts an "Employment Type\n(FC/Nurse/VAS/Others)"
column into Data Entry (derived from each row's canonical Designation via the
Designation Map), re-points every PivotCache that sources from Data Entry to
the new full range, and refreshes. The GETPIVOTDATA formulas are not touched
directly -- they resolve on their own once the field exists again under the
same header text.

**No "VAS" designation exists anywhere** in the current data or in the
original Dropdown & Filter lists (checked against the "Nurses" and
"Designation" reference lists on that sheet). Every current Designation maps
to either "Nurse", "Others" (management/admin roles), or "FC Competency
Required" (everyone else -- the PSA-track roles). If VAS staff are supposed
to be tracked here, either they're missing from the dataset entirely, or the
category is legacy/unused now -- worth confirming rather than assuming.

## Verification approach

No VBA runtime is available in this environment, and the real file can't be
shared here (PDPA). Verification was done by:

1. Porting the `ReshapeBuilder` grouping/sort/flag algorithm to a standalone
   Python script and running it against synthetic data exercising: multi-
   cycle merge for one employee, case-insensitive Employee No. matching,
   chronological cycle ordering, an unmapped designation (must flag, not
   guess), two rows with blank Employee No. (must NOT merge into one group),
   and an inconsistent FC Fundamentals date across a person's rows (must
   flag). All assertions passed.
2. Static review of the `.bas` files for VBA gotchas already documented in
   the MFC VBA project (`IIf` non-short-circuit, 1-based `.Value` arrays,
   `FindColByHeader` returning 0).

**Still needed:** compile-check in the real VBA editor (Alt+F11 -> Debug ->
Compile VBAProject), then a real run against a **backup copy** of the actual
file, since pivot cache re-pointing in particular (`PivotCache.SourceData =
...`) is the one operation here that behaves differently across Excel
versions and is worth confirming works as expected before trusting it against
the live file.

## How to run

1. Back up `FC Training & Assessment Masterlist.xlsx` first -- Designation
   cleanup and the Employment Type restore edit Data Entry in place.
2. Open the file (password `fctraining`), Alt+F11, import all `.bas` modules
   (or paste `FC_Masterlist_All_Modules.txt` in as one module).
3. Alt+F8 -> `RunFCMasterlistCleanup` -> confirm the dialog.
4. Review the summary MsgBox, then check:
   - "Designation Map" sheet for any `UNMAPPED - REVIEW` rows
   - "Data Entry (Wide)" sheet's "Data Quality Flags" column
   - Training Breakdown -- confirm the `#REF!` errors are gone
