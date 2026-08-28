# Discharged Cases Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instead of permanently deleting discharged-before-FC-completed patients, capture
them onto a second "Discharged" tab in the same MFC output workbook, so the manager can use
it as a worklist to close those cases out in eFC.

**Architecture:** `FilterDischarged` (`FilterDischarge.bas`) already splits rows into
keep/discard in memory before writing the keep set back and deleting the rest. It gains a
`ByRef dischargedWs As Worksheet` output parameter: before discarding, it writes the
discarded rows onto a new hidden worksheet in the same source workbook and flags duplicates
on it. `MainMacro.bas` threads that worksheet through to `BuildMFCOutput`
(`BuildOutput.bas`), which -- after building the existing "MFC Report" sheet as it does
today -- adds a second "Discharged" sheet built from the captured rows, reusing
`OutputWriter.bas` and `Dropdowns.bas` unchanged except for one bug fix: `Dropdowns.bas`'s
`CreateListsSheet` currently deletes and rebuilds the shared hidden "Lists" validation
sheet on every call, which would break the first sheet's dropdowns when called a second
time for "Discharged" -- it needs to reuse an existing "Lists" sheet instead.

**Tech Stack:** Excel VBA (no build system, no test runner, no CLI -- see Global
Constraints for how verification works here).

**Design reference:** `docs/superpowers/specs/2026-07-14-discharged-report-design.md`

## Global Constraints

- **Dual-source sync:** every `.bas` change in this plan MUST be mirrored into
  `MFC_All_Modules.txt`. Locate the target function in the `.txt` file by searching for its
  exact signature (e.g. `Public Sub FilterDischarged`) rather than by assumed line number --
  `MFC_All_Modules.txt` already has pre-existing, unrelated drift from some `.bas` files on
  this branch (confirmed with the user as expected WIP), so don't assume the two files are
  aligned outside the functions this plan touches.
- **No commits during this plan.** Per this repo's `CLAUDE.md`: only commit when the user
  explicitly asks. Every task below ends with a verification step, not a commit -- changes
  stay in the working tree until the user requests a commit.
- **No cross-task compilation.** Tasks 1-4 change interlocking signatures
  (`FilterDischarged`, `BuildMFCOutput`) across multiple modules. VBA has no per-module
  compile step, so the project will not compile as a whole until Task 4 is done -- this is
  expected, not a bug. Full `Debug > Compile VBAProject` verification happens once, in
  Task 6.
- **Resolve columns by header, never hardcoded index** (`FindColByHeader`), per this
  project's existing convention.
- **`Option Explicit`** stays in every module.
- **Bulk read/write** -- no per-cell COM access in loops over data rows.
- **No `IIf()` with array access.**

---

### Task 1: Capture discharged rows in `FilterDischarge.bas`

**Files:**
- Modify: `FilterDischarge.bas`
- Modify: `MFC_All_Modules.txt` (mirror -- locate via `Public Sub FilterDischarged`)
- Test: none (VBA, no test runner) -- verified by grep sync check below

**Interfaces:**
- Consumes: `FindColByHeader` (`Helpers.bas`), `FlagDuplicateRows` (`FlagDuplicates.bas`) --
  both already exist and are unchanged.
- Produces: `FilterDischarged(ws As Worksheet, ByRef dischargedWs As Worksheet)` -- signature
  change (new second parameter). Callers must now pass a `Worksheet` variable to receive the
  captured rows. `dischargedWs` is set to `Nothing` if zero rows were discharged.

- [ ] **Step 1: Replace the `FilterDischarged` sub**

Open `FilterDischarge.bas` and replace the entire `Public Sub FilterDischarged(ws As
Worksheet)` ... `End Sub` block with:

