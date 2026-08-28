# FC Completion Report Macro -- Design Spec

Date: 2026-06-10
Status: Draft for review

## 1. Purpose & Scope

Automate the Monthly FC Completion Report for the Financial Counselling team at TTSH.
Two eFC exports (File A: FC Summary Report, File B: Inflight Missed FC Report) are
cleaned, deduplicated, and combined to calculate FC completion statistics by team and
status category, producing a formatted `.xlsx` report for the monthly department
meeting.

Same UI/UX pattern as the existing MFC VBA macro: FilePickerForm (modeless dashboard,
2 input slots), ProgressForm (modeless progress bar), Application.StatusBar updates,
MsgBox for errors/warnings/final summary, Application.FileDialog for all file
selection (no hardcoded paths), hidden Config sheet for editable lists.

## 2. Inputs

### File A -- FC Summary Report

Confirmed columns (A-AZ), in order:

```
A  FC ID                                  AA NeFR Consent Status
B  Institution                            AB NeFR Consent Status Date
C  Encounter No                           AC MCAF-M Authorisation Status
D  MRN                                    AD MCAF-M Authorisation Status Date
E  FC Mode                                AE MCAF-S Consent Status
F  FC Status                              AF Incurred Charges
G  FC Created By                          AG Ward Services
H  FC Created On                          AH Surgical Procedure
I  FC Last Updated By                     AI Implants
J  FC Last Updated On                     AJ Consumable
K  Admission Date                         AK Rehabilitation charges
L  Admission Type                         AL Diagnostics, Medications & Other
M  Admission Status                          Services charges
N  Specialty                              AM Facilities Fees
O  Point Of Care                          AN Programme Fees
P  Subv Doc Type                          AO Other Services
Q  Patient Name                           AP Others - Likely
R  Level Of Care                          AQ Others - Complex
S  Accomodation Code                      AR Surgical Code
T  LOS - General Ward                     AS 1st CCF Creation User
U  LOS - HD                               AT 1st CCF Creation Date-Time
V  LOS - ICU                              AU 1st CCF LOS
W  LOS - Likely for IMH                   AV 1st CCF ETBS
X  LOS - Complex for IMH                  AW Latest CCF Creation User
Y  FC Exemption                           AX Latest CCF Creation Date-Time
Z  At-Risk Status                         AY Latest CCF LOS
                                           AZ Latest CCF ETBS
```

All columns resolved via `FindColByHeader` -- letters above are for reference only,
never hardcoded.

`Latest CCF Creation Date-Time` (and `1st CCF Creation Date-Time`, `FC Created On`,
`FC Last Updated On`, `Admission Date`) arrive as **text** in **D/M/Y h:mm:ss AM/PM**
format (e.g. `"1/12/2026 11:08:44 AM"` = 1 Dec 2026). Must be parsed explicitly with
this format -- never rely on locale-dependent `CDate`.

### File B -- Inflight Missed FC Report

Confirmed columns (A-AW), in order:

```
A  FC ID                                  P  At-Risk Status
B  Institution                            Q  Created By
C  Encounter No                           R  Created On
D  MRN                                    S  Last Updated By
E  Residential Type                       T  Last Updated On
F  Patient Name                           U  Performed FC in past X days
G  Admission Type                         V  1st FC Create User
H  Admission Date                         W  1st FC Create Date
I  Admission Status                       X  1st FC ETBS (Likely)
J  Specialty                              Y  1st FC ETBS (Complex)
K  Point Of Care                          Z  1st FC Estimated Likely OOP (SGD)
L  Admission Level Of Care                AA 1st FC Estimated Complex OOP (SGD)
M  Accommodation Code                     AB 1st FC LOS
N  NeFR Consent Status                    AC 1st FC Specialty
O  NeFR Consent Status Date               AD 1st Incurred Charges
                                           AE Latest FC Create User
                                           AF Latest FC Create Date
                                           AG Latest FC ETBS (Likely)
                                           AH Latest FC ETBS (Complex)
                                           AI Latest FC Estimated Likely OOP (SGD)
                                           AJ Latest FC Estimated Complex OOP (SGD)
                                           AK Latest FC LOS
                                           AL Latest FC Specialty
                                           AM Latest Incurred Charges
                                           AN Surgical Code
                                           AO Missed FC
                                           AP Re-FC to be performed
                                           AQ FC Status
                                           AR-AW Bill-size variance columns
```

**Confirmed: File B has NO `FC Mode` column.** Step 1 of the File B workflow
("filter FC Mode if column exists") is a documented no-op for this export format.

