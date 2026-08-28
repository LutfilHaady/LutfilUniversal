# SMS Broadcast Automation — Build Context

Full picture of what this tool is, what's been decided, and what's actually
in this folder as of 2026-07-21. Written as a handoff/reference doc — the
detailed decision log with dates and rationale lives in
`docs/superpowers/specs/2026-07-16-sms-broadcast-design.md`; this doc is the
condensed "what is this and how does it fit together" version.

---

## 1. What this is

A VBA macro tool that automates most of the manual MCAF-M SMS reminder
workflow for inflight ED cases at TTSH — the process documented in
`SMS BROADCAST (INFLIGHT) 4 (1).docx` (the SOP, source of truth for the
manual process) and `SMS TEMPLATE (MCAF-S REMINDER).xlsx` (very likely
**Kenzo's SMS Template**, referenced in SOP step 4 — the real target output
structure).

**Automates:** identifying which patients need an SMS reminder, joining
their phone numbers from Epic, and generating the phone-number-only file for
upload to the NHG SMS portal.

**Does NOT automate:** the eFC/Epic report exports themselves (both source
systems are closed to automation — manual UI export, permanently) or the
actual SMS send (NHG portal has no upload/status API — manual login, upload,
and "mark as sent", permanently).

Same architecture pattern as two sibling projects: `MFC VBA Inflight` and
`Attendance VBA` -- `.xlsm` workbook, Config sheet, UserForms for file
selection and review, two macro entry points (Alt+F8 → `GenerateSmsBroadcast`
for a normal run, `CreateConfigSheet` for one-time Config sheet setup).

---

## 2. The real workflow (SOP → code mapping)

| SOP step | What it says | Code |
|---|---|---|
| 1–2 | Export eFC Task List Report, one day before today, Emergency admission type | Manual, unchanged (`FilePickerForm`, slot 1) |
| 3 | Add "MCAF Reminder" column, IF-formula on ED Comments ("FC DONE" + "MCAF REMINDER" → "SMS REQUIRED"); add Bed/Phone via XLOOKUP | `IdentifySmsRequired` (comment matching) + `JoinPhoneFromEpic` (phone join; no Bed — see §5) |
| 4 | Refer to Kenzo's SMS Template, copy in SMS-required cases | `BuildReviewList` + `ReviewForm` (this *is* the template's structure — see §5) |
| 5 | New sheet, phone numbers only, one per row under "Mobile" | `BuildBroadcastFile` |
| 6–10 | Manual NHG portal login, upload, verify, send | Manual, unchanged. `MainMacro` prompts "mark as sent?" and logs to `RunLog` as the audit trail (portal has no queryable history) |

---

## 3. File inventory

