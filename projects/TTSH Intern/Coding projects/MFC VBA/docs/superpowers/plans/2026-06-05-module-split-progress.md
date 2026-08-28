# Module Split + Progress Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the two oversized VBA modules (`BuildOutput.bas` 793 lines, `FilterRows.bas` 271 lines) into small single-purpose files, cut dead code, and add a visible progress-bar window — with zero change to runtime behaviour or output.

**Architecture:** Pure code relocation between standard modules plus one new modeless UserForm. VBA standard-module procedures share a global namespace, so a relocated procedure stays callable as long as it is `Public` when called across a module boundary. The single concatenated deliverable `MFC_All_Modules.txt` is regenerated from the `.bas` files by `regen_modules.ps1` after every change.

**Tech Stack:** Excel VBA (`.bas` standard modules + code-built UserForms), PowerShell (`regen_modules.ps1`), git. No test runner or CLI exists — verification is static (grep) + idempotent regen, with a final manual compile/run in Excel.

---

## Conventions used by every task

- **No test framework.** "Verify" steps are exact `grep`/PowerShell commands with expected output. Run them via the Bash or PowerShell tool.
- **`.bas` encoding:** UTF-8 **no BOM**, **CRLF**. `MFC_All_Modules.txt`: UTF-8 **BOM**, CRLF. New `.bas` files must match (the Write tool may emit LF — if a created file shows LF, normalize it the way `FilePickerForm.bas` was made: write via PowerShell `[System.IO.File]::WriteAllText` with a `UTF8Encoding($false)` and CRLF).
- **Regen + sync after every code change:**
  ```bash
  cd "C:/Users/lutfi/OneDrive/Desktop/TTSH Intern/Coding projects/MFC VBA"
  pwsh -File regen_modules.ps1   # or: powershell -File regen_modules.ps1
  ```
- **Reusable "no duplicate procedure definitions" check** (run after relocations; expected: empty output):
  ```bash
  grep -rhnE '^(Public |Private )?(Sub|Function) ' *.bas \
    | sed -E 's/\(.*//; s/^.*(Sub|Function) +//' | sort | uniq -d
  ```
- **Working directory** for all commands: `C:/Users/lutfi/OneDrive/Desktop/TTSH Intern/Coding projects/MFC VBA`.
- **Do NOT** change any procedure body during a move except the documented `Private`→`Public` keyword changes. Output and logic must stay byte-identical.

---

## Task 1: Cut dead code + commit the spec/plan

**Files:**
- Modify: `Helpers.bas` (remove `PickFile` ~lines 6–19, `PickAndValidateFile` ~lines 58–90)
- Modify: `MFC_All_Modules.txt` (regenerated)
- Add to commit: the spec + this plan

- [ ] **Step 1: Confirm the two functions are dead**

```bash
grep -rnE 'PickAndValidateFile|[^h]PickFile' *.bas | grep -vE 'Function PickFile|Function PickAndValidateFile|PickFileWithFolder'
```
Expected: only the internal call `Set wb = PickFile(title)` inside `PickAndValidateFile` (Helpers.bas) — i.e. no *external* caller. (`PickFileWithFolder` in the form is unrelated.)

- [ ] **Step 2: Delete both functions from `Helpers.bas`**

Remove the entire `Public Function PickFile ... End Function` block and the entire `Public Function PickAndValidateFile ... End Function` block (including their leading comment lines). Leave `ValidateFileHeaders`, `FindColByHeader`, `NormHeader`, `CreateConfigSheet` untouched.

- [ ] **Step 3: Verify removal and no dangling references**

```bash
grep -cE '(Function|Sub) (PickFile|PickAndValidateFile)\b' Helpers.bas   # expect 0
grep -rn 'PickAndValidateFile\b' *.bas                                    # expect no matches
grep -rnE '\bPickFile\b' *.bas | grep -v PickFileWithFolder               # expect no matches
```

- [ ] **Step 4: Regenerate and confirm sync**

