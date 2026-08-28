# Output File Naming & Staff Roster Check Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `BuildOutput.bas` module that creates an output workbook
containing a "Staff Roster Check" sheet (per-team staff lists with
Matched/Not Matched flags) and saves it using the
`FCReportSummary_<MonthName><Year>.xlsx` naming convention.

**Architecture:** New `BuildOutput.bas` module, following the existing
load-process-write pattern (`Option Explicit`, `FindColByHeader`/
`FindEncounterCol` for column lookup, `Scripting.Dictionary` with
`vbTextCompare`). Three pieces, built incrementally:
1. `GetReportPeriodLabel` -- derives `"<MonthName><Year>"` (e.g.
   `"June2026"`) from the most common Admission Date in cleaned File A.
2. `BuildStaffRosterCheckSheet` -- builds the new sheet from the Config
   roster (`Helpers.LoadStaffRoster`) and cleaned File A data.
3. `BuildOutputWorkbook` -- creates the output workbook, calls the sheet
   builder(s), and saves via `Application.FileDialog(msoFileDialogSaveAs)`.

EM/EL/Missed FC/Summary/Methodology sheet builders are **out of scope** for
this plan -- they depend on output sheet names not yet finalised (see
`docs/superpowers/specs/2026-06-10-fc-completion-report-design.md`, section
9 item 1). `BuildOutputWorkbook` will produce a workbook containing only the
Staff Roster Check sheet for now; later plans will extend it.

**Tech Stack:** Excel VBA (`.bas` modules + `FCCompletion_All_Modules.txt`
deliverable, regenerated via `regen_modules.ps1`). No build system or test
runner -- verification is via `rg`/grep for naming collisions and
`.bas`/`.txt` sync, Alt+F11 "Debug > Compile VBAProject", and a manual
Alt+F8 test run in Excel (Task 5).

**Spec:** `docs/superpowers/specs/2026-06-11-output-naming-and-staff-roster-check-design.md`

---

### Task 1: Create `BuildOutput.bas` with output file naming (`GetReportPeriodLabel`)

**Files:**
- Create: `BuildOutput.bas`
- Modify: `regen_modules.ps1`
- Regenerate: `FCCompletion_All_Modules.txt` (via script, not hand-edited)

- [ ] **Step 1: Create `BuildOutput.bas`**