```vb
Public Sub FilterDischarged(ws As Worksheet, ByRef dischargedWs As Worksheet)

    On Error GoTo ErrHandler

    Set dischargedWs = Nothing

    ' Prefer Epic Admission Status; fall back to eFC Admission Status
    Dim statCol As Long
    statCol = FindColByHeader(ws, "Epic Admission Status")
    If statCol = 0 Then statCol = FindColByHeader(ws, "Admission Status")
    If statCol = 0 Then
        MsgBox "Error: No admission status column found." & vbNewLine & _
               "The Epic lookup may have failed.", vbExclamation, "Missing Column"
        Exit Sub
    End If

    ' Use "Encounter No" for lastRow
    Dim encNoCol As Long
    encNoCol = FindColByHeader(ws, "Encounter No")

    Dim lastRow As Long
    Dim lastCol As Long
    If encNoCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encNoCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, statCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Sub
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' --- Step 1: Load entire working sheet into memory (one read) ---
    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    ' --- Step 2: Count rows that are NOT discharged, and rows that ARE ---
    Dim keepCount As Long
    Dim dischargeCount As Long
    Dim i As Long
    Dim statVal As String
    For i = 2 To lastRow
        statVal = UCase(Trim(CStr(allData(i, statCol))))
        If statVal <> "DISCHARGED" Then
            keepCount = keepCount + 1
        Else
            dischargeCount = dischargeCount + 1
        End If
    Next i

    ' --- Step 3: Capture discharged rows onto a hidden temp sheet before they're
    ' lost. BuildMFCOutput reads this sheet later to build the "Discharged" tab. ---
    If dischargeCount > 0 Then
        Dim discardData() As Variant
        ReDim discardData(1 To dischargeCount, 1 To lastCol)
        Dim dOutRow As Long
        Dim k As Long
        For i = 2 To lastRow
            statVal = UCase(Trim(CStr(allData(i, statCol))))
            If statVal = "DISCHARGED" Then
                dOutRow = dOutRow + 1
                For k = 1 To lastCol
                    discardData(dOutRow, k) = allData(i, k)
                Next k
            End If
        Next i

        Set dischargedWs = ws.Parent.Sheets.Add(After:=ws.Parent.Sheets(ws.Parent.Sheets.Count))
        dischargedWs.Name = "DischargedTemp"
        dischargedWs.Range(dischargedWs.Cells(1, 1), dischargedWs.Cells(1, lastCol)).Value = _
            ws.Range(ws.Cells(1, 1), ws.Cells(1, lastCol)).Value
        dischargedWs.Range(dischargedWs.Cells(2, 1), dischargedWs.Cells(1 + dischargeCount, lastCol)).Value = discardData
        FlagDuplicateRows dischargedWs
        dischargedWs.Visible = xlSheetVeryHidden
    End If

    ' --- Step 4: Build compacted array of kept rows ---
    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "All cases are discharged -- no active cases remain." & vbNewLine & _
               "Check your Epic Census date range.", vbExclamation, "No Data"
        Exit Sub
    End If

    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)

    Dim outRow As Long
    Dim j As Long
    For i = 2 To lastRow
        statVal = UCase(Trim(CStr(allData(i, statCol))))
        If statVal <> "DISCHARGED" Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        End If
    Next i

    ' --- Step 5: Write filtered rows back (one write) ---
    ws.Range(ws.Cells(2, 1), ws.Cells(1 + keepCount, lastCol)).Value = filtData

    ' --- Step 6: Delete tail rows (one delete) ---
    Dim newLastRow As Long
    newLastRow = 1 + keepCount
    If newLastRow < lastRow Then
        ws.Rows((newLastRow + 1) & ":" & lastRow).Delete
    End If

    Application.StatusBar = "Discharge filter complete: kept " & keepCount & _
        " rows, captured " & dischargeCount & " discharged rows."
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Sub

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during discharge filter:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"

End Sub
```

- [ ] **Step 2: Update the module header comment**

At the top of `FilterDischarge.bas`, update the doc comment block to mention the new
parameter. Replace:

```
' FilterDischarged -- removes ALL rows where the patient has been discharged.
' Runs AFTER LookupEpicData (needs Epic Admission Status column) and
' BEFORE FilterByBedCode.
```

with:

```
' FilterDischarged -- removes ALL rows where the patient has been discharged,
' capturing them first onto a hidden "DischargedTemp" sheet (the dischargedWs
' out-parameter) so BuildMFCOutput can turn them into a "Discharged" output tab
' instead of losing them outright.
' Runs AFTER LookupEpicData (needs Epic Admission Status column) and
' BEFORE FilterByBedCode.
```