```bash
pwsh -File regen_modules.ps1
grep -c 'efbbbf' /dev/null 2>/dev/null; head -c3 MFC_All_Modules.txt | od -An -tx1   # expect ef bb bf
# idempotency:
H1=$(sha256sum MFC_All_Modules.txt); pwsh -File regen_modules.ps1; H2=$(sha256sum MFC_All_Modules.txt)
[ "${H1%% *}" = "${H2%% *}" ] && echo SYNC_OK || echo SYNC_FAIL
```
Expected: `SYNC_OK`, BOM present.

- [ ] **Step 5: Commit (includes the design spec + this plan)**

```bash
git add Helpers.bas MFC_All_Modules.txt \
  "docs/superpowers/specs/2026-06-05-module-split-progress-design.md" \
  "docs/superpowers/plans/2026-06-05-module-split-progress.md"
git commit -m "Refactor: remove dead file-picker helpers; add module-split spec/plan

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Split `FilterRows.bas` → `FilterFCStatus.bas` + `FilterBedCode.bas`

**Files:**
- Create: `FilterFCStatus.bas`
- Create: `FilterBedCode.bas`
- Delete: `FilterRows.bas`
- Modify: `regen_modules.ps1`, `MFC_All_Modules.txt`

- [ ] **Step 1: Create `FilterFCStatus.bas`**

Header scaffold (literal), then move the **5 constants** (`FC_DRAFT`, `FC_DRAFT_ETBS`, `FC_DRAFT_CCF`, `ADM_ACTUALISED`, `ADM_PLANNED`) and the **`FilterFCStatus` function** (current `FilterRows.bas` lines 39–166) verbatim:

```vba
Attribute VB_Name = "FilterFCStatus"
Option Explicit

' ============================================================
' FilterFCStatus.bas
'
' FilterFCStatus -- keeps only rows that are Missed FC = "Yes", OR one of the
' three allowed Draft FC statuses with Admission Status Actualised/Planned.
' Runs BEFORE LookupEpicData so the Epic lookup only processes relevant rows.
'
' Load-filter-write strategy: reads the sheet once into a Variant array,
' compacts matching rows in memory, writes back in one bulk operation.
' ============================================================

Private Const FC_DRAFT      As String = "Draft"
Private Const FC_DRAFT_ETBS As String = "Draft (ETBS Generated)"
Private Const FC_DRAFT_CCF  As String = "Draft (CCF Generated)"

Private Const ADM_ACTUALISED As String = "Actualised"
Private Const ADM_PLANNED    As String = "Planned"

' <<< paste the FilterFCStatus function here, verbatim from FilterRows.bas lines 39-166 >>>
```

- [ ] **Step 2: Create `FilterBedCode.bas`**

```vba
Attribute VB_Name = "FilterBedCode"
Option Explicit

' ============================================================
' FilterBedCode.bas
'
' FilterBedCode -- keeps only rows whose ward code (Mid(bed,2,3)) is an NCID
' ward. Runs AFTER LookupEpicData (the Bed column comes from Epic).
'
' Load-filter-write strategy: one read + one write + one delete for ~20,000 rows.
' ============================================================

' NCID ward allowlist for the bed filter. A bed is kept when Mid(bed, 2, 3)
' matches one of these codes. Example: "T07E18N" -> "07E". Single-digit floors
' are zero-padded. To retarget this filter to another department, edit this one
' constant.
Private Const NCID_WARDS As String = "14F,12E,11E,08E,09F,08F,07F,07E,06F,11F,03E,05F"