```vb
Attribute VB_Name = "BuildOutput"
Option Explicit

' ============================================================
' BuildOutput.bas
'
' Builds the FC Completion Report output workbook.
'
' Implements (so far):
'   GetReportPeriodLabel       -- derives "<MonthName><Year>" (e.g.
'                                  "June2026") from the most common
'                                  Admission Date in File A, used for the
'                                  output file name.
'   BuildStaffRosterCheckSheet -- per-team staff tables with a Matched /
'                                  Not Matched flag, based on whether each
'                                  staff member's name appears in File A's
'                                  "FC Created By" / "Latest CCF Creation
'                                  User" columns this month.
'   BuildOutputWorkbook        -- creates the output workbook, calls the
'                                  sheet builders above, and saves it via
'                                  Application.FileDialog(msoFileDialogSaveAs)
'                                  with default name
'                                  "FCReportSummary_<MonthName><Year>.xlsx".
'
' See docs/superpowers/specs/2026-06-11-output-naming-and-staff-roster-check-design.md.
'
' EM/EL/Missed FC/Summary/Methodology sheet builders are NOT implemented
' here yet -- they depend on output sheet names still to be finalised (see
' 2026-06-10-fc-completion-report-design.md, section 6/8).
' BuildOutputWorkbook currently produces a workbook containing only the
' Staff Roster Check sheet.
' ============================================================

Public Const SHEET_STAFF_ROSTER_CHECK As String = "Staff Roster Check"

' ---- Output file naming -----------------------------------------

' Parses a date string in "D/M/Y" or "D/M/Y h:mm:ss AM/PM" format (the
' format used by eFC exports for Admission Date, *Creation Date-Time, etc.)
' into a Date value, without relying on locale-dependent CDate. Returns
' False if dateText doesn't match this format.
Private Function TryParseDMYDate(dateText As String, ByRef result As Date) As Boolean

    Dim datePart As String
    Dim spacePos As Long
    spacePos = InStr(dateText, " ")
    If spacePos > 0 Then
        datePart = Trim(Left(dateText, spacePos - 1))
    Else
        datePart = Trim(dateText)
    End If

    Dim parts() As String
    parts = Split(datePart, "/")
    If UBound(parts) <> 2 Then
        TryParseDMYDate = False
        Exit Function
    End If

    If Not IsNumeric(parts(0)) Or Not IsNumeric(parts(1)) Or Not IsNumeric(parts(2)) Then
        TryParseDMYDate = False
        Exit Function
    End If

    Dim d As Long, m As Long, y As Long
    d = CLng(parts(0))
    m = CLng(parts(1))
    y = CLng(parts(2))
    If y < 100 Then y = y + 2000

    On Error GoTo Fail
    result = DateSerial(y, m, d)
    TryParseDMYDate = True
    Exit Function

Fail:
    TryParseDMYDate = False

End Function

' Returns "<MonthName><Year>" (e.g. "June2026") for the most common
' Admission Date month/year in fileAws -- used as the default output file
' name "FCReportSummary_<MonthName><Year>.xlsx". Returns "" if the
' "Admission Date" column is missing, there's no data, or no value parses.
Public Function GetReportPeriodLabel(fileAws As Worksheet) As String

    Dim admDateCol As Long
    admDateCol = FindColByHeader(fileAws, "Admission Date")
    If admDateCol = 0 Then
        GetReportPeriodLabel = ""
        Exit Function
    End If

    Dim encCol As Long
    encCol = FindEncounterCol(fileAws)
    If encCol = 0 Then
        GetReportPeriodLabel = ""
        Exit Function
    End If

    Dim lastRow As Long
    lastRow = fileAws.Cells(fileAws.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then
        GetReportPeriodLabel = ""
        Exit Function
    End If

    Dim data As Variant
    data = fileAws.Range(fileAws.Cells(2, admDateCol), fileAws.Cells(lastRow, admDateCol)).Value

    Dim counts As Object
    Set counts = CreateObject("Scripting.Dictionary")

    Dim i As Long, txt As String, parsed As Date, key As String
    For i = 1 To (lastRow - 1)
        If lastRow = 2 Then
            txt = CStr(data)
        Else
            txt = CStr(data(i, 1))
        End If

        If TryParseDMYDate(txt, parsed) Then
            key = Year(parsed) & "-" & Month(parsed)
            If counts.Exists(key) Then
                counts(key) = counts(key) + 1
            Else
                counts(key) = 1
            End If
        End If
    Next i

    If counts.Count = 0 Then
        GetReportPeriodLabel = ""
        Exit Function
    End If

    Dim bestKey As String, bestCount As Long
    Dim k As Variant
    For Each k In counts.Keys
        If counts(k) > bestCount Then
            bestCount = counts(k)
            bestKey = CStr(k)
        End If
    Next k

    Dim parts() As String
    parts = Split(bestKey, "-")

    GetReportPeriodLabel = MonthName(CLng(parts(1)), False) & CStr(CLng(parts(0)))

End Function
```

- [ ] **Step 2: Verify no naming collisions with existing modules**

Run:
```
rg -n "GetReportPeriodLabel|TryParseDMYDate|SHEET_STAFF_ROSTER_CHECK" *.bas
```
Expected: every match is inside `BuildOutput.bas` only.

- [ ] **Step 3: Add `BuildOutput.bas` to `regen_modules.ps1`**

In `regen_modules.ps1`, change:

```powershell
$modules = @(
    'Helpers.bas',
    'FilterFileA.bas',
    'FilterFileB.bas',
    'DeduplicateEncounters.bas',
    'FilePickerForm.bas',
    'ProgressForm.bas'
)
```

to:

```powershell
$modules = @(
    'Helpers.bas',
    'FilterFileA.bas',
    'FilterFileB.bas',
    'DeduplicateEncounters.bas',
    'BuildOutput.bas',
    'FilePickerForm.bas',
    'ProgressForm.bas'
)
```

- [ ] **Step 4: Regenerate `FCCompletion_All_Modules.txt`**

