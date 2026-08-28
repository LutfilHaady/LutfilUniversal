# Discharged Cases Report -- Design

**Goal:** Instead of silently deleting patients who get discharged before their financial
counselling was completed, capture them onto a second tab ("Discharged") in the same MFC
output workbook, so the manager can use it as a worklist to close those cases out in eFC.

**Requester context:** Supervisor-requested. Confirmed via discourse with the user
(2026-07-14): the report is for the manager to close discharged cases in eFC -- not a
staff follow-up worklist, and not a QA/audit trail on the filter itself.

## Background

Today, `FilterDischarged` (`FilterDischarge.bas`, step 6 of `GenerateMFCReport`) looks at
every row still in the pipeline at that point -- i.e. every case whose FC Status is a Draft
variant or that has `Missed FC = Yes` (rows surviving `FilterFCStatus` in step 4) -- and
permanently deletes any row where `Epic Admission Status = "Discharged"`. There is currently
no record of these rows anywhere; they simply vanish.

## Decisions confirmed with the user

1. **Purpose:** manager uses this tab to close matching cases in eFC. Not a staff
   follow-up list, not an audit log.
2. **Population:** every row `FilterDischarged` currently deletes -- i.e. all pending-FC
   cases (Draft + Missed FC) that turned out to be discharged. Not narrowed to
   Missed-FC-only.
3. **Carry-forward:** none. Fresh snapshot each run, no comparison against a previous
   discharged list, no backlog logic.
4. **Columns:** identical layout to the main report (A-O), same headers/formatting.
5. **eFC lookup concern resolved:** Missed FC rows have a blank FC ID (existing, unrelated
   behavior), so the manager looks those up in eFC by Encounter No/MRN instead. This is
   the same pattern staff already use for the main report today -- not a new gap
   introduced by this feature.

## Design

### Where the data goes

A second worksheet named **"Discharged"** is added to the same output workbook produced by
`BuildMFCOutput`, immediately after the main "MFC Report" sheet is built. Same workbook,
same file, no second `.xlsx`.

### Column layout

Identical A-O layout to the main report (same headers, same F-O source column mapping from
the working sheet, same manual A-E columns for the manager to fill in). This lets
`OutputWriter.bas`'s existing `WriteOutputHeaders` / `WriteOutputData` / `FormatOutputSheet`
be reused unchanged -- they already take `outWs` as a parameter and have no hardcoded sheet
reference.

Dropdowns (`AddDropdowns`) are applied to the Discharged tab too, since the existing
20-value Inflight FC Status list already includes `Discharged -- MCAF` / `Discharged - No
MCAF`, which is exactly what the manager needs to mark how each case was closed.

Duplicate red-flagging is left in place for consistency (it's the same `WriteOutputData`
call), even though duplicates are less likely to matter here.

### Data flow changes

1. **`FilterDischarge.bas`:** `FilterDischarged` currently loads the sheet into memory,
   splits rows into keep/discard, writes back the keep set, and deletes the discarded
   tail rows. Change it to also return the discarded rows (header + data) via a new
   `ByRef` output parameter, instead of dropping them on the floor. No change to its
   existing keep-row behavior.
2. **`MainMacro.bas`:** capture the discharged rows from step 6, then pass them into
   `BuildMFCOutput` (or a new sibling call) so the Discharged sheet can be built from the
   same run's data.
3. **`BuildOutput.bas`:** add a second sheet-building step that mirrors the existing
   `BuildMFCOutput` body (header write, data write, dropdowns, formatting) but targets a
   new "Discharged" sheet and the captured discharged rows instead of the filtered
   working sheet. Reuses `OutputWriter.bas` and `Dropdowns.bas` as-is.

### Implementation note: shared "Lists" sheet

`Dropdowns.bas`'s `CreateListsSheet` deletes and recreates a very-hidden `"Lists"` sheet
(used as the data-validation source range) every time `AddDropdowns` runs. If
`AddDropdowns` is called twice in the same workbook (once per output sheet), the second
call would delete the `Lists` sheet that the first sheet's validation already points to,
breaking those dropdowns. `CreateListsSheet` needs a small guard so the second call in the
same run reuses the existing `Lists` sheet instead of recreating it.

## Out of scope

- Backlog/carry-forward comparison for the Discharged tab.
- A separate output file.
- Any change to the main report's columns, the Inflight FC Status dropdown values, or the
  discharge filter's keep-row logic.
- Any change to how "discharged" is detected (still `Epic Admission Status = "Discharged"`).

## Verification plan

No CLI/test runner available (VBA). Verification is:
1. Static: grep for the new/changed functions in both the `.bas` files and
   `MFC_All_Modules.txt`, confirm they stay in sync.
2. Ask the user to compile (`Alt+F11` -> Debug -> Compile VBAProject).
3. Ask the user to run `GenerateMFCReport` with real input files and confirm the
   "Discharged" tab appears with the expected rows, dropdowns, and formatting, and that
   the main "MFC Report" tab's dropdowns still work (regression check for the shared
   `Lists` sheet).