' <<< paste the FilterBedCode sub here, verbatim from FilterRows.bas lines 167-271 >>>
```

> If `FilterBedCode` references any of the FC_DRAFT/ADM_ constants, STOP — re-check; per the source it uses only `NCID_WARDS`. Likewise `FilterFCStatus` must not reference `NCID_WARDS`.

- [ ] **Step 3: Delete `FilterRows.bas`**

```bash
git rm FilterRows.bas
```

- [ ] **Step 4: Update `regen_modules.ps1` `$modules`**

Replace `'FilterRows.bas',` with the two new files in order. The full array becomes:

```powershell
$modules = @(
    'Helpers.bas',
    'MainMacro.bas',
    'CombineEFC.bas',
    'ExtractDate.bas',
    'FilterFCStatus.bas',
    'FilterBedCode.bas',
    'EpicLookup.bas',
    'FlagDuplicates.bas',
    'BuildOutput.bas',
    'FilePickerForm.bas'
)
```

- [ ] **Step 5: Verify split + regen + sync**

```bash
grep -cE 'Function FilterFCStatus' FilterFCStatus.bas   # expect 1
grep -cE 'Sub FilterBedCode' FilterBedCode.bas          # expect 1
grep -rn 'NCID_WARDS' FilterFCStatus.bas                # expect no matches
grep -rn 'FilterRows' *.bas *.ps1                       # expect no matches
ls FilterRows.bas 2>/dev/null && echo STILL_THERE || echo DELETED
pwsh -File regen_modules.ps1
# duplicate-def check (expect empty):
grep -rhnE '^(Public |Private )?(Sub|Function) ' *.bas | sed -E 's/\(.*//; s/^.*(Sub|Function) +//' | sort | uniq -d
```

- [ ] **Step 6: Commit**

```bash
git add FilterFCStatus.bas FilterBedCode.bas regen_modules.ps1 MFC_All_Modules.txt
git rm FilterRows.bas 2>/dev/null
git commit -m "Refactor: split FilterRows into FilterFCStatus + FilterBedCode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Extract `Dropdowns.bas` from `BuildOutput.bas`

Order rationale: extract the leaf modules first (the ones BuildMFCOutput/BacklogSummary *call into*), making their entry points `Public`, so every intermediate state still compiles.

**Files:**
- Create: `Dropdowns.bas`
- Modify: `BuildOutput.bas` (remove 5 procedures), `regen_modules.ps1`, `MFC_All_Modules.txt`

- [ ] **Step 1: Create `Dropdowns.bas`**

Scaffold, then move these procedures verbatim from `BuildOutput.bas`: `AddDropdowns` (594–606), `SetupResolutionDropdown` (607–642), `CreateListsSheet` (643–686), `ApplyConfigDropdowns` (687–751), `ReadConfigColumn` (752–792). **Change only** `AddDropdowns` from `Private` to `Public` (it is called by `BuildMFCOutput` across the boundary). The other four stay `Private`.

```vba
Attribute VB_Name = "Dropdowns"
Option Explicit

' ============================================================
' Dropdowns.bas
'
' AddDropdowns (Public entry) -- adds the Resolution Status dropdown (col E)
' and the Config-driven dropdowns (cols A, C) to the output sheet, backed by a
' hidden "Lists" sheet copied from the macro workbook's Config sheet.
' ============================================================

' <<< paste AddDropdowns here, changing "Private Sub" -> "Public Sub" >>>
' <<< paste SetupResolutionDropdown, CreateListsSheet, ApplyConfigDropdowns, ReadConfigColumn verbatim (stay Private) >>>
```

- [ ] **Step 2: Remove the 5 procedures from `BuildOutput.bas`**

Delete those exact procedure blocks (and their leading banner comments) from `BuildOutput.bas`.

- [ ] **Step 3: Verify the `Public` change and the call site**

```bash
grep -cE 'Public Sub AddDropdowns' Dropdowns.bas        # expect 1
grep -cE '(Sub|Function) (AddDropdowns|SetupResolutionDropdown|CreateListsSheet|ApplyConfigDropdowns|ReadConfigColumn)' BuildOutput.bas  # expect 0
grep -cE 'AddDropdowns ' BuildOutput.bas                # expect 1 (the call inside BuildMFCOutput)
```

- [ ] **Step 4: Add `'Dropdowns.bas'` to `regen_modules.ps1`**

Insert `'Dropdowns.bas',` immediately after `'BuildOutput.bas',` in `$modules`.

- [ ] **Step 5: Regen + duplicate check + sync**

```bash
pwsh -File regen_modules.ps1
grep -rhnE '^(Public |Private )?(Sub|Function) ' *.bas | sed -E 's/\(.*//; s/^.*(Sub|Function) +//' | sort | uniq -d   # expect empty
```

- [ ] **Step 6: Commit**