Columns `FC Status`, `Re-FC to be performed`, `Performed FC in past X days`, the
1st/Latest FC Create User/ETBS/OOP/LOS/Specialty/Incurred Charges columns, and the
bill-size-variance columns belong to a different analysis (re-FC / bill variance
tracking) and are **not used** by this report's filtering or calculations. They are
preserved as-is in the output (input columns == output columns, nothing dropped).

## 3. Config Sheet

Hidden sheet, created once via a setup sub (per existing MFC pattern). Holds an
editable staff roster so staff can update team assignments without touching VBA. An
empty roster is valid (treated as "no members yet" -- everyone falls to "Others").

**Staff roster table** (one row per staff member):

| Staff Name | Team |
|---|---|
| (e.g. "Tan Cher Wee") | `ED/EDFC` |
| (e.g. "Lim Bee Choo") | `Inflight` |
| (e.g. "Wong Mei Ling") | `NCID AO` |
| ... | `ICH PSO`, `Admin/Managers`, ... |

`Team` is free text but the macro recognises a fixed set of canonical values for
calculation purposes: `ED/EDFC`, `Inflight`, `NCID AO`, `ICH PSO`, `Admin/Managers`.
Any `Latest CCF Creation User` / `FC Created By` name not found in the roster (and
non-blank) falls into "Others (e.g. SOC staff)" by elimination.

Name matching is case-insensitive and trimmed (`Scripting.Dictionary` with
`CompareMode = vbTextCompare`, or `UCase(Trim(...))`).

EDVW handling: **resolved, no Config entry needed** (see section 5).

## 4. File A Processing Pipeline

All steps operate on a `Variant` array loaded once from the input range; logic runs
in memory; results written back in one assignment (per architecture conventions).

1. **Filter FC Mode.** Keep rows where `FC Mode` (case-insensitive) is
   `"Financial Counselling - AH"` or `"Financial Counselling - Downtime"`. Delete all
   others (Shopper, etc.).

2. **Delete Cancelled admissions.** Delete rows where `Admission Status = "Cancelled"`
   (case-insensitive).

3. **Compute helper columns** for every remaining row:
   - **PRIORITISE** (numeric, see table below), based on case-insensitive match of
     `FC Status`. Anything not matching levels 1-9 (including "Voided"/"Deleted")
     gets **99**.
   - Parse `Latest CCF Creation Date-Time` (D/M/Y text, may be blank for Draft FCs)
     into:
     - **For Blank CCF Date-Time** -- the parsed datetime, or a filled placeholder if
       the source is blank (placeholder sorts to the end of its encounter group --
       see step 4).
     - **Latest CCF Creation Date** -- date part of the above.
     - **Latest CCF Creation Time** -- time part of the above.

   | Priority | FC Status (case-insensitive match) |
   |---|---|
   | 1 | Completed |
   | 2 | Acknowledgement by other means |
   | 3 | Attempted - Virtual FC Completed, pending signature |
   | 4 | Attempted - patient/NOK declines to sign |
   | 5 | Attempted - Patient is unable to sign |
   | 6 | Attempted - unable to complete |
   | 7 | Draft (CCF Generated) |
   | 8 | Draft (ETBS Generated) |
   | 9 | Draft |
   | 99 | (default -- anything else, incl. Voided/Deleted) |

4. **Sort.** Primary key: `Encounter No` ascending. Secondary key:
   `Latest CCF Creation Date` + `Latest CCF Creation Time` ascending (blank/placeholder
   sorts last within its encounter group). Result: each encounter's rows are grouped
   together, latest CCF at the bottom of the group.

5. **Highlight duplicate Encounter Numbers.** Apply red fill to all cells in the
   `Encounter No` column where the encounter number appears more than once (visual
   aid for staff).

6. **Automated deduplication.** For each encounter group:
   - If the group has >1 row, identify any row(s) where `FC Created By` matches a
     name in the staff roster (Config) with `Team = Inflight`. Exclude these rows
     from "kept" candidacy **unless doing so would exclude every row in the group**
     (in which case ignore this exception and consider all rows).
   - Among the remaining candidate rows, select the one with the lowest `PRIORITISE`
     value. If multiple rows tie on the lowest `PRIORITISE`, select the one with the
     **largest FC ID** (exact comparison, not row position).
   - Mark the selected row `YES` (column: `YES for Unique + Highest Priority`); mark
     all other rows in the group `NO`.
   - If the group has exactly 1 row, mark it `YES` regardless of its `PRIORITISE`
     value (including 99 -- see "voided-only" handling below).