- [ ] **Step 3: Mirror both changes into `MFC_All_Modules.txt`**

In `MFC_All_Modules.txt`, find the `FilterDischarge` module section (search for `Attribute
VB_Name = "FilterDischarge"`), and replace its `Public Sub FilterDischarged` body and header
comment with the exact same text as Steps 1-2.

- [ ] **Step 4: Verify sync**

Run:

```bash
grep -n "Public Sub FilterDischarged" FilterDischarge.bas MFC_All_Modules.txt
grep -c "dischargedWs" FilterDischarge.bas MFC_All_Modules.txt
```

Expected: both files show the `FilterDischarged` signature with the new parameter, and both
report the same non-zero count of `dischargedWs` occurrences (module header comment + sub
body). Also confirm no stray `?` characters were introduced (`grep -n "?" FilterDischarge.bas`
should show nothing new beyond what was already there, since this module has no MsgBox
prompts ending in `?`).

---

### Task 2: Fix `Dropdowns.bas` to reuse the shared "Lists" sheet

**Files:**
- Modify: `Dropdowns.bas`
- Modify: `MFC_All_Modules.txt` (mirror -- locate via `Private Function CreateListsSheet`)
- Test: none (VBA, no test runner) -- verified by grep sync check below

**Interfaces:**
- Consumes: nothing new.
- Produces: `CreateListsSheet` (still `Private`, still called only from `AddDropdowns`)
  no longer deletes an existing "Lists" sheet -- it reuses one if present. Behavior for a
  single call (today's only call site) is unchanged; this only matters once Task 3 makes a
  second call in the same workbook.

**Why this is needed:** `CreateListsSheet` unconditionally deletes and rebuilds the
`"Lists"` sheet every time it runs. `AddDropdowns` calls it once per output sheet. Once
Task 3 adds a second `AddDropdowns` call (for the "Discharged" sheet) in the same output
workbook, the second call would delete the `Lists` sheet the *first* sheet's dropdowns
already point to, breaking the main "MFC Report" tab's Inflight FC Status / Staff Follow Up
/ date dropdowns.

- [ ] **Step 1: Replace `CreateListsSheet`**

In `Dropdowns.bas`, replace the entire `Private Function CreateListsSheet(outWs As
Worksheet, lastRow As Long) As Worksheet` ... `End Function` block with:

```vb
' Creates (or reuses) the hidden Lists sheet in the output workbook.
' Writes the last 31 dates into Lists!C (most recent first) and applies
' the date picker dropdown to col B. Returns the Lists sheet so the caller
' can write additional dropdown lists into cols A and B.
' Reused across multiple output sheets in the same workbook (e.g. the main
' report and the Discharged tab): Lists!C is only ever built once per run,
' but the date-dropdown validation on col B is (re)applied for every caller,
' since each output sheet needs its own validation pointing at the shared sheet.
Private Function CreateListsSheet(outWs As Worksheet, lastRow As Long) As Worksheet
    Dim DATE_DAYS As Long
    DATE_DAYS = GetSettingLong("Date Dropdown Days", 30)
    Const DATE_COL  As Long = 2

    Dim outWb As Workbook
    Set outWb = outWs.Parent

    Dim listsWs As Worksheet
    On Error Resume Next
    Set listsWs = outWb.Sheets("Lists")
    On Error GoTo 0

    If listsWs Is Nothing Then
        Set listsWs = outWb.Sheets.Add(After:=outWb.Sheets(outWb.Sheets.Count))
        listsWs.Name = "Lists"
        listsWs.Visible = xlSheetVeryHidden

        ' Write last 31 dates into Lists!C, most recent first so today is top of dropdown
        Dim d As Long
        For d = 0 To DATE_DAYS
            listsWs.Cells(d + 2, 3).Value = Date - d
        Next d
        listsWs.Range(listsWs.Cells(2, 3), listsWs.Cells(DATE_DAYS + 2, 3)).NumberFormat = "DD/MM/YYYY"
    End If

    ' Apply date picker dropdown to col B; source is the range written to Lists!C.
    With outWs.Range(outWs.Cells(2, DATE_COL), outWs.Cells(lastRow, DATE_COL)).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
             Operator:=xlBetween, Formula1:="=Lists!$C$2:$C$" & (DATE_DAYS + 2)
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = False
    End With

    Set CreateListsSheet = listsWs
End Function
```

- [ ] **Step 2: Mirror into `MFC_All_Modules.txt`**

Find the `Dropdowns` module section (search for `Attribute VB_Name = "Dropdowns"`), locate
its `Private Function CreateListsSheet` block, and replace it with the same code as Step 1.

- [ ] **Step 3: Verify sync**

Run:

```bash
grep -n "If listsWs Is Nothing Then" Dropdowns.bas MFC_All_Modules.txt
```

Expected: one match in each file, confirming the delete-and-recreate logic was replaced in
both places.

---

### Task 3: Add the "Discharged" sheet writer to `BuildOutput.bas`

**Files:**
- Modify: `BuildOutput.bas`
- Modify: `MFC_All_Modules.txt` (mirror -- locate via `Public Function BuildMFCOutput` and
  `Attribute VB_Name = "BuildOutput"`)
- Test: none (VBA, no test runner) -- verified by grep sync check below

**Interfaces:**
- Consumes: `FindColByHeader` (`Helpers.bas`), `WriteOutputHeaders` / `WriteOutputData` /
  `FormatOutputSheet` (`OutputWriter.bas`, unchanged), `AddDropdowns` (`Dropdowns.bas`, fixed
  in Task 2), `ValidateSourceColumns` and `CaptureRedFlags` (private to this module,
  unchanged).
- Produces: `BuildMFCOutput(ws As Worksheet, dischargedWs As Worksheet) As Workbook` --
  signature change (new second parameter, may be `Nothing`). New private
  `WriteDischargedSheet(outWb As Workbook, dischargedWs As Worksheet)` -- not called by
  anything outside this module.

- [ ] **Step 1: Update the module header comment**

At the top of `BuildOutput.bas`, replace:

```
' Public entry points:
'   BuildMFCOutput  -- Creates the final .xlsx (cols A-O).
'                      Returns the new Workbook, or Nothing on cancel.
'   BacklogSummary  -- Compares against previous MFC, carries forward
'                      manual cols A-D, writes the summary table.
```

with:

```
' Public entry points:
'   BuildMFCOutput  -- Creates the final .xlsx (cols A-O) on the main "MFC Report"
'                      sheet, plus an optional second "Discharged" sheet built from
'                      FilterDischarged's captured rows (dischargedWs; may be Nothing
'                      if nothing was discharged this run).
'                      Returns the new Workbook, or Nothing on cancel.
'   BacklogSummary  -- Compares against previous MFC, carries forward
'                      manual cols A-D, writes the summary table.
```

- [ ] **Step 2: Change `BuildMFCOutput`'s signature and call the new sheet writer**

Change the function declaration line from:

```vb
Public Function BuildMFCOutput(ws As Worksheet) As Workbook
```

to:

```vb
Public Function BuildMFCOutput(ws As Worksheet, dischargedWs As Worksheet) As Workbook
```

Then, inside `BuildMFCOutput`, find this existing block near the end (just before the
`Application.ScreenUpdating = True` / `Set BuildMFCOutput = outWb` lines):

```vb
    WriteOutputHeaders outWs
    WriteOutputData outWs, wsData, dataRows, lastRow, colMap, rowIsRed
    AddDropdowns outWs, lastRow
    FormatOutputSheet outWs, lastRow
    SaveOutputFile outWb, fullPath, savePath, currentDateStr, oneMonthAgoStr
```

and replace it with:

```vb
    WriteOutputHeaders outWs
    WriteOutputData outWs, wsData, dataRows, lastRow, colMap, rowIsRed
    AddDropdowns outWs, lastRow
    FormatOutputSheet outWs, lastRow

    If Not dischargedWs Is Nothing Then
        WriteDischargedSheet outWb, dischargedWs
    End If

    SaveOutputFile outWb, fullPath, savePath, currentDateStr, oneMonthAgoStr
```

(The "Discharged" sheet must be added before `SaveOutputFile` runs, since that call performs
the actual `SaveAs` -- both sheets need to already be in `outWb` by then.)

- [ ] **Step 3: Add the `WriteDischargedSheet` private sub**

Add this new sub to `BuildOutput.bas`, immediately after the existing `CaptureRedFlags`
private sub (i.e. before `SaveOutputFile`):

```vb
' Adds a second "Discharged" sheet to the output workbook, containing the rows
' FilterDischarged captured before deleting them from the main pipeline. Reuses
' the same column layout, dropdowns, and formatting as the main "MFC Report" sheet.
' Silently returns if the required source columns are missing -- this should never
' happen in practice since dischargedWs is a snapshot of the same working sheet
' whose columns BuildMFCOutput's own column resolution already validated.
Private Sub WriteDischargedSheet(outWb As Workbook, dischargedWs As Worksheet)

    Dim srcFCID     As Long : srcFCID     = FindColByHeader(dischargedWs, "FC ID")
    Dim srcEncNo    As Long : srcEncNo    = FindColByHeader(dischargedWs, "Encounter No")
    Dim srcMRN      As Long : srcMRN      = FindColByHeader(dischargedWs, "MRN")
    Dim srcPatName  As Long : srcPatName  = FindColByHeader(dischargedWs, "Patient Name")
    Dim srcAdmDate  As Long : srcAdmDate  = FindColByHeader(dischargedWs, "Adm Date for MFC")
    Dim srcFCStat   As Long : srcFCStat   = FindColByHeader(dischargedWs, "FC Status")
    Dim srcPOC      As Long : srcPOC      = FindColByHeader(dischargedWs, "Point Of Care")
    Dim srcBed      As Long : srcBed      = FindColByHeader(dischargedWs, "Final Bed")
    Dim srcAdmLevel As Long : srcAdmLevel = FindColByHeader(dischargedWs, "Admission Level Of Care")
    Dim srcEpicStat As Long : srcEpicStat = FindColByHeader(dischargedWs, "Epic Admission Status")

    If Not ValidateSourceColumns(srcFCID, srcEncNo, srcMRN, srcPatName, srcAdmDate, _
                                  srcFCStat, srcPOC, srcBed, srcAdmLevel, srcEpicStat) Then
        Exit Sub
    End If

    Dim lastRow As Long
    lastRow = dischargedWs.Cells(dischargedWs.Rows.Count, srcEncNo).End(xlUp).Row
    If lastRow < 2 Then Exit Sub
    Dim dataRows As Long : dataRows = lastRow - 1

    Dim wsLastCol As Long
    wsLastCol = Application.WorksheetFunction.Max( _
        srcFCID, srcEncNo, srcMRN, srcPatName, srcAdmDate, _
        srcFCStat, srcPOC, srcBed, srcAdmLevel, srcEpicStat)
    Dim wsData As Variant
    wsData = dischargedWs.Range(dischargedWs.Cells(1, 1), dischargedWs.Cells(lastRow, wsLastCol)).Value

    Dim rowIsRed() As Boolean
    CaptureRedFlags dischargedWs, dataRows, rowIsRed

    Dim outWs As Worksheet
    Set outWs = outWb.Sheets.Add(After:=outWb.Sheets(outWb.Sheets.Count))
    outWs.Name = "Discharged"

    ' colMap(1..10) maps output cols F-O to their source column numbers in wsData.
    Dim colMap(1 To 10) As Long
    colMap(1)  = srcFCID      ' F
    colMap(2)  = srcEncNo     ' G
    colMap(3)  = srcMRN       ' H
    colMap(4)  = srcPatName   ' I
    colMap(5)  = srcAdmDate   ' J
    colMap(6)  = srcFCStat    ' K
    colMap(7)  = srcPOC       ' L
    colMap(8)  = srcBed       ' M
    colMap(9)  = srcAdmLevel  ' N
    colMap(10) = srcEpicStat  ' O

    WriteOutputHeaders outWs
    WriteOutputData outWs, wsData, dataRows, lastRow, colMap, rowIsRed
    AddDropdowns outWs, lastRow
    FormatOutputSheet outWs, lastRow

End Sub
```

- [ ] **Step 4: Mirror all three changes into `MFC_All_Modules.txt`**

Find the `BuildOutput` module section (search for `Attribute VB_Name = "BuildOutput"`), and
apply the same header comment, signature, call-site, and new-sub changes as Steps 1-3.

- [ ] **Step 5: Verify sync**

Run:

```bash
grep -n "Function BuildMFCOutput(ws As Worksheet, dischargedWs As Worksheet)" BuildOutput.bas MFC_All_Modules.txt
grep -n "Private Sub WriteDischargedSheet" BuildOutput.bas MFC_All_Modules.txt
```

Expected: one match per file for each search, confirming both the signature change and the
new sub exist identically in `BuildOutput.bas` and `MFC_All_Modules.txt`.

---

### Task 4: Wire it together in `MainMacro.bas`

**Files:**
- Modify: `MainMacro.bas`
- Modify: `MFC_All_Modules.txt` (mirror -- locate via `Attribute VB_Name = "MainMacro"`)
- Test: none (VBA, no test runner) -- verified by grep sync check below

**Interfaces:**
- Consumes: `FilterDischarged(ws As Worksheet, ByRef dischargedWs As Worksheet)` (Task 1),
  `BuildMFCOutput(ws As Worksheet, dischargedWs As Worksheet) As Workbook` (Task 3).
- Produces: nothing new for other modules -- this is the orchestration wiring, the last
  piece needed for the project to compile as a whole.

- [ ] **Step 1: Declare `wsDischarged` and update the `FilterDischarged` call**

In `MainMacro.bas`, find:

```vb
    ' --- Step 6: Remove ALL discharged cases ---
    ' Unlike NCID, Inflight removes discharged patients unconditionally
    ' (including Missed FC rows). Must run after Epic lookup.
    prog.Update 6, "Filtering discharged cases..."
    FilterDischarged wsMainEFC
```

and replace it with:

```vb
    ' --- Step 6: Remove ALL discharged cases ---
    ' Unlike NCID, Inflight removes discharged patients unconditionally
    ' (including Missed FC rows). Must run after Epic lookup.
    ' Discharged rows are captured onto a hidden temp sheet (wsDischarged) instead
    ' of being lost -- BuildMFCOutput turns them into a second "Discharged" tab
    ' for the manager to close out in eFC.
    prog.Update 6, "Filtering discharged cases..."
    Dim wsDischarged As Worksheet
    FilterDischarged wsMainEFC, wsDischarged
```

- [ ] **Step 2: Update the `BuildMFCOutput` call**

Find:

```vb
    ' --- Step 9: Create and save the output .xlsx ---
    prog.Update 9, "Building output report..."
    Set wbOutput = BuildMFCOutput(wsMainEFC)
    If wbOutput Is Nothing Then GoTo Cleanup
```

and replace it with:

```vb
    ' --- Step 9: Create and save the output .xlsx (also adds the Discharged
    ' tab if any rows were captured in step 6) ---
    prog.Update 9, "Building output report..."
    Set wbOutput = BuildMFCOutput(wsMainEFC, wsDischarged)
    If wbOutput Is Nothing Then GoTo Cleanup
```

- [ ] **Step 3: Update the module header comment's step list**

Find:

```
' 6.  Filter: remove ALL discharged cases (including Missed FC)
```

and replace it with:

```
' 6.  Filter: remove ALL discharged cases (including Missed FC); captures them
'     for the Discharged output tab built in step 9
```

- [ ] **Step 4: Mirror all changes into `MFC_All_Modules.txt`**

Find the `MainMacro` module section (search for `Attribute VB_Name = "MainMacro"`), and
apply the same three changes as Steps 1-3.

- [ ] **Step 5: Verify sync**

Run:

```bash
grep -n "FilterDischarged wsMainEFC, wsDischarged" MainMacro.bas MFC_All_Modules.txt
grep -n "BuildMFCOutput(wsMainEFC, wsDischarged)" MainMacro.bas MFC_All_Modules.txt
```

Expected: one match per file for each search.

---

### Task 5: Document the Discharged tab in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`
- Test: none -- this is documentation, verified by read-through.

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by other tasks -- can be done independently of Tasks 1-4, but
  sequenced last so the description matches the as-built behavior.

- [ ] **Step 1: Add a new section describing the Discharged tab**

In `CLAUDE.md`, immediately after the `## Current output layout (cols A-O)` section (after
its table, before `## Key differences from NCID`), add:

```markdown
## Discharged cases report ("Discharged" tab)

`FilterDischarged` (`FilterDischarge.bas`, step 6) no longer just deletes discharged rows --
it captures them onto a hidden temp worksheet (the `dischargedWs` out-parameter) before
removing them from the main pipeline. `BuildMFCOutput` (`BuildOutput.bas`) uses that
captured sheet to add a second **"Discharged"** tab to the same output workbook, alongside
the main "MFC Report" tab.

- **Purpose:** lets the manager close these cases out directly in eFC -- not Epic. Epic is
  only used to detect the discharge trigger and the bed; the columns that let the manager
  find and close the case (FC ID, Encounter Number, MRN, Patient Name, FC Status) come from
  eFC.
- **Population:** every pending-FC case (Draft or Missed FC) that turned out to be
  discharged -- exactly the rows the discharge filter used to delete outright.
- **Columns:** identical A-O layout to the main report, including the Inflight FC Status /
  Staff Follow Up dropdowns (the existing `Discharged -- MCAF` / `Discharged - No MCAF`
  values are meant for this tab) and duplicate red-flagging.
- **No carry-forward:** fresh snapshot every run -- no comparison against a previous
  discharged list, no backlog logic.
- If no rows were discharged in a given run, `dischargedWs` is `Nothing` and no "Discharged"
  tab is created.
```

- [ ] **Step 2: Update the repository layout table**

In the `## Repository layout` table, update the `FilterDischarge.bas` row's Purpose column
from:

```
| `FilterDischarge.bas` | Remove all rows where patient is discharged | New module |
```

to:

```
| `FilterDischarge.bas` | Remove all rows where patient is discharged; captures them onto a hidden sheet for the Discharged output tab | New module |
```

and the `BuildOutput.bas` row's Purpose column from:

```
| `BuildOutput.bas` | `BuildMFCOutput` -- orchestrates output sheet creation and file save | Fork -- 15-column output (A--O, not A--P) |
```

to:

```
| `BuildOutput.bas` | `BuildMFCOutput` -- orchestrates output sheet creation and file save, plus the optional "Discharged" tab | Fork -- 15-column output (A--O, not A--P) |
```

- [ ] **Step 3: Read the updated file back**

Read `CLAUDE.md` and confirm the new section renders correctly (valid markdown table row
syntax, no leftover placeholder text) and sits between the two sections named above.

---

### Task 6: Full compile and manual run verification

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Static cross-file consistency check**

Run:

```bash
grep -n "Public Sub FilterDischarged" *.bas MFC_All_Modules.txt
grep -n "Function BuildMFCOutput" *.bas MFC_All_Modules.txt
grep -n "Private Sub WriteDischargedSheet" *.bas MFC_All_Modules.txt
grep -n "FilterDischarged wsMainEFC" *.bas MFC_All_Modules.txt
```

Expected: every signature/call site appears exactly once in the relevant `.bas` file and
once in `MFC_All_Modules.txt`, with matching parameter lists.

- [ ] **Step 2: Ask the user to compile**

Ask the user to open the workbook in Excel, press `Alt+F11`, and run **Debug > Compile
VBAProject**. Expected: no compile errors. If there are errors, they will most likely be a
missed call-site update in `MainMacro.bas` (Task 4) -- check `FilterDischarged` and
`BuildMFCOutput` call sites take two arguments each.

- [ ] **Step 3: Ask the user to run a full report with real data, covering both cases**

Ask the user to run `GenerateMFCReport` (Alt+F8) twice with real input files, if practical:
once where the Epic Census includes at least one discharged pending-FC patient, and once
(or just observe) where it doesn't. Confirm:
- When there are discharged rows: the output workbook has a "Discharged" tab with the
  expected rows, same column layout as "MFC Report", working Inflight FC Status / Staff
  Follow Up / Date Updated dropdowns, and duplicate rows (if any) flagged red.
- The main "MFC Report" tab's dropdowns still work correctly (regression check for the
  shared "Lists" sheet fix in Task 2).
- When there are zero discharged rows: no "Discharged" tab is created, and the macro
  completes without errors.
