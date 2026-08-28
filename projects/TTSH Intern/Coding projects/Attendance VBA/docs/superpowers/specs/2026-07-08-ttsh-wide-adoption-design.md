# TTSH-wide Adoption Design — Attendance Analyzer

**Date:** 2026-07-08
**Status:** Approved by user (brainstorming session)

## Vision / ideal state (user's words, distilled)

The biometric scanner (ZKBio CVAccess) is used by everyone in TTSH, so this tool should be
usable by **any TTSH department**, not just ICH PSO. The ideal state:

- A department manager pastes their **whole roster verbatim** into the Roster sheet and
  their punchlist names/departments verbatim into Config — copy-paste, never transcribe.
- The **Config sheet gives maximum flexibility** (schedules, grace period, hours unit,
  verification options, roster codes) without ever requiring VBA edits — but nothing so
  dynamic it makes the code impossible to debug.
- The **output stays organised by department** in separate sheets: overall analytics at a
  glance plus in-depth day-by-day detail.
- Weekday/date matching stays derived automatically from the monthly punchlist (already
  built: `ParseDayHeaders`).
- Managers must never need to code in VBA or create/rename Excel Tables.

## Facts this design rests on

- The Monthly Punch List export format is stable across departments; only the **names and
  department strings** vary.
- Each department's export contains **only that department's people** (data arrives
  pre-partitioned per department, possibly spanning several sub-units, e.g. ICH's export
  holds PSO + INFLIGHT + Admissions).
- The punchlist's Last Name column is **always empty**; one name is sufficient to map rows.
- Native rosters vary in look (colours, fonts, stray rows) but the day-of-month code grid
  is a workable canonical shape.

## Design

### 1. Name matching — verbatim paste, single join key

Change the person join key from `Trim(First) & " " & Trim(Last)` to **the punchlist name
column (col B) alone**. Today's concat only works because Last is always blank; making the
single column the explicit key means a manager can copy the name column straight off their
punchlist into the roster's `Attendance Name` column and matching is guaranteed (same
string, exact match, case-insensitive + trimmed as today). Department strings are likewise
pasted verbatim into `tblSchedule`. No fuzzy matching — rejected as undebuggable.

### 2. Pre-run validation — mismatches shout, never whisper

A validation pass runs automatically at the start of `GenerateAttendanceReport` (before
any sheets are built) and reports:

- punchlist **names missing from the roster** (per unit that has a roster set up),
- punchlist **departments missing from `tblSchedule`** (these would land on Unmapped),
- roster **names that never appear in the punchlist** (stale entries / typos).

The report is informational (message box / summary), and the run continues — Unmapped and
`NO PUNCH - VERIFY` behaviour still catch everything downstream — but the manager sees the
gaps up front instead of discovering them by absence in the output.

### 3. Config — pre-provisioned blank department slots

The template workbook ships with generic, pre-built blank slots so onboarding is pure
fill-in-the-blanks:

- Blank rows (or a documented pattern) in `tblSchedule` ready for a new department's
  weekday × time rows.
- Blank roster tables pre-created and pre-named `tblRoster_Dept1` … `tblRoster_DeptN`
  (N chosen generously, e.g. 10). Managers **never create or rename a table**.
- Each roster table carries a **department-name cell inside the table region** (first
  config column or a header cell immediately above): the manager types the department
  name there, verbatim from the punchlist. The table *name* stays generic; the *content*
  declares which department it serves. `LoadRoster` reads the department from that cell,
  not from the table name.
- Everything tunable stays where it is: `GracePeriod`, `HoursUnit`, `tblSchedule`,
  `tblVerification`, `tblRosterCodes` — all Config-sheet edits, zero VBA.

### 4. Roster paste tolerance (grid + hardening)

The `1`–`31` day-of-month grid remains the **one canonical roster shape** — no multi-format
parsing (rejected: every new department would be a new parsing bug). But the loader is
hardened for real-world verbatim pastes:

- **Formatting is ignored**: colours, fonts, borders, fills come along cosmetically and
  never affect matching, because the loader reads `.Value` only. This is already true —
  stated here explicitly so nobody "fixes" it later.
- Codes matched case-insensitively and trimmed (already true).
- Blank rows, stray header rows, and trailing summary rows are inert — they never match
  an `Attendance Name` and are skipped without error (already true; keep it that way).
- **Unknown codes are reported**, not silently ignored — but only where it matters: when
  a punchlist day is `[-]` and the roster has a non-blank code for that person/day that is
  not in `tblRosterCodes`, that code is counted and surfaced in the end-of-run warning
  block (e.g. "3 unresolved NO PUNCH days had unrecognized roster codes: AL(PM), MC/AL").
  So a manager who pastes `AL(PM)` learns why the day didn't resolve. Codes on normally
  worked days (duty/rotation codes like `C1`, `RD`, `Standby`) are never reported — they
  would be pure noise, since there is nothing to resolve.
- Roster codes stay fully editable in `tblRosterCodes` — each department adds its own
  leave codes without VBA.

### 5. Distribution — one workbook per department, master template

Because exports arrive pre-partitioned per department:

- **Each department gets its own copy** of the `.xlsm`, configured only with their units.
  No shared workbook: no privacy leakage between departments, no cross-department blast
  radius from a config mistake.
- The author maintains a **master template** (code + blank slots, no department data).
  New departments clone the master. Code updates = clone a fresh master and re-paste
  config/roster sheets — cheap because of the slot design.
- No auto-update machinery (rejected: overkill for a monthly manual tool).

### 6. Output — Overview sheet + existing detail

Add an **Overview** landing sheet (first sheet) to the output workbook:

- One row per department/unit sheet: headcount, total lates, total early leaves,
  unresolved `NO PUNCH - VERIFY` days, roster-resolved days, hours worked vs expected
  variance.
- Built from live formulas referencing the detail sheets (same philosophy as the
  per-employee summary blocks: recalculates if a manager hand-edits a Verification tag).
- Hyperlink per row to the department's detail sheet.
- Everything else unchanged: per-department sheets, columns A–R detail, column U+
  per-employee summaries, Unmapped sheet, row colours, `NO PUNCH` invariants.

## Out of scope (deliberate)

- Setup wizard UserForm (overkill for a once-per-department task — slots + instructions
  suffice).
- Fuzzy/normalised name or department matching.
- Multi-format roster ingestion (lists, week-per-row grids).
- Month-over-month comparison in the Overview (revisit once departments actually use it).
- Auto-update/distribution mechanism for deployed copies.

## Invariants preserved

- Department absent from `tblSchedule` → Unmapped, never dropped or guessed.
- Blank punch cell = not scheduled, not an error.
- `[-]` never guessed: `NO PUNCH - VERIFY` unless the unit's own roster confirms a code
  (`NO PUNCH - ROSTER: <code>`).
- Summary values stay live formulas, never hardcoded numbers.
