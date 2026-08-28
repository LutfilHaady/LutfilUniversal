# SMS Broadcast — Config Sheet Design Spec

**Purpose:** Move the hardcoded matching rules and file-format assumptions in
the MCAF-M SMS Broadcast tool into an editable `Config` sheet, so non-technical
staff can fix phrasing drift, remapped column headers, or a wrong upload
label without a developer touching VBA.

**Relationship to existing design:** Extends
`docs/superpowers/specs/2026-07-16-sms-broadcast-design.md` (the original
tool design) and `BUILD_CONTEXT.md`, both of which already listed a Config
sheet as planned but never built. This spec is that missing piece.

**Pattern reused:** The sibling `MFC VBA Inflight` project already solves
this exact problem with `ConfigReader.bas` — a `Config` sheet read via
`ReadConfigList` (stop-at-blank columns) and `GetSetting` (key/value pairs),
always falling back to hardcoded defaults when the sheet or a specific
column/row is missing, so the macro works identically with no Config sheet
at all. This spec ports that pattern directly rather than inventing a new
one.

---

## Confirmed decisions (2026-07-21)

1. **Scope, in:** the 4 comment phrase-matching lists (MCAF Reminder, FC
   Done, No FC Done, Ward Class Selected — promoting Ward Class from a plain
   `InStr` check to the same variants pattern as the other three), the 6
   eFC/Epic external column header names, Epic's placeholder "not a real
   number" values, and the broadcast file's upload header label.
