# FC Completion Report -- VBA Code Progress

This tracks what's been implemented so far vs. what's still waiting on
answers from colleagues (see `docs/FC_Completion_Report_Process_Flow_for_Review.md`
and the "Outstanding blanks" list in `CLAUDE.md`).

Module files live in the project root (`*.bas`) and are mirrored into
`FCCompletion_All_Modules.txt` (the staff-facing paste-into-VBA-editor
deliverable, regenerated via `regen_modules.ps1`).

**Compile status:** `FCCompletion_All_Modules.txt` (Helpers, FilterFileA,
FilterFileB, DeduplicateEncounters, BuildOutput, MainMacro, FilePickerForm,
ProgressForm) -- **needs user re-compile** after 2026-06-18 additions
(BuildOutput expansion, MainMacro new module). Previous modules compiled
cleanly as of 2026-06-10.

---

## Done

### Helpers.bas
- `FindColByHeader`, `NormHeader` -- header-based column lookup, copied
  verbatim from the MFC macro.
- `FindEncounterCol` -- tries "Encounter Number" (File A) then "Encounter No"
  (File B), since the two eFC exports label this column differently.
- `ValidateFileHeaders` -- FilePickerForm validation for `FC_SUMMARY` (File A)
  and `INFLIGHT_MISSED` (File B).
- `IsMissedFCColumnBlank` -- detects the File B "Missed FC column entirely
  blank" workaround case from CLAUDE.md.
- `CreateConfigSheet` / `LoadStaffRoster` / `GetStaffTeam` -- builds and reads
  a "Staff Name -> Team" roster table on a `Config` sheet. Teams: ED/EDFC,
  Inflight, NCID AO, ICH PSO, Admin/Managers, Others (default for anyone not
  listed).

### ProgressForm.bas
Reused as-is from the MFC macro, caption updated to "FC Completion Report --
Generating".

### FilePickerForm.bas
2-slot dashboard (File A: FC Summary Report, File B: Inflight Missed FC
Report) -- Browse/status per slot, duplicate-file check, Missed-FC-blank
warning, Generate enabled only when both slots are valid.

**Note:** status indicators use plain ASCII ("Valid" / "Invalid" / "O" / "X
Same file") instead of the `(check)/(cross)/(circle)/(warning)` symbols used
in the MFC form. CLAUDE.md requires `FCCompletion_All_Modules.txt` to stay in
clean ASCII (the MFC project has had repeated Unicode-corruption issues
needing `fix_qmarks.ps1`-style cleanup) -- using ASCII from the start avoids
that for this project. Flag if you'd prefer the Unicode symbols anyway.

### FilterFileA.bas (Steps 1-2)
- `FilterFCMode` -- keep only "Financial Counselling - AH" /
  "Financial Counselling - Downtime".
- `DeleteCancelledAdmissions` -- drop Admission Status = "Cancelled".

### FilterFileB.bas (Steps 1-4 of the process flow doc)
- `FilterFCModeIfPresent` -- no-op if File B has no "FC Mode" column
  (CLAUDE.md blank #2).
- `KeepOnlyMissedFC` -- keep only Missed FC = "Yes".
- `DeleteCancelledOrPlanned` -- drop Admission Status = "Cancelled"/"Planned".
- `FlagEDVWDischarges` -- adds an informational "EDVW Discharge" column
  (Point Of Care = "TTSH Virtual Ward" + Accommodation Code = "EDVW"). Rows
  are NOT removed -- this is a label only, per the process flow doc's current
  proposal for Q5.

### DeduplicateEncounters.bas (Steps 3, 5-8)
- `GetFCStatusPriority` -- the 10-level priority table from the process flow
  doc (Q2).
- `AddPriorityColumn` -- writes a "PRIORITISE" column.
- `MarkDuplicateEncounters` -- highlights duplicate Encounter Numbers in red
  (visual aid).
- `ResolveDuplicateEncounters` -- automatically picks one row per Encounter
  Number (lowest priority wins, tie-break by larger FC ID), applies the
  Inflight-creator exception (Q3) via the Config roster, deletes the rest, and
  counts Voided/Deleted-only encounters (Q4) for the final report.

**Note (2026-06-18):** Q2-Q4 (and all other process flow questions) are now
confirmed -- see "Process flow confirmation" section below. The Inflight
exception is driven entirely by the `Config` roster; with an empty roster
`GetStaffTeam` returns "Others" for everyone, so the exception is inert until
real staff names are filled in.

---

## Process flow confirmation (2026-06-18)

All 8 questions from `docs/FC_Completion_Report_Process_Flow_for_Review.md`
have been confirmed by the user. The process flow doc is now the authoritative
spec -- its rules should be implemented as written.

| Q# | Decision |
|---|---|
| Q1 | EM/EL split by Admission Type only -- no Point of Care condition |
| Q2 | FC Status priority order is correct as written |
| Q3 | Inflight-created FC set aside in favour of non-Inflight (confirmed) |
| Q4 | Voided/Deleted-only encounters fully excluded from denominator |
| Q5 | EDVW discharges count as missed FC (flagged, not excluded) |
| Q6 | Team set confirmed: ED/EDFC, Inflight, NCID AO, ICH PSO, Admin/Managers, Others |
| Q7 | Fall back to FC Created By when Latest CCF Creation User is blank, but **highlight** those rows |
| Q8 | Conservative principle confirmed -- ambiguous cases default to not completed |

---

### BuildOutput.bas (2026-06-18 -- major expansion)
- `BuildOutputWorkbook` -- main orchestrator: reads deduplicated File A,
  splits by Admission Type into EM/EL, computes all stats in one pass,
  creates output workbook with 6 sheets, saves via FileDialog.
- EM/EL split (process flow Step 9): purely by Admission Type (Q1 confirmed).
  Adds 3 extra columns: "CCF Closed By" (resolved name), "CCF Closer Team",
  "Looks Wrong" (flags EM closed by NCID AO, or EL closed by ED/EDFC/Inflight).
- `WriteSummarySheet` / `WriteSummaryBlock` -- colour-coded completion
  breakdown (Green/LightGreen/Orange/Red per process flow Section 5A),
  "Who Closed the CCF" by team (Section 5B), FC Activity Detail (Section 5C).
  All computed 3 times: EM, EL, Combined. Footnotes for voided/other.
- `WriteMethodologySheet` -- plain-language explanation of every rule with
  this month's actual numbers (process flow Section 6 item 5).
- `BuildStaffRosterCheckSheet` -- per-team roster coverage check (per
  2026-06-11 design spec). Matched / Not Matched flag against File A data.
- `HighlightCCFFallbackRows` -- highlights yellow any row where Latest CCF
  Creation User was blank and fell back to FC Created By (Q7).
- `WriteMissedFCSheet` -- copies cleaned File B data as-is.
- Output file naming: `FCReportSummary_<MonthName><Year>.xlsx` (per 2026-06-11
  addendum), suggested via SaveAs dialog.

### MainMacro.bas (2026-06-18 -- new module)
- `GenerateFCCompletionReport` -- entry point (Alt+F8). Full pipeline:
  FilePickerForm -> load roster -> clean File A (filter + dedup) ->
  clean File B (filter) -> BuildOutputWorkbook -> close inputs -> success dialog.
  12-step ProgressForm integration. Error handling with Cleanup label.

---

## Still needs data from user

| Item | Blocked by |
|---|---|
| File A column headers verification | CLAUDE.md blank #1 -- need a real export to confirm headers resolve via `FindColByHeader` |
| Staff roster data (actual names) | CLAUDE.md blanks #3-#5 -- Config sheet structure is built, just needs real names/teams |