```bash
git add Dropdowns.bas BuildOutput.bas regen_modules.ps1 MFC_All_Modules.txt
git commit -m "Refactor: extract Dropdowns.bas from BuildOutput

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Extract `OutputWriter.bas` from `BuildOutput.bas`

**Files:**
- Create: `OutputWriter.bas`
- Modify: `BuildOutput.bas` (remove 3 procedures), `regen_modules.ps1`, `MFC_All_Modules.txt`

- [ ] **Step 1: Create `OutputWriter.bas`**

Move `WriteOutputHeaders` (197–232), `WriteOutputData` (233–269), `FormatOutputSheet` (270–294) verbatim. **Change all three** from `Private` to `Public` (each is called by `BuildMFCOutput`).

```vba
Attribute VB_Name = "OutputWriter"
Option Explicit

' ============================================================
' OutputWriter.bas
'
' Writes and formats the output sheet cells (cols A-P). Called by
' BuildMFCOutput. For the full A-P column meaning, see the header of
' BuildOutput.bas.
'   WriteOutputHeaders -- row 1 headers
'   WriteOutputData    -- data rows from the working array
'   FormatOutputSheet  -- fonts, borders, freeze panes, autofit
' ============================================================

' <<< paste the 3 procedures, each "Private Sub" -> "Public Sub" >>>
```

- [ ] **Step 2: Remove the 3 procedures from `BuildOutput.bas`**

- [ ] **Step 3: Verify**

```bash
grep -cE 'Public Sub (WriteOutputHeaders|WriteOutputData|FormatOutputSheet)' OutputWriter.bas   # expect 3
grep -cE '(Sub) (WriteOutputHeaders|WriteOutputData|FormatOutputSheet)' BuildOutput.bas          # expect 0
```

- [ ] **Step 4: Add `'OutputWriter.bas',` after `'Dropdowns.bas',` in `regen_modules.ps1`**

- [ ] **Step 5: Regen + duplicate check + sync**

```bash
pwsh -File regen_modules.ps1
grep -rhnE '^(Public |Private )?(Sub|Function) ' *.bas | sed -E 's/\(.*//; s/^.*(Sub|Function) +//' | sort | uniq -d   # expect empty
```

- [ ] **Step 6: Commit**

```bash
git add OutputWriter.bas BuildOutput.bas regen_modules.ps1 MFC_All_Modules.txt
git commit -m "Refactor: extract OutputWriter.bas from BuildOutput

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Extract `SummaryTable.bas` from `BuildOutput.bas`

**Files:**
- Create: `SummaryTable.bas`
- Modify: `BuildOutput.bas` (remove `WriteSummaryTable`), `regen_modules.ps1`, `MFC_All_Modules.txt`

- [ ] **Step 1: Create `SummaryTable.bas`**

Move `WriteSummaryTable` (517–593) verbatim. **Change** `Private` to `Public` (called by `BacklogSummary`, which remains in `BuildOutput.bas` at this point and will move in Task 6 — either way the call is cross-module after Task 6, so Public is required).

```vba
Attribute VB_Name = "SummaryTable"
Option Explicit

' ============================================================
' SummaryTable.bas
'
' WriteSummaryTable (Public) -- writes the executive summary table three rows
' below the last patient record: Total Cases, Backlog, Today's Cases, plus the
' yellow manual-entry cells (To Follow Up on CCF, EL Admissions). Called by
' BacklogSummary.
' ============================================================

' <<< paste WriteSummaryTable, "Private Sub" -> "Public Sub" >>>
```

- [ ] **Step 2: Remove `WriteSummaryTable` from `BuildOutput.bas`**

- [ ] **Step 3: Verify**

```bash
grep -cE 'Public Sub WriteSummaryTable' SummaryTable.bas   # expect 1
grep -cE 'Sub WriteSummaryTable' BuildOutput.bas           # expect 0
grep -cE 'WriteSummaryTable ' BuildOutput.bas              # expect 1 (the call inside BacklogSummary, still here)
```

- [ ] **Step 4: Add `'SummaryTable.bas',` after `'OutputWriter.bas',` in `regen_modules.ps1`**

- [ ] **Step 5: Regen + duplicate check + sync**

```bash
pwsh -File regen_modules.ps1
grep -rhnE '^(Public |Private )?(Sub|Function) ' *.bas | sed -E 's/\(.*//; s/^.*(Sub|Function) +//' | sort | uniq -d   # expect empty
```

- [ ] **Step 6: Commit**