7. **Delete all rows marked `NO`.** This fully automates what the manual workflow
   did via mass-delete + manual review (no manual review step remains). The count of
   deleted rows is recorded for the audit summary.

8. **Voided-only encounters.** After step 7, any remaining row with `PRIORITISE = 99`
   represents an encounter whose *only* FC ID was Voided/Deleted. These rows are
   **removed from the working dataset** (excluded from the denominator entirely, per
   CLAUDE.md) but **counted separately** and reported as an audit footnote, e.g.
   *"N encounters had only a Voided/Deleted FC ID -- excluded from denominator, review
   if FC still needed."*

9. **EM/EL split into two separate sheets**, based purely on `Admission Type`:
   - **Emergency (EM):** `Admission Type = "Emergency"` (case-insensitive) -> goes to
     the `FCSummaryReport_EM_<Month><Year>` sheet.
   - **Elective for NCID AO (EL):** `Admission Type = "Elective Inpatient"`
     (case-insensitive) -> goes to the `FCSummaryReport_EL_<Month><Year>` sheet.
   - **Defensive catch-all:** any row whose `Admission Type` is neither of the above
     is **not written to either sheet**, but **counted and reported as an audit
     footnote** (e.g. "N rows excluded -- unrecognised Admission Type"). This should
     normally be zero given the export-time filter (CLAUDE.md), but the conservative
     principle applies: nothing silently disappears.
   - **EM/EL classification cross-check (audit column, informational only):** on both
     sheets, look up the closing staff member's `Team` from the Config roster (using
     `Latest CCF Creation User`, falling back to `FC Created By` if blank -- same
     fallback as section 7B) and flag rows where it disagrees with the bucket -- e.g.
     an EM row closed by `NCID AO` staff, or an EL row closed by `ED/EDFC`/`Inflight`
     staff. Does not change the bucket; purely surfaces possible misclassifications
     for staff to review.

Both resulting in-memory datasets (1 row per valid encounter each) are used for
sections 6-7 below. Denominator/numerator/breakdown calculations (section 7) are
computed **per sheet** (separate EM and EL totals) as well as combined, since EM and
EL serve different teams/audiences.

## 5. File B Processing Pipeline

1. ~~Filter FC Mode~~ -- **N/A**, column does not exist in this export format.

2. **Filter to missed FC.** Keep rows where `Missed FC = "Yes"`.

3. **Delete Cancelled/Planned.** Delete rows where `Admission Status = "Cancelled"`
   or `Admission Status = "Planned"`.

4. **EDVW.** Resolved -- **no exclusion**. EDVW-discharged patients
   (`Point Of Care = "TTSH Virtual Ward"` AND `Accommodation Code = "EDVW"`) are
   genuine missed-FC cases and are counted normally. An `EDVW` flag column
   (informational only, no effect on counts) is **included** so staff can see how
   many follow-up items are EDVW cases.

5. Remaining rows = genuinely missed FC. **Row count** is added to the denominator
   (section 7). The filtered rows themselves (all original columns preserved, plus
   the `EDVW` flag) form the `MissedFC_<Month><Year>` follow-up list output sheet --
   this is the actionable to-do list for EDFC/Inflight/NCID AO.

## 6. Output Workbook Structure

New `.xlsx` workbook, saved via `Application.FileDialog(msoFileDialogSaveAs)`
(no hardcoded path). Suggested default file name:
`FCSummaryReport_<Month><Year>.xlsx` (e.g. `FCSummaryReport_Jul2025.xlsx`).

**Sheet 1a -- `FCSummaryReport_EM_<Month><Year>`** and
**Sheet 1b -- `FCSummaryReport_EL_<Month><Year>`** (e.g. `FCSummaryReport_EM_Jul2025`,
`FCSummaryReport_EL_Jul2025`): final deduplicated File A dataset, split into Emergency
and Elective/NCID-AO subsets (section 4 step 9). Both sheets share the same column
layout -- the input File A layout with helper columns inserted:

```
A  FC ID
B  Institution
C  Encounter No
D  MRN
E  FC Mode
F  FC Status
G  PRIORITISE                      <- new
H  YES for Unique + Highest Priority   <- new
I  FC Created By
... (all other original File A columns, shifted right by 2) ...
   Latest CCF Creation Date-Time
   For Blank CCF Date-Time          <- new
   Latest CCF Creation Date         <- new
   Latest CCF Creation Time         <- new
   Latest CCF LOS
   Latest CCF ETBS
```

