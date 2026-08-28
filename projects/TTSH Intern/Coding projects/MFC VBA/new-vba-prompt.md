I'm starting a brand-new Excel VBA macro project (unrelated in domain to my existing MFC report
macro, but I want to reuse its UI/validation scaffolding). There is no build system, test runner,
or CLI for this code — it's VBA that runs inside Excel via the VBA editor (Alt+F11).

## What to reuse verbatim (structure), then adapt (content)

Two UserForms and one validation pattern from my MFC project should be carried over almost
unchanged — copy their control-building structure and event wiring, then relabel/retarget them
for this new project:

1. **A file-picker UserForm** (`FilePickerForm` in the source project) that:
   - Builds all controls in code at `UserForm_Initialize` (no hand-drawn form) via small
     `CreateLabel(name, caption, left, top, width, height, bold)` and
     `CreateButton(name, caption, left, top, width, height)` helper functions.
   - Has one "row" per required input file: a bold section label, a "Browse..." button, a
     filename label (defaults to "(not selected)"), and a status glyph label ("○" unselected,
     "✓ Valid" green, "✗ Invalid" red).
   - Uses `Application.FileDialog(msoFileDialogFilePicker)` filtered to Excel files, remembers
     the last folder picked (`m_lastFolder`) and seeds `fd.InitialFileName` with it so the user
     isn't stuck re-navigating, and calls `AppActivate Me.Caption` after the dialog closes to
     return focus to the form.
   - Opens the picked file with `Workbooks.Open`, tracks the returned `Workbook` in a
     public property per slot (e.g. `SelectedX`), and — critically — only closes a slot's
     previous workbook if no *other* slot still references that same `Workbook` object
     (Workbooks.Open hands back the same instance if the same file is picked twice; closing it
     blindly crashes the other slot). Model this after `CloseSlotWorkbook`/`HandleSlotPick`.
   - Runs each slot's file through a shared header-validation function on selection, sets the
     status label/color from the result, then calls a single `UpdateValidationStatus` routine
     that re-derives ALL cross-slot state (duplicate-file conflicts between slots, any
     row-count/sanity warnings, and whether the "Generate"/primary action button should be
     enabled) from scratch every time — never patch validation state incrementally.
   - Has a "Generate"/primary button (disabled until every slot is valid) and a "Cancel" button
     that closes any opened workbooks and hides the form; blocks the window's native X button
     via `UserForm_QueryClose` so the user can't dismiss it mid-flow without going through Cancel.
   - Exposes a single `Public Function ShowXPicker() As Boolean` entry point that resets all
     state, does `Me.Show vbModal`, and returns whether the user completed vs. cancelled.

2. **A modeless progress-bar UserForm** (`ProgressForm` in the source project) that:
   - Exposes `ShowProgress(totalSteps As Long)`, `Update(stepNum As Long, message As String)`,
     and `CloseProgress()`.
   - Builds a step-label + a two-layer "track" and "fill" `Label` control (fill's `.Width` scaled
     by `stepNum / totalSteps`) lazily/idempotently (guarded so rebuilding is a no-op).
   - Shows `vbModeless` and calls `Me.Repaint` (+ `DoEvents` on `Update`) so the bar visibly
     redraws even while the caller runs with `ScreenUpdating = False`.
   - Blocks the native close button the same way as the file picker.

3. **Header-based file validation** (`ValidateFileHeaders` / `FindColByHeader` / `NormHeader` in
   the source project), NOT hardcoded validation:
   - `FindColByHeader(ws, headerName)` scans row 1 of a sheet and returns the 1-based column
     index of the first header matching `headerName`, or 0 if absent.
   - Matching goes through `NormHeader`, which normalizes both sides (convert line breaks /
     non-breaking spaces / tabs to plain spaces, collapse repeated spaces, trim, uppercase)
     so wrapped/Alt+Enter headers still match.
   - `ValidateFileHeaders(wb, fileType)` opens `wb.Sheets(1)` and, per `fileType`, asserts a
     fixed list of required headers are all present (`FindColByHeader(...) > 0`) — this is the
     single check gating whether a slot in the file picker shows ✓ or ✗.