Run (from the project root):
```
powershell -File regen_modules.ps1
```
Expected output: `FCCompletion_All_Modules.txt regenerated successfully` plus a
total size line. Then verify the new module section exists:
```
rg -n "MODULE: BuildOutput.bas" FCCompletion_All_Modules.txt
```
Expected: one match.

- [ ] **Step 5: Commit**

```bash
git add BuildOutput.bas regen_modules.ps1 FCCompletion_All_Modules.txt
git commit -m "Add BuildOutput.bas with output file naming (GetReportPeriodLabel)"
```

---

### Task 2: Add the Staff Roster Check sheet builder

**Files:**
- Modify: `BuildOutput.bas` (append after `GetReportPeriodLabel`)
- Regenerate: `FCCompletion_All_Modules.txt`

- [ ] **Step 1: Append the Staff Roster Check functions to `BuildOutput.bas`**

Add this after `GetReportPeriodLabel`'s `End Function`:

```vb

' ---- Staff Roster Check sheet -----------------------------------------

' Fixed display order for the per-team tables on the Staff Roster Check
' sheet. "Others" is excluded -- it's the default catch-all for unlisted
' names, not a real unit (per 2026-06-11 design spec, section 3.4).
Private Function StaffRosterCheckTeams() As Variant
    StaffRosterCheckTeams = Array(TEAM_ED_EDFC, TEAM_INFLIGHT, TEAM_NCID_AO, TEAM_ICH_PSO, TEAM_ADMIN)
End Function

' Adds every distinct, trimmed, non-blank value from ws column col (rows
' 2..lastRow) as a key in target (case-insensitive Dictionary). No-op if
' col = 0 (column not found on this export).
Private Sub AddColumnValuesToSet(ws As Worksheet, col As Long, lastRow As Long, target As Object)
    If col = 0 Then Exit Sub

    Dim data As Variant
    data = ws.Range(ws.Cells(2, col), ws.Cells(lastRow, col)).Value

    Dim i As Long, nm As String
    If lastRow = 2 Then
        nm = Trim(CStr(data))
        If nm <> "" Then target(nm) = True
        Exit Sub
    End If

    For i = 1 To UBound(data, 1)
        nm = Trim(CStr(data(i, 1)))
        If nm <> "" Then target(nm) = True
    Next i
End Sub

' Builds the set of staff names that appear anywhere in fileAws's
' "FC Created By" or "Latest CCF Creation User" columns (trimmed,
' case-insensitive). Used by BuildStaffRosterCheckSheet to flag each roster
' member as Matched / Not Matched.
Private Function BuildNamesFoundSet(fileAws As Worksheet) As Object
    Dim namesFound As Object
    Set namesFound = CreateObject("Scripting.Dictionary")
    namesFound.CompareMode = vbTextCompare

    Dim encCol As Long
    encCol = FindEncounterCol(fileAws)
    If encCol = 0 Then
        Set BuildNamesFoundSet = namesFound
        Exit Function
    End If

    Dim lastRow As Long
    lastRow = fileAws.Cells(fileAws.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then
        Set BuildNamesFoundSet = namesFound
        Exit Function
    End If

    Dim createdByCol As Long, latestCcfCol As Long
    createdByCol = FindColByHeader(fileAws, "FC Created By")
    latestCcfCol = FindColByHeader(fileAws, "Latest CCF Creation User")

    AddColumnValuesToSet fileAws, createdByCol, lastRow, namesFound
    AddColumnValuesToSet fileAws, latestCcfCol, lastRow, namesFound

    Set BuildNamesFoundSet = namesFound
End Function

' Adds a "Staff Roster Check" sheet to outputWb: one table per Config roster
' team (fixed order from StaffRosterCheckTeams, "Others" excluded), listing
' each staff member with "Matched" / "Not Matched" depending on whether
' their name appears in fileAws (per BuildNamesFoundSet). "Not Matched" rows
' are red-filled. If roster is empty, writes a single informational message
' instead of empty tables.
'
' roster: Dictionary from Helpers.LoadStaffRoster (Staff Name -> Team).
Public Sub BuildStaffRosterCheckSheet(outputWb As Workbook, fileAws As Worksheet, roster As Object)

    Dim ws As Worksheet
    Set ws = outputWb.Sheets.Add(After:=outputWb.Sheets(outputWb.Sheets.Count))
    ws.Name = SHEET_STAFF_ROSTER_CHECK

    If roster.Count = 0 Then
        ws.Cells(1, 1).Value = "Config roster is empty -- run CreateConfigSheet (Alt+F8) " & _
            "and add staff names/teams before this check is meaningful."
        ws.Columns("A").AutoFit
        Exit Sub
    End If

    Dim namesFound As Object
    Set namesFound = BuildNamesFoundSet(fileAws)

    Dim teams As Variant
    teams = StaffRosterCheckTeams()

    Dim r As Long
    r = 1

    Dim t As Long
    For t = LBound(teams) To UBound(teams)

        ' Team header row
        With ws.Cells(r, 1)
            .Value = teams(t)
            .Font.Bold = True
            .Font.Color = RGB(255, 255, 255)
            .Interior.Color = RGB(31, 73, 125)
        End With
        ws.Cells(r, 2).Interior.Color = RGB(31, 73, 125)
        r = r + 1

        ' Sub-header row
        ws.Cells(r, 1).Value = "Staff Name"
        ws.Cells(r, 2).Value = "Matched"
        ws.Range(ws.Cells(r, 1), ws.Cells(r, 2)).Font.Bold = True
        r = r + 1

        ' Staff rows, in Config roster order
        Dim nm As Variant
        For Each nm In roster.Keys
            If CStr(roster(nm)) = teams(t) Then
                ws.Cells(r, 1).Value = CStr(nm)
                If namesFound.Exists(CStr(nm)) Then
                    ws.Cells(r, 2).Value = "Matched"
                Else
                    ws.Cells(r, 2).Value = "Not Matched"
                    With ws.Range(ws.Cells(r, 1), ws.Cells(r, 2))
                        .Interior.Color = RGB(255, 0, 0)
                        .Font.Color = RGB(255, 255, 255)
                    End With
                End If
                r = r + 1
            End If
        Next nm

        ' Blank separator row before the next team
        r = r + 1
    Next t

    ws.Columns("A:B").AutoFit

End Sub
```

