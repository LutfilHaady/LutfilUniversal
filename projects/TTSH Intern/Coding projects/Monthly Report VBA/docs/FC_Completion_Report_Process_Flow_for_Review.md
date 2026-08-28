# FC Completion Report -- Process Flow (For Review)

This document describes how the new FC Completion Report tool will process the
monthly eFC exports and calculate the completion statistics. Please read through
and confirm whether the rules below match how the report should actually work --
specific questions are listed at the end.

---

## 1. Inputs

Two eFC exports are used:

- **File A -- FC Summary Report**: one row per FC ID, full month, Admission Type
  Emergency (+ Elective Inpatient for NCID AO).
- **File B -- Inflight Missed FC Report**: Inflight FC Report with the "Missed FC"
  indicator ticked.

---

## 2. File A -- Cleaning and Deduplication

The tool processes File A in this order:

1. **Remove non-FC rows.** Keep only rows where FC Mode is "Financial Counselling -
   AH" or "Financial Counselling - Downtime". (Removes Shopper-mode and other
   irrelevant rows.)

2. **Remove cancelled admissions.** Any row where Admission Status = "Cancelled" is
   dropped.

3. **Rank each remaining row by FC Status**, using this priority order (1 = best,
   higher number = worse):

   | Priority | FC Status |
   |---|---|
   | 1 | Completed |
   | 2 | Acknowledgement by other means |
   | 3 | Attempted - Virtual FC Completed, pending signature |
   | 4 | Attempted - patient/NOK declines to sign |
   | 5 | Attempted - Patient is unable to sign |
   | 6 | Attempted - unable to complete |
   | 7 | Draft (CCF Generated) |
   | 8 | Draft (ETBS Generated) |
   | 9 | Draft (FC ID created, nothing else) |
   | 99 | Anything else, including Voided/Deleted |

4. **Group rows by Encounter Number** and sort each group so the most recently
   created CCF is last.

5. **Highlight duplicate encounter numbers in red** -- this is just a visual aid so
   staff can see at a glance which encounters had more than one FC ID.

6. **Pick one row to keep per encounter.** For each encounter with more than one FC
   ID:
   - First, set aside any row created by an **Inflight** staff member (per the staff
     roster) -- *unless* that would remove every row for the encounter, in which case
     this step is skipped.
   - From what's left, keep the row with the **best (lowest) priority number** from
     the table above.
   - If there's a tie, keep the one with the **larger FC ID** (i.e. the more recently
     created one).
   - If an encounter only has one FC ID to begin with, that row is always kept
     (even if its priority is 99).

7. **Delete every row that wasn't kept.** This replaces the old manual "review
   duplicates and delete" step entirely -- the tool does it automatically using the
   rule above.

8. **Encounters where the only FC ID was Voided/Deleted (priority 99)** are removed
   from the count entirely (not counted as completed, not counted as missed). The
   tool reports how many of these there were, so staff can double-check whether an FC
   is still needed for those encounters.