## What's actually new here (fill these in / I'll tell you)

- **Project name / purpose:** [DESCRIBE THE NEW MACRO'S DOMAIN AND GOAL HERE]
- **Input files:** [LIST HOW MANY FILES THE FORM NEEDS, ONE ROW EACH, E.G. "File A (xlsx) —
  the source export", "File B — the reference/lookup file", etc.]
- **Required headers per file type:** [FOR EACH FILE TYPE ABOVE, LIST THE COLUMN HEADERS THAT
  `ValidateFileHeaders` MUST CHECK FOR. If a file type should accept anything (like MFC's
  legacy "PREV_MFC" always-valid case), say so explicitly.]
- **Cross-slot warnings, if any:** [E.G. "warn if the same file is picked for two slots", "warn
  if row counts look inconsistent between two files" — or say none needed.]
- **Processing steps after Generate is clicked:** [LIST THE PIPELINE STEPS THE MACRO RUNS,
  e.g. "1. combine X, 2. filter Y, 3. lookup Z against reference, 4. write output sheet" — this
  determines `totalSteps` and the messages passed to `ProgressForm.Update`.]
- **Output:** [DESCRIBE THE OUTPUT SHEET LAYOUT/COLUMNS AND WHERE IT'S SAVED.]

## Architecture rules to follow from the start (carried over from the source project's CLAUDE.md)

- **Resolve columns by header, never by hardcoded index.** Always go through a
  `FindColByHeader`-style lookup; input reports add/move columns over time and positional
  indexing breaks silently. This is the single most important invariant.
- **Load–process–write in bulk.** Read a used range into a `Variant` array once, do all logic in
  memory (arrays + `Scripting.Dictionary` for lookups), write back in one assignment. Do not
  touch cells one at a time in a loop for anything that could be thousands of rows.
- **No hardcoded file paths.** All file selection goes through `Application.FileDialog`, driven
  by the file-picker form above.
- **One responsibility per module**, with a single `MainMacro`-style module that only
  orchestrates calls to the others in order (mirroring how the source project's `MainMacro.bas`
  just calls out to `CombineEFC`, `FilterFCStatus`, `EpicLookup`, `BuildOutput`, etc. in
  sequence) — don't let orchestration logic leak into the worker modules.
- **`IIf()` is NOT short-circuit in VBA** — it evaluates both branches. Never use it to guard
  against a bad index/reference (e.g. `IIf(col > 0, arr(i, col), "")` still evaluates `arr(i, 0)`
  and throws runtime error 9 when `col = 0`). Use an explicit `If/Then` guard instead.
- **`.Value` on a range is 1-based**, and a single-cell range returns a scalar, not a 2-D array
  (`UBound` on it throws) — guard for the single-data-row case wherever it matters.
- Put `Option Explicit` at the top of every module.
- Any `FindColByHeader`-style lookup returns 0 when the header is absent — always check for 0
  before indexing with the result.

## Deliverable structure

Set this up the same way as the source project:
- Individual `.bas` module files (one per responsibility) and `.frm`-equivalent UserForm code
  files in the repo root, as the dev source.
- A single concatenated `All_Modules.txt` (or similarly named) file containing every module,
  which is what actually gets pasted into the Excel VBA editor — since UserForms can't be
  pasted as plain text modules, keep the same "IMPORT NOTE" comment block at the top of each
  UserForm's code explaining how to manually create the UserForm in the VBA editor (Insert >
  UserForm, set `(Name)` in the Properties window, then paste the code from `Option Explicit`
  down).
- Keep the two files in sync after every change, and keep the `.txt` in clean ASCII (`--` for
  dashes, no smart quotes).
- A `CLAUDE.md` at the project root capturing these same conventions so future sessions (mine or
  yours) don't have to be re-told them.

Please start by asking me any clarifying questions about the blanks above before writing code —
I'd rather nail down the file/header/output shape first than have you guess.
