# MCAF-M SMS Broadcast Automation — Design Spec

**Purpose:** Replace the manual eFC → Epic → SMS-portal workflow for MCAF-M
reminders (inflight ED cases) with a VBA macro tool. Same architecture pattern
as the existing MFC macro (`MFC VBA Inflight`) and Attendance Analyzer
(`Attendance VBA`): `.xlsm` workbook, Config sheet, UserForms for file
selection and review, one macro entry point.

**Source of truth for the manual SOP:** `SMS BROADCAST (INFLIGHT) 4 (1).docx`
in this folder — the process this tool automates.

**Scope:** Automates identification, data joining, and broadcast-file
generation. Does **not** automate the Epic/eFC exports themselves (still
manual, source systems closed to automation) or the actual SMS send (still a
manual upload to the NHG portal — confirmed no API, see Confirmed Constraints).

---

## Confirmed constraints (verified — no longer assumptions)

1. **Epic report = Epic Census Snapshot Report**, same one used by the
   Inflight MFC macro. Confirmed it contains CSN and Phone (Bed is no longer
   pulled — see constraint #8); **Phone column still needs to be added to
   the export's column selection** if not already present — check on first
   real export. This is an operational checklist item, not a design risk.
2. **eFC Task List Report export is manual-only.** No API. Stage 0 stays a
   manual UI export exactly as documented in the SOP, permanently — not a
   placeholder.
3. **NHG SMS portal has no programmatic upload or status API.** Manual login
   + upload + manual "mark as sent" is the permanent design for Stage 4/5,
   confirmed against the SOP's own login/upload/verify steps — not a
   temporary stand-in pending a future API.
4. **Join key = Encounter No (eFC) = CSN (Epic).** Confirmed, same pattern as
   the Inflight MFC macro. `JoinPhoneFromEpic` can be built directly against
   these two columns — no name-matching fallback needed.
5. **Broadcast file has a header row.** Confirmed from the SOP text (step 5:
   "Ensure each phone number is listed in a single row under the **Mobile**
   column"; step 9, portal upload form: "Content of uploaded file: **Mobile
   Number**"). Default header label: `Mobile Number` (matches the portal's
   own field label most literally). The exact label string is the one
   remaining thing to verify against a real successful upload — see Testing
   Checklist item 6.
6. **eFC Task List Report's comment column is literally named `Comment`**,
   not `ED Comments` — confirmed against the real report structure (`Task
   List Report Template` sheet in `SMS TEMPLATE (MCAF-S REMINDER).xlsx`).
   Same `FC DONE` / `MCAF REMINDER` text patterns are still expected inside
   it; only the header name was wrong. `Helpers.bas` / `CaseMatcher.bas`
   updated to match.
7. **Epic's Phone field is not a single clean value.** Confirmed from the
   `SMS TEMPLATE` sheet's sample data: it's a multi-line blob like
   `"*9327 2613 (Mobile)" & vbCrLf & "6677 1216 (Home Phone)" & vbCrLf & "9664
   9678 (Work Phone)"` — asterisk marking a preferred number, multiple
   labelled numbers per patient, separated by line breaks. `JoinPhoneFromEpic`
   now runs this through `ExtractMobileNumbers`, which ports the template's
   own `H`/`I`/`J` ("1st/2nd/3rd phone number") formulas: strip
   spaces/asterisks, scan for up to three non-overlapping 8-digit runs
   starting with `8` or `9`. Decided 2026-07-21: return **all three raw
   candidates**, not one collapsed value — `SmsCase` carries `Phone1`/
   `Phone2`/`Phone3` and `ReviewForm` shows all three, so PSA sees (and can
   override) whatever the tool found rather than a silent pick.
   `FirstUsableNumber` (skips blank and Epic's `88888888`/`99999999`
   placeholder values) is used only at the very last step, to pick the one
   number `BuildBroadcastFile` writes per the SOP's one-number-per-row
   requirement. See the Template Findings section below.
8. **Bed is dropped — not part of this tool's output.** Decided 2026-07-21.
   The columns actually used from the SMS TEMPLATE are `Encounter No`, `MRN`,
   `Patient Name`, `Phone Number`, `1st/2nd/3rd phone number` — no Bed.
   There was nothing for a Bed lookup to feed, so `JoinPhoneFromEpic`
   (renamed from `JoinBedAndPhone`) no longer looks it up, `ValidateEpicFile`
   no longer requires a `Bed` column in the Epic export, and `SmsCase` /
   `ReviewForm`'s grid no longer carry a Bed field.
9. **MRN is a direct pass-through from the eFC export**, not looked up from
   Epic — the eFC Task List Report's own `Task List Report Template` sheet
   already has an `MRN` column (confirmed 2026-07-21), same source as
   `Patient Name`. `SmsCase`, `BuildReviewList`, and `ReviewForm`'s grid now
   carry it.
10. **eFC Task List Report export's real, full header row** (confirmed
    2026-07-24, user listed it out manually from the actual export, not the
    SMS TEMPLATE's reference sheet): `Institution`, `MRN`, `Encounter No`,
    `Admission Date`, `Admission Time`, `Financial Counselling ID`,
    `Financial Counselling Mode`, `FC Status`, `Task Id`, `Created Date`,
    `Created By`, `Last Updated By`, `Task Status`, `Due Date`,
    `Visit/Admission Type`, `Specialty`, `Task Type`, `Patient Name`,
    `Task Description`, `Deletion Reason`, `Assigned Team`, `Task Category`,
    `Comment`. All four columns the code actually reads (`Encounter No`,
    `MRN`, `Patient Name`, `Comment`) are present with these exact header
    strings — `Helpers.bas`/`CaseMatcher.bas`/`BroadcastBuilder.bas`'s
    default header names need no changes. **No `SMS` or `CONTACT NUMBER`
    column in the real export** — see correction in Template Findings below.
    Epic Census Snapshot Report's real headers are still unconfirmed.

All four systems have no API access. Everything above is now a fixed design
constraint, not a risk to revisit later.

---

## Template findings (confirmed 2026-07-21)

The user attached the real target template, `SMS TEMPLATE (MCAF-S
REMINDER).xlsx`, which replaces several assumptions above with verified
structure. This workbook is very likely **Kenzo's SMS Template**, referenced
in SOP step 4 ("Refer to Kenzo's SMS Template and create a new worksheet.
Copy and insert the cases that require SMS notification.") — resolving that
previously-unaccounted-for artifact. Two sheets:

- **`SMS TEMPLATE`** — of its ~60 columns, only a handful are actually used
  in the real working process (confirmed with the user 2026-07-21, after an
  initial over-broad read of "blank means required"):
  `Encounter No | MRN | Patient Name | Phone Number | 1st phone number |
  2nd phone number | 3rd phone number`.
  Disregarded: `FC ID`, `Admission Date`, `Admission Status` (not used at
  all), and everything from the `FTF/SMS checker` column onward (`K` through
  `BH`) — including the `S`-onward Financial-Counselling tracking block
  (`Point Of Care`, `Final Bed`, `FC Status`, `NeFR Consent Status`, etc.,
  which also had `#N/A` in `Final Bed`/`Epic Admission Status` on every
  sample row — dead/broken even if it had been in scope). No Bed field
  anywhere in the used set — Bed dropped from the tool entirely
  (constraint #8).
  - `H`/`I`/`J` ("1st/2nd/3rd phone number") are formulas that reference `G`
    ("Phone Number") directly, extracting up to three 8-digit runs starting
    with `8` or `9`. They show `#VALUE!` in the template's own sample rows
    only because the sample's `G` column happens to be blank (the sample
    data was pasted into the separate `L`/`M`/`N` demo lane instead) — not
    because the formula is broken. Once this tool populates `G` with Epic's
    raw phone value, `H`/`I`/`J` compute correctly on their own.
  - `ExtractMobileNumbers` in `CaseMatcher.bas` ports `H`/`I`/`J` directly:
    up to three raw candidates, written to `SmsCase.Phone1`/`Phone2`/`Phone3`
    and shown to PSA in `ReviewForm` (decided 2026-07-21, after initially
    collapsing to one value — see git history for that intermediate design).
    `FirstUsableNumber` (the disregarded `FTF/SMS checker` column's
    placeholder-rejection logic: skip blank, `88888888`, `99999999`) is used
    only once, at `BuildBroadcastFile`, to pick the single number the SOP's
    one-number-per-row upload format requires.
- **`Task List Report Template`** — the real eFC Task List Report headers.
  Confirmed `Comment` (not `ED Comments`, constraint #6) and `ENCOUNTER NO`
  (case-insensitive match, no code change needed). This sheet was read as
  containing `SMS` and `CONTACT NUMBER` columns, raising the question of
  whether phone numbers should come from the eFC export directly instead of
  (or alongside) the Epic join. **Corrected 2026-07-24**: the user listed
  out the real export's full header row from memory (constraint #10) and
  neither `SMS` nor `CONTACT NUMBER` is in it — the template sheet's reading
  doesn't match the live export. Question is moot; phone numbers come from
  the Epic join only, no further action needed.

---

## Files in this delivery

- `SMS_Broadcast_Tool.xlsm` — Config sheet (identification rules, phone-column
  mapping), Instructions sheet.
- `Helpers.bas` — `LoadEfcExport`, `LoadEpicReport`, `FindColByHeader`,
  `ValidateEfcFile`, `ValidateEpicFile`.
- `CaseMatcher.bas` — `IdentifySmsRequired` (ports the Comment IF-formula
  logic), `JoinPhoneFromEpic` (XLOOKUP-equivalent join), `DedupeEfcRows`
  (Encounter No dedup, see Dedup Rule below).
- `BroadcastBuilder.bas` — `BuildReviewList`, `BuildBroadcastFile` (final
  phone-number-only sheet), `AppendRunLog`.
- `MainMacro.bas` — `GenerateSmsBroadcast`, the Alt+F8 entry point.
- `FilePickerForm` (UserForm) — two file-select slots: eFC export, Epic export.
- `ReviewForm` (UserForm) — checklist grid of matched cases before file generation.
- `ProgressForm` (UserForm) — modeless progress bar, reused pattern from the
  Attendance Analyzer.

---

## Workflow

### Stage 0 — Manual exports (irreducible)
PSA exports the eFC Task List Report and the Epic report by hand, same as
today. No change here — this mirrors the EPIC-is-closed constraint already
accepted on the ICH triage project.

### Stage 1 — `FilePickerForm`
- Two file-select buttons, one per export.
- On "Run": call `ValidateEfcFile` / `ValidateEpicFile` — check expected
  headers exist and the sheet isn't empty. Fail loud here with a specific
  message ("eFC file missing 'Comment' column — check you exported the
  right report") rather than a generic error three steps later.

### Stage 2 — Dedup, identification, and join (no UI, runs in the background)
- `DedupeEfcRows`: if the same Encounter No appears more than once in the
  eFC export (e.g. re-exported after a correction), **keep the last
  occurrence** (last row in file order) and drop earlier duplicates from
  processing. Log the count of duplicates collapsed so it's visible in the
  completion message and RunLog — never a silent drop, consistent with
  principle #4 below. See Dedup Rule section for rationale.
- `IdentifySmsRequired`: reads Comment per row, flags "SMS REQUIRED" when
  both "FC DONE" (or "PHONE FC DONE") and "MCAF REMINDER" are present —
  string match logic, ported directly from the existing IF formula, not
  reinvented.
- Separately flag "NO FC DONE / WARD CLASS SELECTED" rows — these aren't SMS
  candidates; they need FC follow-up instead. Surface them in the completion
  message as a distinct count, don't just drop them.
- `JoinPhoneFromEpic`: for each SMS-required case, look up Phone from the
  Epic export using the confirmed join key (constraint #4), extracting all
  three raw candidate mobile numbers from Epic's raw phone field
  (`ExtractMobileNumbers`, constraint #7) into `1st`/`2nd`/`3rd Phone Number`
  columns.
- Any SMS-required case with **no match** in the Epic export goes to a
  "Needs Manual Lookup" list in the review step — never silently dropped,
  same principle as the Attendance Analyzer's "Unmapped" sheet.

### Stage 3 — `ReviewForm`
- Grid: Name, MRN, 1st Phone, 2nd Phone, 3rd Phone, checkbox (default
  checked) — all three raw candidates shown, not just the one the tool would
  pick, so PSA can catch a wrong first candidate before it's sent.
- A separate visible section for "Needs Manual Lookup" cases — greyed out,
  informational, not actionable from this form.
- A separate visible section for "Duplicates collapsed" — informational,
  shows Encounter No and how many occurrences were collapsed, not actionable.
- PSA can uncheck any row before generating the broadcast file — this is the
  human error-catching step; nothing skips it.

### Stage 4 — `BuildBroadcastFile`
- Writes the phone-number-only sheet, one number per row (via
  `FirstUsableNumber` picking from each checked case's three candidates),
  with a header row labeled `Mobile Number` in row 1 (constraint #5),
  matching the NHG portal's expected upload format — confirm the exact
  label against a real successful upload (Testing Checklist item 6).
- Saves as `SMS_Broadcast_<YYYY-MM-DD>.xlsx` next to the tool, same naming
  convention as the Attendance Analyzer's output files.

### Stage 5 — Manual send (unchanged)
- PSA logs into the NHG portal and uploads the generated file, same steps as
  the current SOP.
- `MainMacro` shows a final prompt: "Mark as sent?" → if yes, appends a row to
  a run log (see below) with timestamp, case count, and a free-text field for
  whatever the portal displayed (record count, process status) — this becomes
  the audit trail, since the portal itself isn't queryable.

---

## Dedup rule

**Decision:** within a single run, if the same Encounter No appears more than
once in the eFC export, keep the **last occurrence** (bottom-most row in file
order) and collapse the rest.

**Why:** a repeat Encounter No most plausibly means PSA re-exported after a
correction (e.g. updated Comment), and later rows in an export reflect
the more recent state. This is an assumption pending real data — if the eFC
export turns out to have a modified-timestamp column, prefer that over row
order once confirmed.

**How to apply:** `DedupeEfcRows` runs before `IdentifySmsRequired`, so
identification and joining only ever see one row per Encounter No. The
collapsed count and the affected Encounter Nos surface in both the ReviewForm
(informational section) and the RunLog, never dropped invisibly — consistent
with the no-silent-drop principle.

---

## Run log (added to keep history)

A `RunLog` sheet in the workbook, one row per run:

| Timestamp | eFC file used | Epic file used | SMS-required count | Manual-lookup count | Duplicates collapsed | Unchecked/excluded count | Marked sent? | Portal notes (free text) |
|---|---|---|---|---|---|---|---|---|

This is the cheap-now version of the "persistent, queryable history" the
Power Apps/SharePoint design would have given for free — it lives in the
workbook, not a SharePoint List, so it's local to whoever runs the tool. If
multiple people need to see run history, this sheet needs to move to a
shared location (same concurrency caveat as everywhere else Excel is a
shared write target).

---

## Row/status flags (for the Review grid and log)

| Status | Meaning |
|---|---|
| SMS REQUIRED — matched | FC DONE + MCAF REMINDER found, at least one usable phone candidate joined |
| SMS REQUIRED — needs manual lookup | FC DONE + MCAF REMINDER found, no Epic match |
| NO FC DONE / WARD CLASS SELECTED | Needs FC follow-up, not an SMS case — informational only |
| Excluded by PSA | Case matched but unchecked in ReviewForm before file generation |
| Duplicate collapsed | Earlier occurrence of an Encounter No seen more than once — informational only |

---

## Architecture decisions (confirmed 2026-07-16)

1. Config lives as a sheet in the same workbook — matches existing MFC/
   Attendance pattern.
2. Output is a new file per run, never overwritten — same as Attendance
   Analyzer.
3. Matching logic (Comment string match) is a direct port of the existing
   Excel IF formula — not re-derived or "improved" during automation, to avoid
   silently changing behavior that's already in production use.
4. No case is ever silently dropped — unmatched, excluded, duplicate-collapsed,
   and follow-up-needed cases are all surfaced, never disappeared.
5. The actual SMS send stays manual until/unless the NHG portal gets a real
   API — don't build toward that assumption prematurely.

---

## Testing checklist

1. Compile clean (Debug → Compile VBAProject) before running anything.
2. Run against real eFC and Epic sample exports. eFC header names confirmed
   2026-07-24 (constraint #10) — matches what `FindColByHeader` expects, no
   code change needed. Epic side still open: confirm header names and that
   the export actually includes a Phone column (constraint #1's one
   remaining check).
3. Confirm the Comment string match doesn't over- or under-fire against
   real comment text — variants in phrasing/capitalization/spacing are the
   most likely edge case (same category of risk as the ICH triage discipline-
   string matching bug already found and fixed on that project).
4. Confirm join accuracy: spot-check 5-10 matched rows' Phone Number against
   the source Epic export by hand.
5. Confirm unmatched cases actually land in "Needs Manual Lookup" and aren't
   silently skipped.
6. Confirm the generated broadcast file's format — including the `Mobile
   Number` header label (constraint #5) — is accepted by the NHG portal on an
   actual upload. This is the one step of this pipeline that touches a live
   external system, so worth testing early rather than assuming format
   correctness from the doc alone.
7. Confirm RunLog appends correctly across multiple runs in the same session
   and doesn't overwrite prior rows.
8. Confirm dedup: create a test eFC export with a repeated Encounter No,
   verify only the last row is processed and the collapse is reflected in
   both ReviewForm and RunLog.
9. Confirm `ExtractMobileNumbers`/`FirstUsableNumber` against real Epic
   phone values — multi-number cells, asterisk-only prefixes,
   `88888888`/`99999999` placeholders, and cases with zero valid numbers
   (should land in "Needs Manual Lookup", not error out). Ported from the
   SMS TEMPLATE's `H`/`I`/`J` formulas but never run against a live Epic
   export.
10. Confirm the widened `ReviewForm` grid (Name/MRN/1st/2nd/3rd Phone/Send?)
    still fits and reads cleanly at typical case-list lengths — the extra
    two phone columns were sized without a real screen to test against.

---

## Honest weak points (not yet stress-tested)

- Comment free-text matching is inherently fragile to phrasing drift —
  if whoever enters comments changes wording ("MCAF Reminder Sent" vs
  "MCAF REMINDER"), the match silently stops firing. Worth a periodic manual
  spot-check even after this is automated, not a "set and forget."
- The Epic Census Snapshot Report needs Phone added to its export column
  selection if it isn't pulled by default — the one remaining unknown, and a
  column-selection check rather than a design risk.
- The dedup rule (keep last occurrence) is an assumption about what a repeat
  Encounter No means. If real data shows a different pattern (e.g. genuine
  distinct visits sharing an Encounter No by data-entry error, not a
  re-export), the rule needs revisiting.
- The `Mobile Number` header label is inferred from SOP wording, not a
  verified successful upload — confirm on first real test (Testing Checklist
  item 6).
- `ExtractMobileNumbers`'s parsing rules (8-digit runs starting with 8/9,
  non-overlapping, up to three) are a direct port of the template's own
  `H`/`I`/`J` formulas, but have only been checked against the four sample
  rows in the template file, not a full real Epic export — see Testing
  Checklist item 9.
- ~~The `SMS` / `CONTACT NUMBER` columns already present in the real eFC Task
  List Report export are unexplained~~ — resolved 2026-07-24: the real
  export's confirmed header row (constraint #10) doesn't contain either
  column. The earlier claim came from misreading the SMS TEMPLATE's
  reference sheet, not the live export.
- `ReviewForm`'s three-phone-column grid layout (widths/positions in
  `AddCaseGrid`) was sized by estimate, not tested in an actual Excel
  UserForm — see Testing Checklist item 10.