- [ ] **Step 2: Verify no naming collisions with existing modules**

Run:
```
rg -n "StaffRosterCheckTeams|AddColumnValuesToSet|BuildNamesFoundSet|BuildStaffRosterCheckSheet" *.bas
```
Expected: every match is inside `BuildOutput.bas` only.

- [ ] **Step 3: Regenerate `FCCompletion_All_Modules.txt`**

Run:
```
powershell -File regen_modules.ps1
```
Expected: `FCCompletion_All_Modules.txt regenerated successfully`.

- [ ] **Step 4: Commit**

```bash
git add BuildOutput.bas FCCompletion_All_Modules.txt
git commit -m "Add Staff Roster Check sheet builder to BuildOutput.bas"
```

---

### Task 3: Add the output workbook orchestrator and manual test entry point

**Files:**
- Modify: `BuildOutput.bas` (append after `BuildStaffRosterCheckSheet`)
- Regenerate: `FCCompletion_All_Modules.txt`

- [ ] **Step 1: Append `BuildOutputWorkbook` and `Test_BuildOutputWorkbook` to `BuildOutput.bas`**

Add this after `BuildStaffRosterCheckSheet`'s `End Sub`:

```vb

' ---- Top-level orchestration -----------------------------------------

' Creates a new output workbook containing the sheets built so far
' (currently just Staff Roster Check) and saves it via
' Application.FileDialog(msoFileDialogSaveAs), suggesting
' "FCReportSummary_<MonthName><Year>.xlsx" (or "FCReportSummary.xlsx" if the
' period can't be determined from fileAws).
'
' fileAws:  the cleaned, deduplicated File A worksheet (combined EM+EL).
' roster:   Dictionary from Helpers.LoadStaffRoster (Staff Name -> Team).
' outputWb: returns the new workbook (left open, whether or not it was
'           saved).
'
' Returns False if the user cancels the Save dialog, or on unexpected error
' (MsgBox shown in the error case).
Public Function BuildOutputWorkbook(fileAws As Worksheet, roster As Object, ByRef outputWb As Workbook) As Boolean

    On Error GoTo ErrHandler

    Set outputWb = Workbooks.Add

    BuildStaffRosterCheckSheet outputWb, fileAws, roster

    ' Remove the workbook's default sheet(s) -- only Staff Roster Check
    ' should remain at this stage. Iterate backwards by index so deleting
    ' doesn't skip sheets.
    Application.DisplayAlerts = False
    Dim i As Long
    For i = outputWb.Sheets.Count To 1 Step -1
        If outputWb.Sheets(i).Name <> SHEET_STAFF_ROSTER_CHECK Then
            outputWb.Sheets(i).Delete
        End If
    Next i
    Application.DisplayAlerts = True

    Dim periodLabel As String
    periodLabel = GetReportPeriodLabel(fileAws)

    Dim defaultName As String
    If periodLabel <> "" Then
        defaultName = "FCReportSummary_" & periodLabel & ".xlsx"
    Else
        defaultName = "FCReportSummary.xlsx"
    End If

    Dim fd As FileDialog
    Set fd = Application.FileDialog(msoFileDialogSaveAs)
    fd.InitialFileName = defaultName

    If fd.Show = 0 Then
        BuildOutputWorkbook = False
        Exit Function
    End If

    outputWb.SaveAs FileName:=fd.SelectedItems(1), FileFormat:=xlOpenXMLWorkbook
    BuildOutputWorkbook = True
    Exit Function

ErrHandler:
    Application.DisplayAlerts = True
    MsgBox "Unexpected error while building the output workbook:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"
    BuildOutputWorkbook = False

End Function

' Manual test entry point (Alt+F8): builds an output workbook from the
' active sheet (treated as cleaned File A) and the Config roster, prompting
' for a save location. Use this to verify file naming and the Staff Roster
' Check sheet before MainMacro.bas wires this into the full pipeline.
Public Sub Test_BuildOutputWorkbook()
    Dim roster As Object
    Set roster = LoadStaffRoster()

    Dim outputWb As Workbook
    If BuildOutputWorkbook(ActiveSheet, roster, outputWb) Then
        MsgBox "Output workbook created and saved.", vbInformation, "Test Complete"
    Else
        MsgBox "Output workbook was not saved (cancelled, or an error occurred).", vbExclamation, "Test Cancelled"
    End If
End Sub
```