9. **Split the remaining rows into two sheets, based on Admission Type:**
   - **Emergency** admissions -> "EM" sheet
   - **Elective Inpatient** admissions -> "EL" sheet (this is the NCID AO workload)
   - Any row that is neither (shouldn't normally happen, given the export filters)
     is set aside and reported separately so nothing silently disappears.
   - As an extra check (informational only, doesn't change which sheet a row goes
     to), the tool flags rows where the bucket "looks wrong" -- e.g. an Emergency
     row that was actually closed by an NCID AO staff member, or an Elective row
     closed by ED/EDFC or Inflight staff. This is just a flag for staff to review.

---

## 3. File B -- Cleaning (Missed FC List)

1. **Keep only rows where "Missed FC" = Yes.**

2. **Remove Cancelled and Planned admissions** (Cancelled = upstream cancellation;
   Planned = patient never actually admitted).

3. **Flag EDVW discharges** (Point Of Care = "TTSH Virtual Ward" and Accommodation
   Code = "EDVW") with an informational column -- these are still counted as missed
   FC like everything else, just labelled so staff can see how many are EDVW cases.

4. **Everything left over = genuinely missed FC.** This becomes the follow-up list
   for EDFC/Inflight/NCID AO, and each row counts toward the "Missed FC" total.

---

## 4. Staff Roster (Config)

A single editable table -- **Staff Name -> Team** -- where Team is one of:
ED/EDFC, Inflight, NCID AO, ICH PSO, Admin/Managers. Anyone not on the list is
treated as "Others" (e.g. SOC staff).

This roster is used in three places:
- Step 6 above (deciding which duplicate row to keep -- the "Inflight" exception).
- The EM/EL "looks wrong" flag in Step 9 above.
- The "who closed the CCF" percentage breakdown (Section 5 below).

---

## 5. How the Numbers Are Calculated

**Denominator** (total encounters counted) = (encounters kept after File A
deduplication, excluding voided-only) + (genuinely missed FC count from File B).

**A. Completion status breakdown** (counts and % of denominator):

| Colour | Meaning | Based on priority |
|---|---|---|
| Green | FC Completed with written acknowledgement | 1, 2 |
| Light Green | CCF explained but not signed | 3 |
| Orange | Attempted, no further follow-up | 4, 5 |
| Red | Not Completed / Missed FC | 6, 7, 8, 9, plus all of File B's missed list |

**B. Who closed the CCF** -- each File A encounter is categorized by the team of
whoever has "Latest CCF Creation User" (using the staff roster). If that field is
blank (i.e. no CCF was ever generated -- pure Draft), the tool falls back to "FC
Created By" instead, so the encounter is still credited to *some* team rather than
disappearing from this breakdown. File B's missed-FC count becomes its own "CCF not
generated" bucket.

**C. Numerator detail table** (counts used for team workload reporting):

| Metric | Based on | Team |
|---|---|---|
| FC completed by EDFC (initial) | FC Created By | ED/EDFC |
| FC completed by EDFC (full CCF) | Latest CCF Creation User | ED/EDFC |
| FC completed by Inflight | Latest CCF Creation User | Inflight |
| FC completed by NCID AO | Latest CCF Creation User | NCID AO |

**General principle:** when a case is ambiguous or borderline, the tool counts it as
**not completed / missed** rather than completed. The idea is that it's better to
slightly overstate outstanding work than to understate it.

All of A, B, and C above are calculated three times: once for Emergency, once for
Elective/NCID AO, and once combined.

---

## 6. What You'll Get (Output File)

A new Excel workbook with:

1. **EM sheet** -- cleaned, deduplicated Emergency encounters (one row per encounter)
2. **EL sheet** -- same, for Elective/NCID AO encounters
3. **Missed FC sheet** -- the follow-up list from File B
4. **Summary sheet** -- the colour-coded breakdown and % breakdowns from Section 5,
   for EM, EL, and combined, plus footnotes for anything excluded (voided-only
   encounters, unrecognised Admission Types, EM/EL flags, etc.)
5. **Methodology sheet** -- a plain-language explanation of exactly which rule
   counted each encounter as completed/missed, with the actual numbers for this
   month, so every figure can be traced back to a rule.

---

## 7. Please Confirm

1. **EM/EL split** -- is it correct that the only thing that decides whether an
   encounter goes into the EM (Emergency) or EL (Elective/NCID AO) report is the
   **Admission Type** field, with no other conditions (e.g. ward/Point Of Care)?

2. **FC Status priority order** (Section 2, step 3) -- is this the correct order of
   "best to worst" outcome for an FC?

3. **Inflight duplicate-resolution rule** (Section 2, step 6) -- when an encounter
   has multiple FC IDs and one was created by Inflight staff, should that one be
   set aside in favour of a non-Inflight FC ID (even if the Inflight one has a
   better status)?

4. **Voided/Deleted-only encounters** (Section 2, step 8) -- should these be fully
   excluded from the denominator (i.e. not counted as completed or missed at all)?

5. **EDVW discharges** (Section 3, step 3) -- should these continue to count as
   missed FC like any other missed case (just flagged for visibility), with no
   exclusion?

6. **Staff roster teams** (Section 4) -- are ED/EDFC, Inflight, NCID AO, ICH PSO,
   and Admin/Managers the correct full set of teams, with everyone else falling
   into "Others"?

7. **Blank "Latest CCF Creation User" fallback** (Section 5B) -- for pure Draft FCs
   with no CCF ever generated, is it correct to fall back to "FC Created By" for the
   "who closed the CCF" breakdown (while still counting the encounter as Red/missed
   in the completion breakdown)?

8. **Conservative principle** (Section 5) -- do you agree that ambiguous/edge cases
   should default to "not completed / missed" rather than "completed"?
