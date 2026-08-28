# MFC Report — Carry-forward, Ward Filter & Summary Rework

**Date:** 2026-05-29
**Status:** Approved (pending spec review)

## Background

Staff feedback on the new MFC report version requested three changes. The ward
filter change also generalises the bed filter so it can be retargeted to other
departments later (the ward list is the only thing that changes per department).

Note on source files: every VBA module lives both as an individual `.bas` file
(working copy) and concatenated inside `MFC_All_Modules.txt` (the deliverable
staff copy into Excel). **Both must be kept in sync for every change.**

---

## Feature 1: Carry forward manual columns from the previous MFC

Output columns A (Inflight FC Status), B (Date Updated), C (Staff Follow Up) are
currently left blank for staff to fill manually each run. Staff want these
pre-populated from the previous MFC file so prior follow-up notes persist.

### Behaviour

- Matching key: **Encounter Number** (output col G = "Encounter Number").
- Source: previous MFC report cols A / B / C, located by header via
  `FindColByHeader` ("Inflight FC Status", "Date Updated (DD/MM/YYYY)",
  "Staff Follow Up (if any)").
- Only carry forward values from previous rows **not** marked `"Resolved"` in the
  previous report's "Resolution Status" col. Resolved cases are closed; their
  manual fields should not persist into the new report.
- Where no match is found (genuinely new case), cols A/B/C stay blank.
- Where the previous MFC is an older manually-made file missing any of the three
  columns, `FindColByHeader` returns 0 for that column — carry-forward is skipped
  for just that column, no crash.

### Implementation

Extend `BacklogSummary` in `BuildOutput.bas`, which already opens `prevWs` and
keys by Encounter Number. While building the existing `prevEncs` dictionary, also
build a parallel dictionary keyed by Encounter Number → `Array(inflight, dateUpd,
staffFU)` for non-Resolved rows. After the backlog scan, write the three values
into output cols A/B/C for each matching row in one pass.

Carry-forward must run **before** the date-validation re-evaluates, but since it
writes values into already-validated cells (validation is `IgnoreBlank` /
information-style), no validation conflict arises. Date values are written as the
stored cell value (carried verbatim from the previous file).

---

## Feature 2: Ward-based bed filter

Replace the current "position 4 of bed = E or F" rule in `FilterBedCode`
(`FilterRows.bas`) with an explicit NCID ward allowlist.

### Ward extraction

Ward code = `Mid(bed, 2, 3)` — i.e. 0-based positions 1,2,3 of the bed string.
Example: `"T07E18N"` → `"07E"`, `"T14F18N"` → `"14F"`.

### Allowlist (zero-padded to match bed format)

```
14F, 12E, 11E, 08E, 09F, 08F, 07F, 07E, 06F, 11F, 03E
```

Single-digit floors are stored padded ("7E" → "07E") because bed strings carry
the leading zero.

### Behaviour

- Extract `Mid(bed, 2, 3)`, uppercase, test membership against a
  `Scripting.Dictionary` built once from a `Private Const` comma-delimited string
  at the top of `FilterRows.bas`.
- Rows with bed shorter than 4 chars, blank, or `"none"` are dropped (existing
  guard retained).
- Keeps the existing load-filter-write performance pattern unchanged — only the
  per-row keep test changes.

### Generalisation for other departments

The ward list is a single named constant. Retargeting to another department is a
one-line edit of that constant. No other code changes required.

---

## Feature 3: Summary table rework (temporary fix)

Current summary (`WriteSummaryTable` / `BacklogSummary` in `BuildOutput.bas`):

| Row | Label | Current value |
|-----|-------|---------------|
| Total Cases | macro | all output rows |
| Backlog | macro | Encounter Nos carried from prev MFC (not Resolved) |
| To Follow Up on CCF | **auto** | count of `Draft (CCF Generated)` FC-status rows |
| Today's Cases | formula | `= Total − Backlog − EL Admissions` |
| EL Admissions | manual (yellow) | staff fills in |

### Changes

1. **To Follow Up on CCF → manual.** Remove the auto-count of
   `Draft (CCF Generated)` rows. This row becomes a blank, staff-filled yellow
   cell. It is unrelated to the FC status of the same name and must not affect any
   total. Remove the `ccfCount` counting logic, the `fcStatData` read, and the
   `outCCFCount` ByRef parameter from `BacklogSummary`.

2. **Today's Cases = new cases.** Change the in-sheet formula from
   `= Total − Backlog − EL Admissions` to `= Total − Backlog`. "Today's Cases" now
   means cases not present in the previous MFC. EL Admissions no longer feeds this
   formula.

3. **Backlog** stays as-is — cases carried over from the previous MFC.

4. **EL Admissions** stays as a manual yellow informational cell, wired into no
   formula.

### Resulting summary

| Row | Label | Value |
|-----|-------|-------|
| Total Cases | macro | all output rows |
| Backlog | macro | carried over from prev MFC (not Resolved) |
| To Follow Up on CCF | **blank, manual (yellow)** | staff fills in |
| Today's Cases | formula | `= Total − Backlog` |
| EL Admissions | blank, manual (yellow) | staff fills in |

### MainMacro MsgBox

`MainMacro.bas` final MsgBox currently prints `"To Follow Up on CCF : " & ccfCount`
and `"Today's Cases (excl. EL): " & (totalCases - backlogCount)`. Update:
- Drop the CCF line (now manual, macro has no value to report), or label it as
  staff-entered. Decision: drop the auto CCF line from the dialog.
- Keep Today's Cases as `totalCases - backlogCount` (already correct in the dialog).
- Remove the now-unused `ccfCount` declaration and the `outCCFCount` argument.

---

## Files to change

1. `FilterRows.bas` + `MFC_All_Modules.txt` — ward allowlist filter
2. `BuildOutput.bas` + `MFC_All_Modules.txt` — carry-forward A/B/C; remove CCF
   auto-count; Today's Cases formula
3. `MainMacro.bas` + `MFC_All_Modules.txt` — MsgBox + signature cleanup
4. `docs/MFC_Macro_Context.md` — update bed filter, summary, and output sections to
   reflect new logic

## Out of scope

- The underlying issue behind the CCF change (user flagged it as a temporary fix;
  the real fix will be raised separately).
- Config-sheet-driven ward list (hardcoded constant is sufficient).
- Any change to duplicate flagging, Epic lookup, or date extraction.

## Testing

Manual verification in Excel (no automated test harness exists for VBA here):
- Bed filter keeps only the 11 NCID wards; rejects non-matching/blank/short beds.
- Carry-forward populates A/B/C for returning Encounter Numbers, blank for new
  ones, skips Resolved prev rows, and survives a prev file missing those columns.
- Summary: CCF row blank/yellow, Today's Cases = Total − Backlog, EL manual.