- [ ] **Step 2: Verify no naming collisions with existing modules**

Run:
```
rg -n "BuildOutputWorkbook|Test_BuildOutputWorkbook" *.bas
```
Expected: every match is inside `BuildOutput.bas` only.

- [ ] **Step 3: Regenerate `FCCompletion_All_Modules.txt`**

Run:
```
powershell -File regen_modules.ps1
```
Expected: `FCCompletion_All_Modules.txt regenerated successfully`.

- [ ] **Step 4: Commit**

```bash
git add BuildOutput.bas FCCompletion_All_Modules.txt
git commit -m "Add BuildOutputWorkbook orchestrator and manual test entry point"
```

---

### Task 4: Update progress doc

**Files:**
- Modify: `docs/VBA_Code_Progress.md`

- [ ] **Step 1: Add a "BuildOutput.bas" entry under "## Done"**

Insert a new subsection after the "### DeduplicateEncounters.bas (Steps 3, 5-8)"
section (before the `---` separator that precedes "## Not started"):

```markdown

### BuildOutput.bas (output file naming + Staff Roster Check sheet)
- `GetReportPeriodLabel` -- derives "<MonthName><Year>" (e.g. "June2026")
  from the most common Admission Date in cleaned File A.
- `BuildStaffRosterCheckSheet` -- one table per Config roster team (ED/EDFC,
  Inflight, NCID AO, ICH PSO, Admin/Managers; "Others" excluded), each staff
  member flagged "Matched" / "Not Matched" depending on whether their name
  appears in File A's "FC Created By" / "Latest CCF Creation User" columns
  this month. "Not Matched" rows are red-filled.
- `BuildOutputWorkbook` -- creates the output workbook, adds the Staff
  Roster Check sheet, and saves it via `Application.FileDialog
  (msoFileDialogSaveAs)` with default name
  `FCReportSummary_<MonthName><Year>.xlsx`.
- `Test_BuildOutputWorkbook` -- Alt+F8 manual test entry point.

See `docs/superpowers/specs/2026-06-11-output-naming-and-staff-roster-check-design.md`.

**Still pending in BuildOutput.bas:** EM / EL / Missed FC / Summary /
Methodology sheet builders -- blocked on output sheet names (user said
they'll provide these; see 2026-06-10 spec section 9 item 1 for the
previously-proposed names).
```

