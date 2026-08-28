# Discharged tab: apply the same bed-code filter

## Problem

`FilterDischarged` (step 6) captures every discharged row onto the hidden
`DischargedTemp` sheet before `FilterByBedCode` (step 7) removes rows outside
the Inflight ward excludelist. Result: the "Discharged" output tab can contain
discharged patients from non-Inflight wards (e.g. ED beds), which the Inflight
manager doesn't own and shouldn't see on that tab.

## Fix

Swap the order of steps 6 and 7 in `MainMacro.bas`: run `FilterByBedCode`
first, then `FilterDischarged`. Both filters are independent AND conditions
over the same row set (neither depends on the other's outcome), so the final
main-report row set is unchanged either way. With bed filtering first,
non-Inflight-ward rows are gone before the discharge filter ever captures
rows, so the Discharged tab automatically only contains the same Inflight
wards as the main report.

## Changes

- `MainMacro.bas` (and `MFC_All_Modules.txt` mirror): swap step 6/7 call
  order and renumber comments/progress bar labels.
- `FilterWard.bas` / `FilterDischarge.bas` header comments: update "runs
  after/before" notes to reflect new order.
- `CLAUDE.md`: update workflow step list (section "Workflow steps") and the
  "Discharged cases report" section to note the tab now only contains
  Inflight-ward beds.

## Out of scope

No changes to `ShouldExcludeBed`, `GetExcludedBedPrefixes`, or the discharge
detection logic itself (`Epic Admission Status = "DISCHARGED"`).