Plus the EM/EL classification cross-check column (section 4, step 9) appended at the
end.

**Sheet 2 -- `MissedFC_<Month><Year>`** (e.g. `MissedFC_Jul2025`): cleaned File B
follow-up list. All original File B columns preserved, plus the `EDVW` flag column
appended at the end.

**Sheet 3 -- `Summary_<Month><Year>`** (e.g. `Summary_Jul2025`): the colour-coded
completion breakdown and % breakdown by closing team (section 7), computed for EM,
EL, and combined, plus audit footnotes (voided-only count, unrecognised-Admission-Type
count, EM/EL classification mismatches, duplicate-rows-deleted count).

**Sheet 4 -- `Methodology`**: see section 7D for the comprehensive
"what counts as Missed FC / Not Completed" reference (generated by the macro each
run, so it always matches the logic that produced the numbers).

## 7. Calculations

**Denominator** = (count of Sheet 1 rows, i.e. valid deduplicated encounters,
excluding voided-only) + (count of Sheet 2 rows, i.e. genuinely missed FC).

All of A, B, C below are computed **three times**: once for EM (Sheet 1a + the
Emergency portion of Sheet 2), once for EL (Sheet 1b + the Elective portion of
Sheet 2), and once combined.

**A. Colour-coded completion breakdown** (counts + % of denominator):

| Colour | Group Label | PRIORITISE values |
|---|---|---|
| Green | FC Completed with written acknowledgement | 1, 2 |
| Light Green | CCF Explained but not signed | 3 |
| Orange | Attempted, no further follow-up / not completed | 4, 5 |
| Red | FC Not Completed / Missed FC | 6, 7, 8, 9 (Sheet 1a/1b) + all of Sheet 2 |

(99/voided-only and unrecognised-Admission-Type rows excluded from denominator
entirely, reported separately as audit footnotes.)

**B. % breakdown by who closed the CCF.** For every Sheet 1a/1b row, categorize by
`Latest CCF Creation User` against the Config roster `Team` (ED/EDFC / Inflight /
NCID AO / Admin/Managers / ICH PSO / Others-by-elimination). **If `Latest CCF Creation
User` is blank**
(pure Draft, no CCF ever generated), **fall back to `FC Created By`** for
categorization -- see worked example below. Sheet 2's row count becomes the
"CCF not generated" bucket. All buckets sum to the denominator.