- [ ] **Step 2: Update the "Not started" table**

In the `## Not started -- needs colleague input first` table, change the
`BuildOutput.bas` row's "Blocked by" cell from:

```markdown
| `BuildOutput.bas` -- EM/EL/Missed FC/Summary/Methodology sheets, colour-coded breakdown, % breakdown by team | Output sheet names + file naming pattern (CLAUDE.md blank #8/#9), Q6 (staff roster team set), Q7 (blank "Latest CCF Creation User" fallback), Q8 (conservative-default principle) |
```

to:

```markdown
| `BuildOutput.bas` -- EM/EL/Missed FC/Summary/Methodology sheets, colour-coded breakdown, % breakdown by team | Output sheet names (CLAUDE.md blank #8) -- file naming pattern (#9) and Staff Roster Check sheet are done, see "Done" section above |
```

- [ ] **Step 3: Commit**

```bash
git add docs/VBA_Code_Progress.md
git commit -m "Update progress doc: BuildOutput.bas file naming + Staff Roster Check done"
```

---

### Task 5: Manual verification in Excel (user-run)

No automated test runner exists for VBA -- this task is performed by the
user, with results reported back.

- [ ] **Step 1: Compile**

In Excel: Alt+F11 -> ensure `BuildOutput.bas` is imported/pasted as a module
(along with the existing `Helpers`, `FilterFileA`, `FilterFileB`,
`DeduplicateEncounters`, `FilePickerForm`, `ProgressForm` modules) -> Debug ->
Compile VBAProject.
Expected: no errors.

- [ ] **Step 2: Set up the Config roster**

Run `CreateConfigSheet` (Alt+F8). On the `Config` sheet, replace the
placeholder rows so it contains exactly:

| Staff Name | Team |
|---|---|
| Tan Cher Wee | ED/EDFC |
| Chong Siew Hoon | ED/EDFC |
| Lim Bee Choo | Inflight |
| Wong Mei Ling | NCID AO |

- [ ] **Step 3: Set up a sample File A sheet**

On a new worksheet, enter these headers in row 1 and data in rows 2-4:

| Encounter Number | FC Created By | Latest CCF Creation User | Admission Date |
|---|---|---|---|
| 100241111111 | Tan Cher Wee | Tan Cher Wee | 1/6/2026 11:08:44 AM |
| 100241111112 | Lim Bee Choo | Lim Bee Choo | 15/6/2026 09:00:00 AM |
| 100241111113 | Wong Mei Ling | | 20/6/2026 02:30:00 PM |

Make this sheet the active sheet.

- [ ] **Step 4: Run the test**

Run `Test_BuildOutputWorkbook` (Alt+F8). In the Save dialog, confirm the
suggested file name is `FCReportSummary_June2026.xlsx`. Save it anywhere
convenient.

- [ ] **Step 5: Check the output**

Open the saved file and confirm:
- It contains exactly one sheet, named "Staff Roster Check" (no leftover
  "Sheet1").
- **ED/EDFC** table: "Tan Cher Wee" = Matched; "Chong Siew Hoon" = Not
  Matched, red-filled.
- **Inflight** table: "Lim Bee Choo" = Matched.
- **NCID AO** table: "Wong Mei Ling" = Matched (via FC Created By, even
  though Latest CCF Creation User was blank for that row).
- **ICH PSO** and **Admin/Managers** tables: header + sub-header rows only,
  no data rows (no staff in roster for these teams).

- [ ] **Step 6: Report results**

Report back: any compile errors (Step 1), and whether the Step 5 checks all
passed. If anything doesn't match, note exactly what differed so it can be
fixed before moving on to the EM/EL/Summary/Methodology sheets.