2. **Scope, out:** the number of phone candidates extracted (3) and the
   8-digit number length — changing either requires code changes elsewhere
   too (`SmsCase` fields, `ReviewForm`'s grid columns), so a Config cell
   alone can't actually make them work; not a real config surface. Also out:
   SG mobile prefix digits (8/9) — considered, not selected. Also out:
   RunLog columns and the output filename pattern — internal bookkeeping,
   no operational reason to expose them.
3. **Creation is a separate, explicit macro** (`CreateConfigSheet`, run via
   Alt+F8), not auto-created silently on first run of `GenerateSmsBroadcast`.
   If a `Config` sheet already exists, it warns and makes no changes —
   never overwrites edits someone has already made.
4. **Fallback is always hardcoded defaults.** Missing sheet, missing column,
   or an empty column all fall back silently to the tool's current behavior
   — the macro must work identically with no Config sheet present, same
   guarantee `ConfigReader.bas` already makes in the MFC macro.
5. **Config is loaded once per macro run**, not per row — `IdentifySmsRequired`
   and `JoinPhoneFromEpic` process eFC exports of arbitrary size, and
   re-reading the Config sheet on every row would not match the bulk-read
   discipline already used everywhere else in this codebase (`allData`,
   `epicData` reads).

---

## Config sheet layout

Two kinds of columns on one sheet, both readable independently by header
name — order/spacing between them doesn't matter, only the row-1 header
text does.

**A — Phrase/value lists** (one item per row; a blank cell stops that
column's list; columns are independent of each other):

| MCAF Reminder Phrases | FC Done Phrases | No FC Done Phrases | Ward Class Phrases | Epic Placeholder Numbers |
|---|---|---|---|---|
| MCAF REMINDER | FC DONE | NO FC DONE | WARD CLASS SELECTED | 88888888 |
| | PHONE FC DONE | | | 99999999 |

**B — Settings** (key/value pairs, one row per setting, matched by key —
same `Settings` / `Value` column pattern as the MFC macro's
`ConfigReader.GetSetting`):

| Settings | Value |
|---|---|
| eFC Encounter No Header | Encounter No |
| eFC MRN Header | MRN |
| eFC Patient Name Header | Patient Name |
| eFC Comment Header | Comment |
| Epic CSN Header | CSN |
| Epic Phone Header | Phone |
| Broadcast Upload Header | Mobile Number |

Only the 6 headers that come from **external** files (the eFC/Epic exports)
are remappable. Internal columns the tool itself creates (`MCAF Reminder`,
`1st/2nd/3rd Phone Number`) are not exposed — the tool controls their
spelling, so they can't drift the way a source system's report template can.

`CreateConfigSheet` seeds both blocks with the values shown above (today's
hardcoded defaults) so the sheet is immediately meaningful, not blank.

---

## New module: `ConfigReader.bas`

Ported from the MFC macro's `ConfigReader.bas`, trimmed to what this tool
needs:

- `GetConfigSheet() As Worksheet` — returns the `Config` sheet or `Nothing`.
- `ReadConfigList(headerName As String, ByRef count As Long) As String()` —
  bulk-reads one list column, stopping at the first blank cell. Returns an
  empty array with `count = 0` if the sheet or column is missing.
- `GetSetting(key As String, defaultVal As String) As String` — looks up one
  key in the `Settings`/`Value` pair, case-insensitive match, returns
  `defaultVal` if the sheet, the `Settings` column, or the key itself isn't
  found.
- `CreateConfigSheet()` — the Alt+F8 setup entry point. If `Config` already
  exists: `MsgBox "Config sheet already exists — no changes made."` and
  exit. Otherwise: creates the sheet, writes both blocks' headers (bold),
  and seeds every list/setting with the defaults shown above.

`FindColByHeader` (already in `Helpers.bas`) is reused as-is by
`ReadConfigList`/`GetSetting` — no duplicate header-matching logic.

---

## Changes to existing modules

**`CaseMatcher.bas`**
- `IsMcafReminder`, `IsFcDoneVariant`, `IsNoFcDoneVariant`, and a new
  `IsWardClassVariant` (promoting `WARD CLASS SELECTED` out of the plain
  `InStr` check in `IdentifySmsRequired`) all resolve their phrase list from
  `ConfigReader.ReadConfigList`, falling back to today's hardcoded phrase(s)
  if `count = 0`.
- `IsUsableNumber` resolves its placeholder list (`88888888`, `99999999`)
  the same way. (`ExtractMobileNumbers` itself stays untouched — it
  deliberately returns placeholder values as raw candidates for the human
  reviewer, same as today; only `IsUsableNumber`, the last-step filter, needs
  the config.)
- `IdentifySmsRequired` loads all 4 phrase lists **once**, before its
  per-row loop, and passes the loaded arrays down — no per-row Config reads.

**`BroadcastBuilder.bas`**
- `BuildReviewList` calls `FirstUsableNumber` once per `SMS REQUIRED` row to
  decide `cases` vs. `manualLookup`; `BuildBroadcastFile` calls it again once
  per checked row. Both load the placeholder-number list **once**, before
  their loops, and pass it down — not re-reading Config on every row.
- `BuildBroadcastFile`'s output header write
  (`ws.Cells(1, 1).Value = "Mobile Number"`) becomes
  `GetSetting("Broadcast Upload Header", "Mobile Number")`.

**`Helpers.bas`**
- `ValidateEfcFile`, `ValidateEpicFile`, and every other `FindColByHeader`
  call site across `CaseMatcher.bas` / `BroadcastBuilder.bas` that targets
  an external eFC/Epic column resolve the header text through
  `ConfigReader.GetSetting` first (e.g.
  `GetSetting("eFC Comment Header", "Comment")`), then pass that resolved
  string into `FindColByHeader`.
- Validation failure messages name whichever header text was actually
  searched for (the configured one, if set) — never silently reference the
  hardcoded default when a custom value is configured. This keeps the
  existing "fail loud with a specific reason" behavior honest.

---

## Data flow

1. (One-time, per deployment or whenever needed) Staff runs `CreateConfigSheet`
   via Alt+F8. A `Config` sheet appears, pre-filled with defaults, immediately
   editable like any other Excel sheet.
2. Staff edits `Config` directly — add a row to widen a phrase list, edit a
   `Value` cell to remap a column header or the upload label. No macro
   re-run needed to save; it's a normal worksheet.
3. On the next `GenerateSmsBroadcast` run, every stage that used a hardcoded
   value now reads the current `Config` sheet contents once at the point it
   needs them, applying edits from the most recent save automatically.
4. If `Config` is missing entirely (never created, or deleted), every
   lookup falls back to hardcoded defaults — the tool behaves exactly as it
   does today.

---

## Error handling

| Scenario | Behavior |
|---|---|
| `Config` sheet doesn't exist | All lookups fall back to hardcoded defaults, silently — matches today's behavior exactly |
| A specific list column or settings key is missing/blank | That one category falls back to its hardcoded default; other configured categories are unaffected |
| A configured header value (e.g. `Comment` → `Remarks`) doesn't match any column in the uploaded file | `ValidateEfcFile`/`ValidateEpicFile` fails loud, naming the actual configured text that was searched for — same fail-loud principle as today, just honest about what was actually looked for |
| `CreateConfigSheet` run when `Config` already exists | Warns, makes no changes — never overwrites existing edits |

---

## File inventory impact

- **New:** `ConfigReader.bas`.
- **Changed:** `CaseMatcher.bas`, `Helpers.bas`, `BroadcastBuilder.bas`.
- **`SMS_Broadcast_All_Modules.txt`** gains a new `ConfigReader.bas` module
  section (with the same "Insert > Module" import note style as the other
  standard modules) and must mirror every edit to the three changed modules
  — kept byte-identical per the existing convention in this project.
- **`BUILD_CONTEXT.md`** needs a new row in its file inventory table for
  `ConfigReader.bas`, a note that `CreateConfigSheet` is a second Alt+F8
  entry point alongside `GenerateSmsBroadcast`, and an update to §3 ("Does
  NOT exist yet") since the Config sheet moves from "planned but not built"
  to "built, created via `CreateConfigSheet`."

---

## Testing checklist (additions to the existing 10-item list)

1. Run `CreateConfigSheet` on a workbook with no `Config` sheet — confirm it
   creates the sheet, seeded with all 5 list columns and all 7 settings
   matching the defaults table above.
2. Run `CreateConfigSheet` again — confirm it warns and makes no changes
   (doesn't duplicate the sheet or reset edited values).
3. Delete the `Config` sheet entirely, run `GenerateSmsBroadcast` — confirm
   identification, join, and file generation all behave exactly as before
   the Config sheet existed.
4. Add a new phrase to each of the 4 phrase-list columns — confirm matching
   picks up the new phrase without any code change.
5. Edit `eFC Comment Header`'s value to a column name not present in a test
   eFC export — confirm `ValidateEfcFile` fails loud, naming the *edited*
   value, not the hardcoded default.
6. Edit `Broadcast Upload Header`'s value — confirm the generated broadcast
   file's header row reflects the new value.
7. Add a third value to `Epic Placeholder Numbers` — confirm
   `FirstUsableNumber` skips it when picking the broadcast number.
8. Blank out one list column entirely (delete all its rows, keep the
   header) — confirm that category falls back to its hardcoded default
   while other configured categories keep using their configured values.
9. Confirm `SMS_Broadcast_All_Modules.txt` is still byte-identical to the
   five `.bas` files plus the new `ConfigReader.bas` after this change.

---

## Architecture decisions (added to the 5 already confirmed in the original spec)

6. Config-with-fallback is the same pattern already proven in the sibling
   MFC macro's `ConfigReader.bas` — not a new mechanism invented for this
   tool.
7. Config sheet creation is an explicit, idempotent-safe action
   (`CreateConfigSheet`), never an implicit side effect of a normal
   broadcast run — a production run should never silently modify workbook
   structure.
8. Config is read in bulk, once per run, never per-row — consistent with
   every other data read in this codebase (`allData`, `epicData`).
