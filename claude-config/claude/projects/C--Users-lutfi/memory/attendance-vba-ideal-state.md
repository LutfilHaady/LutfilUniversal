---
name: attendance-vba-ideal-state
description: "User's confirmed vision for the Attendance VBA project — TTSH-wide adoption, verbatim-paste config, no VBA for managers"
metadata: 
  node_type: memory
  type: project
  originSessionId: 64a9687d-505b-48a4-baba-2c165fd19843
---

The Attendance VBA project (`TTSH Intern/Coding projects/Attendance VBA`) has an approved
target state beyond the current ICH-PSO scope, confirmed in brainstorming on 2026-07-08.
The ZKBio biometric scanner is used by all of TTSH, so the user wants this to be adoptable
by **any TTSH department** — he considers it potentially his biggest and most important
project.

**Why:** The punchlist export format is stable hospital-wide; only names/department strings
vary, and each department's export contains only its own people. So the tool generalizes
cleanly if config setup requires zero VBA and zero transcription.

**How to apply:** The full approved design is in the repo at
`docs/superpowers/specs/2026-07-08-ttsh-wide-adoption-design.md` and summarized in
`Attendance_Analyzer_Context.md` ("Ideal state / target use case"). Key decisions when
working on this project:
- Join key = punchlist's single name column (col B); Last Name is always empty. Managers
  paste names/departments verbatim — exact match, never fuzzy (fuzzy rejected as
  undebuggable).
- Pre-provisioned generic blank slots (`tblRoster_Dept1`…N, dept name typed inside the
  table, not in the table name); managers never create/rename Excel Tables. A setup wizard
  UserForm was rejected as overkill.
- Roster paste tolerance: values only (formatting inert), unknown codes reported in
  warnings, grid stays the one canonical shape (multi-format parsing rejected).
- Pre-run validation reports name/department mismatches before building sheets.
- Distribution: one configured `.xlsm` copy per department, cloned from a master template
  the user maintains. No shared workbook, no auto-update.
- Output gains an Overview landing sheet (headline stats + hyperlinks per unit).