*Example for the fallback:* Encounter X's surviving row has `FC Status = "Draft"`
(priority 9), `FC Created By = "Tan Cher Wee"` (a staff member with `Team = ED/EDFC`
in the roster), and `Latest CCF Creation User` = blank (no CCF was ever generated, so
there's no "latest CCF creator" to read). Without a fallback, this encounter couldn't
be placed into any of the Inflight/Admin/ED/AO/ICH PSO/Others buckets in breakdown
B -- it would be invisible to that table even though it's still part of the
denominator (counted as Red in breakdown A). The fallback says: in this situation,
use `FC Created By`
instead, so Encounter X counts toward "ED staff" in breakdown B (crediting/charging
the team that at least started the FC). This only affects breakdown B's bucketing --
it has **no effect** on breakdown A (still Red, based on PRIORITISE) or on whether
the encounter is "Missed FC" (it isn't -- an FC ID exists, just incomplete).

**C. Numerator detail table** (per CLAUDE.md):

| Metric | Column | Roster Team |
|---|---|---|
| FC completed by EDFC (initial) | `FC Created By` | `ED/EDFC` |
| FC completed by EDFC (full CCF) | `Latest CCF Creation User` | `ED/EDFC` |
| FC completed by Inflight | `Latest CCF Creation User` | `Inflight` |
| FC completed by NCID AO | `Latest CCF Creation User` | `NCID AO` |

Indicators 2-4 are the same counts as breakdown B's per-team buckets (for those three
teams specifically).

**D. Comprehensive "Missed FC / Not Completed" criteria (the `Methodology` sheet).**
Generated by the macro every run so it always matches the logic actually applied.
Conservative principle throughout: when in doubt, count an encounter as
not-completed/missed rather than completed -- it's better to overstate outstanding
work than understate it. An encounter is counted in the **Red** (not-completed/missed)
bucket if **any** of the following hold:

1. It appears in `MissedFC_<Month><Year>` (Sheet 2): File B row with
   `Missed FC = "Yes"`, `Admission Status` not Cancelled/Planned. Includes EDVW
   discharges (no exclusion).
2. Its surviving File A row (Sheet 1a/1b) has `PRIORITISE` in {6, 7, 8, 9}:
   - 6 = Attempted - unable to complete
   - 7 = Draft (CCF Generated)
   - 8 = Draft (ETBS Generated)
   - 9 = Draft (FC ID created, nothing else)
3. (Edge case, section 9 item 5) Its surviving row was selected over a
   higher-priority (Completed/Acknowledged) Inflight-created duplicate, per the
   Inflight-exception rule -- if this causes the surviving row's `PRIORITISE` to fall
   into {6,7,8,9}, it is counted as Red per rule 2 (no special carve-out).

An encounter is **excluded from the denominator entirely** (not counted as either
completed or missed) only if:

- Its only File A row(s) all have `PRIORITISE = 99` (Voided/Deleted) -- "voided-only",
  reported as a separate audit count (section 4 step 8).
- Its `Admission Type` is neither "Emergency" nor "Elective Inpatient" --
  "unrecognised Admission Type", reported as a separate audit count (section 4 step
  9). Expected to be zero given the export-time filter.

The `Methodology` sheet lists these rules verbatim plus the actual counts produced
for each rule this run (e.g. "Rule 1: 14 encounters", "Rule 2 (priority 6): 3
encounters", ...), so staff can trace every number back to a rule.

## 8. Module Structure

| Module | Responsibility |
|---|---|
| `MainMacro.bas` | `GenerateFCCompletionReport` -- orchestrates all steps |
| `Helpers.bas` | `FindColByHeader`, `NormHeader`, `PickFile`, date-text parsing (D/M/Y), `CreateConfigSheet` |
| `FilterFileA.bas` | File A steps 1-2 (mode/cancelled filters), helper-column computation, sort |
| `DeduplicateEncounters.bas` | PRIORITISE table, automated dedup (incl. Inflight exception, FC ID tie-break), voided-only tracking |
| `FilterFileB.bas` | File B steps 2-3 (missed FC filter, cancelled/planned), EDVW flag |
| `BuildOutput.bas` | Creates output workbook/sheets (1a/1b/2/3/4), writes data, colour-coding, % breakdown, audit footnotes, generates `Methodology` sheet |
| `FilePickerForm.bas` | Dashboard UserForm (2-slot version of MFC macro's form) |
| `ProgressForm.bas` | Modeless progress bar (reused from MFC macro) |
| `FCCompletion_All_Modules.txt` | Concatenated deliverable (kept in sync with all `.bas` files) |

## 9. Open Items / Decisions Log

Resolved during review:

1. **Sheet/file naming** -- resolved. Output file `FCSummaryReport_<Month><Year>.xlsx`
   (e.g. `FCSummaryReport_Jul2025.xlsx`). Sheets: `FCSummaryReport_EM_<Month><Year>`,
   `FCSummaryReport_EL_<Month><Year>` (per user request, EM/EL split into two
   sheets), `MissedFC_<Month><Year>`, `Summary_<Month><Year>`, `Methodology` (last
   three names chosen by Claude per user's "up to you").
2. **Blank `Latest CCF Creation User` fallback** -- resolved, with worked example
   added to section 7B (fall back to `FC Created By`; affects breakdown B bucketing
   only, no effect on Red/Missed classification).
3. **EM/EL classification cross-check** -- implemented as proposed (informational
   audit column, no behavior change). Not explicitly objected to; flag here if you'd
   rather drop it.
4. **EDVW flag column** in `MissedFC_<Month><Year>` -- resolved, included.
5. **Inflight-exception edge case** -- resolved via the conservative principle
   ("count more as missed/not-completed rather than less", per user direction): the
   rule from section 4 step 6 is implemented **as originally specified, with no
   special carve-out** -- see section 7D rule 3. If an Inflight-created
   Completed/Acknowledged row gets dropped in favour of a lower-priority non-Inflight
   row, the encounter is simply counted as Red (not completed). This is acceptable
   under the conservative principle and avoids over-engineering a rare case. Should
   still be sanity-checked against real data during testing (does this actually occur,
   and how often).
6. **EM/EL split mechanism and Config roster format** -- resolved. The split is based
   purely on `Admission Type` (Emergency -> EM, Elective Inpatient -> EL); the
   earlier proposal to base it on the closing staff's roster team was not adopted.
   The Config sheet's five separate staff-name lists are consolidated into a single
   `Staff Name | Team` roster table (section 3); `NCID_PointOfCare_EL` is removed as
   it is no longer used. The EM/EL classification cross-check (informational, item 3
   above) now compares the Admission-Type-based bucket against the closing staff's
   roster `Team`.