```bash
git add SummaryTable.bas BuildOutput.bas regen_modules.ps1 MFC_All_Modules.txt
git commit -m "Refactor: extract SummaryTable.bas from BuildOutput

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Extract `Backlog.bas` from `BuildOutput.bas`

After this task `BuildOutput.bas` contains only `BuildMFCOutput`, `ValidateSourceColumns`, `CaptureRedFlags`, `SaveOutputFile`.

**Files:**
- Create: `Backlog.bas`
- Modify: `BuildOutput.bas` (remove 3 procedures), `regen_modules.ps1`, `MFC_All_Modules.txt`

- [ ] **Step 1: Create `Backlog.bas`**

Move `BacklogSummary` (342–400, already `Public`), `LoadPreviousMFC` (401–472, stays `Private`), `ApplyCarryForward` (473–516, stays `Private`) verbatim.

```vba
Attribute VB_Name = "Backlog"
Option Explicit

' ============================================================
' Backlog.bas
'
' BacklogSummary (Public) -- compares the output against the previous MFC
' report, carries forward manual cols A-D for still-open cases, computes
' Total/Backlog counts, and calls WriteSummaryTable (SummaryTable.bas).
'   LoadPreviousMFC   -- builds lookup dictionaries from the previous report
'   ApplyCarryForward -- copies A-D for matching open encounters
' ============================================================

' <<< paste BacklogSummary (Public), LoadPreviousMFC (Private), ApplyCarryForward (Private) verbatim >>>
```

- [ ] **Step 2: Remove the 3 procedures from `BuildOutput.bas`**

- [ ] **Step 3: Verify BuildOutput is down to its 4 procedures**

```bash
grep -nE '^(Public |Private )?(Sub|Function) ' BuildOutput.bas
# expect exactly: BuildMFCOutput, ValidateSourceColumns, CaptureRedFlags, SaveOutputFile
grep -cE '(Sub|Function) (BacklogSummary|LoadPreviousMFC|ApplyCarryForward)' BuildOutput.bas   # expect 0
grep -cE 'Public Sub BacklogSummary' Backlog.bas    # expect 1
wc -l BuildOutput.bas   # expect roughly < 210
```

- [ ] **Step 4: Add `'Backlog.bas',` after `'SummaryTable.bas',` in `regen_modules.ps1`**

- [ ] **Step 5: Regen + duplicate check + sync**

```bash
pwsh -File regen_modules.ps1
grep -rhnE '^(Public |Private )?(Sub|Function) ' *.bas | sed -E 's/\(.*//; s/^.*(Sub|Function) +//' | sort | uniq -d   # expect empty
```

- [ ] **Step 6: Verify no orphaned cross-module calls (every called proc exists once)**

```bash
# BuildMFCOutput must still reach its movees; BacklogSummary must reach WriteSummaryTable
grep -rn 'WriteSummaryTable' Backlog.bas SummaryTable.bas   # call in Backlog, def in SummaryTable
grep -rn 'AddDropdowns' BuildOutput.bas Dropdowns.bas        # call in BuildOutput, def in Dropdowns
```

- [ ] **Step 7: Commit**

```bash
git add Backlog.bas BuildOutput.bas regen_modules.ps1 MFC_All_Modules.txt
git commit -m "Refactor: extract Backlog.bas; BuildOutput now build+save only

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Create `ProgressForm.bas`

**Files:**
- Create: `ProgressForm.bas`
- Modify: `regen_modules.ps1`, `MFC_All_Modules.txt`

- [ ] **Step 1: Create `ProgressForm.bas`** (full literal content)

Write via PowerShell to guarantee CRLF + UTF-8 no-BOM (model on how `FilePickerForm.bas` was created). Content:

```vba
VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} ProgressForm 
   Caption         =   "MFC Report -- Generating"
   ClientHeight    =   1500
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   4200
   StartUpPosition =   1  'CenterOwner
End
Attribute VB_Name = "ProgressForm"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

' ============================================================
' IMPORT NOTE (staff): This module is an Excel UserForm, NOT a
' standard module. To install it from MFC_All_Modules.txt:
'   1. In the VBA Editor: Insert > UserForm.
'   2. In the Properties window (F4), set (Name) = ProgressForm.
'   3. Open the form's code window (F7) and paste everything from
'      the "Option Explicit" line above down to the end of this
'      section (skip the VERSION / Begin / Attribute lines).
' All controls are built automatically when the form opens.
' ============================================================

' Modeless progress window shown by MainMacro during GenerateMFCReport.
' The macro runs with ScreenUpdating = False, so Application.StatusBar never
' repaints; this form forces a redraw via Me.Repaint on every Update.

Private m_total As Long
Private m_lblStep As MSForms.Label
Private m_barTrack As MSForms.Label
Private m_barFill As MSForms.Label

Private Const BAR_LEFT As Single = 12
Private Const BAR_TOP As Single = 44
Private Const BAR_WIDTH As Single = 192
Private Const BAR_HEIGHT As Single = 16

Public Sub ShowProgress(totalSteps As Long)
    m_total = totalSteps
    BuildControls
    m_lblStep.Caption = "Starting..."
    m_barFill.Width = 0
    Me.Show vbModeless
    Me.Repaint
End Sub

Public Sub Update(stepNum As Long, message As String)
    BuildControls
    m_lblStep.Caption = "Step " & stepNum & " of " & m_total & " -- " & message
    If m_total > 0 Then m_barFill.Width = BAR_WIDTH * (stepNum / m_total)
    Me.Repaint
    DoEvents
End Sub

Public Sub CloseProgress()
    Unload Me
End Sub

Private Sub UserForm_Initialize()
    Me.Caption = "MFC Report -- Generating"
    Me.Width = 222
    Me.Height = 96
    Me.Font.Name = "Tahoma"
    Me.Font.Size = 9
    BuildControls
End Sub

' Builds the label + progress bar once. Guarded so it is safe to call repeatedly.
Private Sub BuildControls()
    If Not m_barFill Is Nothing Then Exit Sub

    Set m_lblStep = Me.Controls.Add("Forms.Label.1", "lblStep", True)
    m_lblStep.Left = BAR_LEFT
    m_lblStep.Top = 12
    m_lblStep.Width = BAR_WIDTH
    m_lblStep.Height = 24

    Set m_barTrack = Me.Controls.Add("Forms.Label.1", "barTrack", True)
    m_barTrack.Left = BAR_LEFT
    m_barTrack.Top = BAR_TOP
    m_barTrack.Width = BAR_WIDTH
    m_barTrack.Height = BAR_HEIGHT
    m_barTrack.BackColor = RGB(220, 220, 220)
    m_barTrack.BorderStyle = fmBorderStyleSingle

    Set m_barFill = Me.Controls.Add("Forms.Label.1", "barFill", True)
    m_barFill.Left = BAR_LEFT
    m_barFill.Top = BAR_TOP
    m_barFill.Width = 0
    m_barFill.Height = BAR_HEIGHT
    m_barFill.BackColor = RGB(0, 128, 0)
End Sub

' Block the user's X button so the window cannot be dismissed mid-run.
Private Sub UserForm_QueryClose(Cancel As Integer, CloseMode As Integer)
    If CloseMode = vbFormControlMenu Then Cancel = 1
End Sub
```

- [ ] **Step 2: Verify encoding (CRLF, no BOM) and content**

```bash
head -c3 ProgressForm.bas | od -An -tx1                 # expect 56 45 52 (VER), NOT ef bb bf
printf "CRLF=%s total=%s\n" "$(grep -c $'\r$' ProgressForm.bas)" "$(wc -l < ProgressForm.bas)"   # equal
grep -cE 'Public Sub (ShowProgress|Update|CloseProgress)' ProgressForm.bas   # expect 3
```

- [ ] **Step 3: Add `'ProgressForm.bas'` to `regen_modules.ps1`** (last entry, after `'FilePickerForm.bas'`)

- [ ] **Step 4: Regen + sync (no stray `?`)**

```bash
pwsh -File regen_modules.ps1
grep -c '?' MFC_All_Modules.txt    # expect 0
grep -c 'ProgressForm' MFC_All_Modules.txt   # expect > 0
```

- [ ] **Step 5: Commit**

```bash
git add ProgressForm.bas regen_modules.ps1 MFC_All_Modules.txt
git commit -m "Add ProgressForm: modeless progress-bar window

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Wire `ProgressForm` into `MainMacro.bas`

**Files:**
- Modify: `MainMacro.bas`, `MFC_All_Modules.txt`

- [ ] **Step 1: Declare and show the form**

In `GenerateMFCReport`, just before the `' --- Step 1: ...` comment, add:

```vba
    Dim prog As New ProgressForm
    prog.ShowProgress 9

```

- [ ] **Step 2: Replace each per-step StatusBar line with a progress update**

Make these exact replacements (the step text is unchanged minus the `Step N/9:` prefix, which the form adds):

```
Application.StatusBar = "Step 1/9: Select input files..."
  -> prog.Update 1, "Select input files..."

Application.StatusBar = "Step 2/9: Combining EFC files..."
  -> prog.Update 2, "Combining EFC files..."

Application.StatusBar = "Step 3/9: Extracting and reformatting admission dates..."
  -> prog.Update 3, "Extracting and reformatting admission dates..."

Application.StatusBar = "Step 4/9: Filtering FC Status..."
  -> prog.Update 4, "Filtering FC Status..."

Application.StatusBar = "Step 5/9: Looking up Bed and Admit Status from Epic (~20,000 rows)..."
  -> prog.Update 5, "Looking up Bed and Admit Status from Epic (~20,000 rows)..."

Application.StatusBar = "Step 6/9: Filtering by bed code (NCID wards only)..."
  -> prog.Update 6, "Filtering by bed code (NCID wards only)..."

Application.StatusBar = "Step 7/9: Flagging duplicate rows..."
  -> prog.Update 7, "Flagging duplicate rows..."

Application.StatusBar = "Step 8/9: Building output report..."
  -> prog.Update 8, "Building output report..."

Application.StatusBar = "Step 9/9: Comparing against previous MFC report..."
  -> prog.Update 9, "Comparing against previous MFC report..."
```

- [ ] **Step 3: Close the form before the success popup**

Immediately before the success `MsgBox "MFC Report generated successfully!" ...`, add:

```vba
    prog.CloseProgress
```

(The line `Application.StatusBar = False` that precedes the MsgBox stays.)

- [ ] **Step 4: Close the form on the cleanup/error path too**

In the `Cleanup:` block, after `Application.StatusBar = False`, add a guarded close so error exits also dismiss the window (double-close is harmless):

```vba
    On Error Resume Next
    prog.CloseProgress
    On Error GoTo 0
```

(Place this before the existing `On Error Resume Next` that closes the workbooks, or merge into it — either is fine as long as `prog.CloseProgress` runs under `On Error Resume Next`.)

- [ ] **Step 5: Verify the wiring**

```bash
grep -c 'Application.StatusBar = "Step' MainMacro.bas   # expect 0 (all replaced)
grep -c 'prog.Update' MainMacro.bas                     # expect 9
grep -c 'prog.ShowProgress 9' MainMacro.bas             # expect 1
grep -c 'prog.CloseProgress' MainMacro.bas              # expect 2 (success path + cleanup)
grep -c 'Application.StatusBar = False' MainMacro.bas   # expect >= 1 (cleanup)
```

- [ ] **Step 6: Regen + sync**

```bash
pwsh -File regen_modules.ps1
H1=$(sha256sum MFC_All_Modules.txt); pwsh -File regen_modules.ps1; H2=$(sha256sum MFC_All_Modules.txt)
[ "${H1%% *}" = "${H2%% *}" ] && echo SYNC_OK || echo SYNC_FAIL
```

- [ ] **Step 7: Commit**

```bash
git add MainMacro.bas MFC_All_Modules.txt
git commit -m "Show progress window across the 9 macro steps

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Update docs + final whole-repo verification

**Files:**
- Modify: `CLAUDE.md`, `docs/MFC_Macro_Context.md`, `MFC_All_Modules.txt` (no code change)

- [ ] **Step 1: Update the `CLAUDE.md` repository-layout table**

In the `## Repository layout` table: remove the `FilterRows.bas` row and the old single `BuildOutput.bas` description; add rows for `FilterFCStatus.bas`, `FilterBedCode.bas`, `OutputWriter.bas`, `Backlog.bas`, `SummaryTable.bas`, `Dropdowns.bas`, `ProgressForm.bas`. Suggested rows:

```
| `FilterFCStatus.bas` | `FilterFCStatus` — keep Draft/Missed rows (was in FilterRows) |
| `FilterBedCode.bas` | `FilterBedCode` — NCID ward allowlist filter (edit `NCID_WARDS` here) |
| `BuildOutput.bas` | `BuildMFCOutput` — orchestrates + saves the output xlsx |
| `OutputWriter.bas` | Writes/formats the A–P output cells |
| `Backlog.bas` | `BacklogSummary` — carry-forward + backlog counts |
| `SummaryTable.bas` | Writes the bottom summary table (CCF/EL) |
| `Dropdowns.bas` | Output dropdowns + Config lists |
| `ProgressForm.bas` | Modeless progress-bar window shown during a run |
```

- [ ] **Step 2: Update `docs/MFC_Macro_Context.md` module references**

In the module/function-location table (around the `Helpers | Function PickFile` rows): remove the `PickFile` / `PickAndValidateFile` rows; update any `FilterRows`/`BuildOutput` module names to the new split. Leave the historical "Complete Code" appendix as-is (already marked drifted).

- [ ] **Step 3: Regen + final whole-repo checks**

```bash
pwsh -File regen_modules.ps1
# 1) sync (idempotent)
H1=$(sha256sum MFC_All_Modules.txt); pwsh -File regen_modules.ps1; H2=$(sha256sum MFC_All_Modules.txt)
[ "${H1%% *}" = "${H2%% *}" ] && echo SYNC_OK || echo SYNC_FAIL
# 2) no duplicate procedure definitions anywhere
grep -rhnE '^(Public |Private )?(Sub|Function) ' *.bas | sed -E 's/\(.*//; s/^.*(Sub|Function) +//' | sort | uniq -d
# 3) no dangling references to removed/renamed things
grep -rn 'FilterRows\|PickAndValidateFile' *.bas *.ps1 *.md
grep -rnE '\bPickFile\b' *.bas | grep -v PickFileWithFolder
# 4) deliverable is clean
grep -c '?' MFC_All_Modules.txt          # expect 0
head -c3 MFC_All_Modules.txt | od -An -tx1   # expect ef bb bf
# 5) module inventory
grep -E '^MODULE: ' MFC_All_Modules.txt
```
Expected: `SYNC_OK`; empty duplicate list; no dangling refs; `?` count 0; BOM present; module list shows all 15 modules (Helpers, MainMacro, CombineEFC, ExtractDate, FilterFCStatus, FilterBedCode, EpicLookup, FlagDuplicates, BuildOutput, OutputWriter, Backlog, SummaryTable, Dropdowns, FilePickerForm, ProgressForm).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/MFC_Macro_Context.md MFC_All_Modules.txt
git commit -m "Docs: update module layout for the split + progress form

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand off to the user for the Excel verification (cannot be done from the terminal)**

Tell the user to:
1. Import/replace all modules from `MFC_All_Modules.txt` (delete the old `FilterRows`, `BuildOutput` first to avoid duplicate-name collisions; add `ProgressForm` as a UserForm per its import note).
2. **Alt+F11 → Debug → Compile VBAProject** — must compile with no errors (catches any missed `Public`/`Private` or duplicate-name issue).
3. **Run `GenerateMFCReport`** end-to-end with real files: confirm the progress window appears and fills across the 9 steps, and the output report is **identical** to before the refactor.

---

## Self-review notes (for the implementer)

- **Spec coverage:** Feature 1 → Tasks 3–6; Feature 2 → Task 2; Feature 3 → Tasks 7–8; Feature 4 → Task 1; tooling/docs → updated within each task + Task 9.
- **Visibility:** the 5 required `Private`→`Public` changes are in Tasks 3 (`AddDropdowns`), 4 (`WriteOutputHeaders`/`WriteOutputData`/`FormatOutputSheet`), 5 (`WriteSummaryTable`). `BacklogSummary` was already `Public`.
- **Ordering:** leaf modules (Dropdowns, OutputWriter, SummaryTable) are extracted before `Backlog`, so every intermediate state keeps cross-module callees `Public` and compilable.
- **Constants:** `FilterFCStatus` constants and `NCID_WARDS` move to their respective modules (Task 2); `BuildOutput` has no module-level state.