**Exists now (this session's output):**

| File | Role |
|---|---|
| `MainMacro.bas` | Entry point — `GenerateSmsBroadcast`, orchestrates all 7 steps |
| `Helpers.bas` | `ValidateEfcFile`, `ValidateEpicFile`, `FindColByHeader` (case/whitespace-tolerant header lookup), `NormHeader` |
| `ConfigReader.bas` | `GetConfigSheet`, `ReadConfigList`, `GetSetting`, `CreateConfigSheet` (Alt+F8 setup entry point) -- reads the `Config` sheet, ported from the sibling MFC macro's module of the same name |
| `CaseMatcher.bas` | `SmsCase` type, `DedupeEfcRows`, `IdentifySmsRequired`, `JoinPhoneFromEpic`, `ExtractMobileNumbers`, `FirstUsableNumber` |
| `BroadcastBuilder.bas` | `BuildReviewList`, `BuildBroadcastFile`, `AppendRunLog` |
| `FilePickerForm.bas` | UserForm code-behind — two file-select slots (eFC, Epic), inline validation |
| `ReviewForm.bas` | UserForm code-behind — checklist grid (Name/MRN/1st/2nd/3rd Phone/Send?), Manual Lookup + Duplicates-collapsed sections |
| `ProgressForm.bas` | UserForm code-behind — modeless progress bar, reused pattern from Attendance Analyzer |
| `SMS_Broadcast_All_Modules.txt` | All eight modules above concatenated with import instructions — kept byte-for-byte in sync with the `.bas` files every time they change |

**Does NOT exist yet — the actual compiling/assembly is left to you:**

- The `.xlsm` workbook itself. Nothing here is a real Excel file with a VBA
  project — these are plain-text `.bas`/form code-behind files. To get a
  working tool you need to: create a new `.xlsm`, insert 5 standard modules
  (paste `MainMacro`/`Helpers`/`ConfigReader`/`CaseMatcher`/`BroadcastBuilder` in directly)
  and 3 UserForms (`Insert > UserForm`, rename via the Properties window,
  paste the code-behind — each form's controls are built at runtime in
  `UserForm_Initialize`/`ShowXxx`, so there's no manual control-drawing to
  do). `SMS_Broadcast_All_Modules.txt` has the per-module import steps
  inline.
- A Config sheet — no longer a placeholder. Run `CreateConfigSheet` (Alt+F8)
  once after the workbook is assembled; it creates and seeds the sheet with
  today's default phrases, column-header mappings, and upload label. See
  `docs/superpowers/specs/2026-07-21-sms-broadcast-config-sheet-design.md`.
- An Instructions sheet — same, planned but not built.
- A `RunLog` sheet — this one auto-creates itself on first run
  (`AppendRunLog` in `BroadcastBuilder.bas`), nothing to pre-build.

---

## 4. What each stage actually does

1. **`FilePickerForm`** — two "Browse..." buttons. Picking a file immediately
   runs `ValidateEfcFile`/`ValidateEpicFile` and shows Valid/Invalid inline
   with a specific reason (e.g. "eFC file missing 'Comment' column") rather
   than a generic error later. "Run" only enables once both slots are valid.
2. **`DedupeEfcRows`** — if the same Encounter No appears more than once,
   keeps the **last** occurrence (bottom-most row) and collapses the rest.
   Rationale: a repeat most likely means a re-export after a correction, and
   later rows reflect the newer state. Logged (count + which Encounter Nos)
   to both `ReviewForm` and `RunLog` — never a silent drop.
3. **`IdentifySmsRequired`** — reads the `Comment` column, flags each row:
   - `"SMS REQUIRED"` — contains `FC DONE` (or `PHONE FC DONE`, matched via
     the same substring) AND `MCAF REMINDER`, with `NO FC DONE` explicitly
     excluded first (so it doesn't false-positive on the substring `FC DONE`
     inside `NO FC DONE`).
   - `"NO FC DONE / WARD CLASS SELECTED"` — needs FC follow-up, not an SMS
     case. Surfaced as a distinct count, not dropped.
   - Direct port of the SOP's existing IF-formula logic, not re-derived.
4. **`JoinPhoneFromEpic`** — bulk dictionary join on `Encounter No` (eFC) =
   `CSN` (Epic). For each `SMS REQUIRED` row, runs Epic's raw `Phone` field
   through `ExtractMobileNumbers` and writes three columns: `1st/2nd/3rd
   Phone Number`.
5. **`BuildReviewList`** — splits `SMS REQUIRED` rows into `cases` (at least
   one of the three phone candidates is usable) and `manualLookup` (no Epic
   match, or all three candidates are blank/placeholder). Never drops a row
   silently either way.
6. **`ReviewForm`** — the human error-catching step. Grid shows Name, MRN,
   and all three raw phone candidates (not just the one the tool would
   pick) with a checkbox per row, default checked. Separate greyed-out
   sections list "Needs Manual Lookup" and "Duplicates collapsed" cases,
   informational only.
7. **`BuildBroadcastFile`** — for each checked row, resolves the three
   candidates down to one via `FirstUsableNumber` (skip blank, skip Epic's
   `88888888`/`99999999` placeholders) and writes it to a new sheet, one
   number per row, under header `Mobile Number`. Saves as
   `SMS_Broadcast_<YYYY-MM-DD>.xlsx` next to the tool, never overwriting —
   appends `_2`, `_3`... if a file from an earlier run today exists.
8. **`AppendRunLog`** — after the "mark as sent?" prompt, appends one row
   (timestamp, files used, SMS-required/manual-lookup/duplicate/excluded
   counts, sent Y/N, free-text portal notes) to a `RunLog` sheet that
   auto-creates itself on first use.

---

## 5. Confirmed data contracts (the columns that actually matter)

These were extracted from the real files, not assumed — see the design
spec's "Confirmed constraints" and "Template findings" sections for the
verification trail.

**eFC Task List Report export** — full header row confirmed 2026-07-24
directly from the real export (not the SMS TEMPLATE's reference sheet):
`Institution`, `MRN`, `Encounter No`, `Admission Date`, `Admission Time`,
`Financial Counselling ID`, `Financial Counselling Mode`, `FC Status`,
`Task Id`, `Created Date`, `Created By`, `Last Updated By`, `Task Status`,
`Due Date`, `Visit/Admission Type`, `Specialty`, `Task Type`,
`Patient Name`, `Task Description`, `Deletion Reason`, `Assigned Team`,
`Task Category`, `Comment`. Columns the code reads:
- `Encounter No` (case-insensitive match against the export's `ENCOUNTER NO`)
- `MRN` — direct pass-through, no lookup needed
- `Patient Name`
- `Comment` — **not** `ED Comments`; this was a real bug caught mid-build

No `SMS` or `CONTACT NUMBER` column in the real export — an earlier read of
the SMS TEMPLATE's reference sheet suggested those existed; the real header
list contradicts that. Resolved, no longer an open question (see §6).

**Epic Census Snapshot Report export** — columns the code reads:
- `CSN` (join key, = eFC's `Encounter No`)
- `Phone` — messy multi-line value, see below

**Epic's raw phone field format** (confirmed from SMS TEMPLATE sample data):
```
*9327 2613 (Mobile)
6677 1216 (Home Phone)
9664 9678 (Work Phone)
```
Asterisk marks a preferred number; one or more labelled numbers separated by
line breaks. `ExtractMobileNumbers` strips spaces/asterisks and scans for up
to three non-overlapping 8-digit runs starting with `8` or `9` (SG mobile
prefixes) — a direct port of the SMS TEMPLATE's own `H`/`I`/`J` formulas
("1st/2nd/3rd phone number"). Epic uses `88888888` and `99999999` as
placeholder "no real number" values; these are still returned as raw
candidates (visible to the reviewer) but `FirstUsableNumber` skips them when
picking the one number for the broadcast file.

**SMS TEMPLATE workbook — columns actually used** (confirmed 2026-07-21,
after an initial over-broad read of "every blank column is required"):
```
Encounter No | MRN | Patient Name | Phone Number | 1st phone number | 2nd phone number | 3rd phone number
```
**Disregarded:** `FC ID`, `Admission Date`, `Admission Status` (not used at
all), and everything from the `FTF/SMS checker` column onward — including a
Financial-Counselling tracking block (`Point Of Care`, `Final Bed`, `FC
Status`, `NeFR Consent Status`, bill-size variance, etc.) that also had
`#N/A` in `Final Bed`/`Epic Admission Status` on every sample row, so it was
dead weight even if it had been in scope. **No Bed field anywhere** in the
used set — dropped from the tool entirely (no Bed lookup, no Bed column
requirement on the Epic file, no Bed field in `SmsCase` or `ReviewForm`).

**Broadcast file (final upload artifact):** single column, header `Mobile
Number` — inferred from the SOP text (step 5 says "Mobile" column, step 9
says "Mobile Number" as the content-type field; `Mobile Number` was picked
as matching the portal's own field label most literally, but the exact
string is unverified — see §6).

---

## 6. Known open questions (not acted on, need real data or a real answer)

- **Epic Census Snapshot Report's real header row** is still unconfirmed —
  eFC's is now confirmed (§5), Epic's `CSN`/`Phone` are still inferred from
  the SMS TEMPLATE sample data, not a live export.
- **`Mobile Number` header label** is inferred from SOP wording, not a
  verified successful portal upload.
- **`ExtractMobileNumbers`/`FirstUsableNumber` parsing rules** are a direct
  port of the SMS TEMPLATE's `H`/`I`/`J` formulas but have only been checked
  against the four sample rows in the template file, not a real Epic export.
- **`ReviewForm`'s widened grid** (Name/MRN/1st/2nd/3rd Phone/Send?, sized
  for a ~600-unit-wide form) has never been opened in actual Excel — layout
  is an estimate.
- **Dedup rule** (keep last occurrence on repeat Encounter No) is an
  assumption about what a repeat means, pending real data.
- **Comment string matching** (`FC DONE` + `MCAF REMINDER` substring match)
  is fragile to phrasing drift by whoever enters comments — worth a periodic
  manual spot-check even after automation.

Full detail and dates on each of these are in the design spec's "Honest weak
points" and "Testing checklist" sections.

---

## 7. Architecture decisions worth knowing before touching this code

1. Config lives as a sheet in the same workbook, seeded on demand via
   `CreateConfigSheet` (see §3) — matches the MFC/Attendance pattern, not a
   separate file.
2. Output is a new file per run, never overwritten.
3. Comment string matching is a **direct port** of the SOP's existing IF
   formula, deliberately not re-derived or "improved" — avoids silently
   changing behavior already in production use.
4. No case is ever silently dropped — unmatched, excluded,
   duplicate-collapsed, and follow-up-needed cases are all surfaced as
   distinct counts/sections, never disappeared.
5. The actual SMS send stays manual permanently — not a placeholder pending
   a future NHG API.
6. Phone resolution shows all three raw candidates to the human reviewer
   rather than silently picking one — the "one number per broadcast row"
   requirement is enforced only at the very last step
   (`BuildBroadcastFile`), not hidden earlier in the pipeline.

---

## 8. Before you compile

Cross-check `SMS_Broadcast_All_Modules.txt` is still byte-identical to the
eight `.bas` files if you hand-edit anything — it's meant to be a verbatim
concatenation, not a summary. The testing checklist in the design spec
(section "Testing checklist", 10 items) covers what to verify once you have
real eFC/Epic sample exports to run against.
