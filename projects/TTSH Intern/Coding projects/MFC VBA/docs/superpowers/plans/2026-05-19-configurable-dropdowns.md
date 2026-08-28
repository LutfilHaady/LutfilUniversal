# Configurable Dropdowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded dropdown strings in `AddDropdowns` with lists read from an editable "Config" sheet in the macro workbook.

**Architecture:** A `CreateConfigSheet` sub pre-populates a "Config" sheet in the `.xlsm` once. At run time, `AddDropdowns` reads those columns, writes them to a hidden "Lists" sheet in the output `.xlsx`, and applies range-based validation — bypassing Excel's 255-character Formula1 limit.

**Tech Stack:** VBA (Excel), `.bas` module files imported into an `.xlsm` workbook.

---

## Files

| File | Change |
|------|--------|
| `Helpers.bas` | Add public `CreateConfigSheet` sub |
| `BuildOutput.bas` | Rewrite `AddDropdowns` private sub; add `ReadConfigColumn` private function |

---

### Task 1: Add `CreateConfigSheet` to `Helpers.bas`

**Files:**
- Modify: `Helpers.bas`

This is a one-time-run setup sub. Users run it via **Alt+F8 → CreateConfigSheet → Run** to create the Config sheet. It is idempotent — running it a second time shows a message and exits.

- [ ] **Step 1: Add the sub to `Helpers.bas`**

Open `Helpers.bas` and append the following after the existing `FindColByHeader` function:

```vba
' Creates the Config worksheet in this workbook if it does not already exist.
' Run this once via Alt+F8 before using GenerateMFCReport for the first time.
' After running, update the "Staff Follow Up" column with your team's actual names.
Public Sub CreateConfigSheet()

    Dim ws As Worksheet

    On Error Resume Next
    Set ws = ThisWorkbook.Sheets("Config")
    On Error GoTo 0

    If Not ws Is Nothing Then
        MsgBox "Config sheet already exists. Edit it directly to update the dropdown lists.", _
               vbInformation, "Config"
        Exit Sub
    End If

    Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
    ws.Name = "Config"

    ' Instruction label in col D so it doesn't interfere with the lists
    With ws.Cells(1, 4)
        .Value = "Edit the lists below. One item per row. Do not rename or delete the column headers in row 1."
        .Font.Italic = True
        .Font.Color = RGB(128, 128, 128)
    End With

    ' Column A header — Inflight FC Status
    With ws.Cells(1, 1)
        .Value = "Inflight FC Status"
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With

    ' Column B header — Staff Follow Up
    With ws.Cells(1, 2)
        .Value = "Staff Follow Up"
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With

    ' Default Inflight FC Status values
    Dim inflightDefaults(1 To 5) As String
    inflightDefaults(1) = "Pending"
    inflightDefaults(2) = "In Progress"
    inflightDefaults(3) = "Completed"
    inflightDefaults(4) = "Cancelled"
    inflightDefaults(5) = "On Hold"

    Dim i As Long
    For i = 1 To 5
        ws.Cells(i + 1, 1).Value = inflightDefaults(i)
    Next i

    ' Placeholder staff names — update with real names after running this sub
    ws.Cells(2, 2).Value = "Staff A"
    ws.Cells(3, 2).Value = "Staff B"
    ws.Cells(4, 2).Value = "Staff C"

    ws.Columns("A:D").AutoFit

    MsgBox "Config sheet created." & vbNewLine & vbNewLine & _
           "Next step: go to the 'Config' tab and replace the Staff Follow Up " & _
           "placeholder names with your team's actual names.", _
           vbInformation, "Config Created"

End Sub
```

- [ ] **Step 2: Import the updated module into Excel**

In Excel:
1. Open the `.xlsm` macro workbook
2. Press **Alt+F11** to open the VBA editor
3. In the Project Explorer, right-click the `Helpers` module → **Remove Helpers** → choose **Yes** to export first (or just overwrite its content by selecting all and pasting the full updated file)
4. Alternatively: select all text in the `Helpers` module, delete it, paste the full updated `Helpers.bas` content

- [ ] **Step 3: Run `CreateConfigSheet` and verify**

1. Press **Alt+F8**, select `CreateConfigSheet`, click **Run**
2. Expected: message box says "Config sheet created. Next step: go to the 'Config' tab..."
3. Navigate to the `Config` sheet — verify:
   - Row 1: bold blue header in A1 ("Inflight FC Status") and B1 ("Staff Follow Up")
   - A2:A6: Pending, In Progress, Completed, Cancelled, On Hold
   - B2:B4: Staff A, Staff B, Staff C
   - D1: grey italic instruction text
4. Run `CreateConfigSheet` a second time — expected: message box "Config sheet already exists." and no duplicate sheet created

- [ ] **Step 4: Update staff names on the Config sheet**

On the `Config` tab, replace B2:B4 placeholder values with the real team member names. Add or remove rows as needed. Verify no blank rows exist between names.

- [ ] **Step 5: Commit**

```bash
git add Helpers.bas
git commit -m "feat: add CreateConfigSheet to populate editable Config sheet"
```

---

### Task 2: Rewrite `AddDropdowns` in `BuildOutput.bas`

**Files:**
- Modify: `BuildOutput.bas` (replace `AddDropdowns`; add `ReadConfigColumn`)

- [ ] **Step 1: Replace `AddDropdowns` and add `ReadConfigColumn` in `BuildOutput.bas`**

Find the existing `Private Sub AddDropdowns` block and replace it — and add `ReadConfigColumn` immediately after it. The rest of `BuildOutput.bas` is unchanged.

**Replace this existing block:**

```vba
Private Sub AddDropdowns(outWs As Worksheet, lastRow As Long)

    If lastRow < 2 Then Exit Sub

    With outWs.Range(outWs.Cells(2, 1), outWs.Cells(lastRow, 1)).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
             Operator:=xlBetween, Formula1:="Pending,In Progress,Completed,Cancelled,On Hold"
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = False
    End With

    With outWs.Range(outWs.Cells(2, 3), outWs.Cells(lastRow, 3)).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
             Operator:=xlBetween, Formula1:="Staff A,Staff B,Staff C,None"
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = False
    End With

End Sub
```

**With this new version (plus `ReadConfigColumn` appended after it):**

```vba
' Reads dropdown lists from the macro workbook's Config sheet, writes them to a
' hidden Lists sheet in the output workbook, then applies range-based validation
' to cols A and C. Using a range reference instead of a Formula1 string avoids
' Excel's 255-character limit for comma-separated lists.
Private Sub AddDropdowns(outWs As Worksheet, lastRow As Long)

    If lastRow < 2 Then Exit Sub

    ' Locate Config sheet in the macro workbook
    Dim cfgWs As Worksheet
    On Error Resume Next
    Set cfgWs = ThisWorkbook.Sheets("Config")
    On Error GoTo 0

    If cfgWs Is Nothing Then
        MsgBox "AddDropdowns: 'Config' sheet not found in the macro workbook." & vbNewLine & _
               "Run CreateConfigSheet (Alt+F8) first, then re-run the macro.", _
               vbExclamation, "Config Missing"
        Exit Sub
    End If

    ' Read both lists from Config
    Dim inflightCount As Long
    Dim staffCount    As Long
    Dim inflightList() As String
    Dim staffList()   As String
    inflightList = ReadConfigColumn(cfgWs, 1, inflightCount)
    staffList    = ReadConfigColumn(cfgWs, 2, staffCount)

    ' Create (or recreate) a hidden Lists sheet in the output workbook
    Dim outWb   As Workbook
    Dim listsWs As Worksheet
    Set outWb = outWs.Parent

    On Error Resume Next
    Set listsWs = outWb.Sheets("Lists")
    On Error GoTo 0

    If Not listsWs Is Nothing Then
        Application.DisplayAlerts = False
        listsWs.Delete
        Application.DisplayAlerts = True
    End If

    Set listsWs = outWb.Sheets.Add(After:=outWb.Sheets(outWb.Sheets.Count))
    listsWs.Name = "Lists"
    listsWs.Visible = xlSheetVeryHidden

    ' Write inflight list to Lists col A (starting row 2)
    Dim r As Long
    For r = 1 To inflightCount
        listsWs.Cells(r + 1, 1).Value = inflightList(r)
    Next r

    ' Write staff list to Lists col B (starting row 2)
    For r = 1 To staffCount
        listsWs.Cells(r + 1, 2).Value = staffList(r)
    Next r

    ' Apply range-based validation — col A: Inflight FC Status
    If inflightCount > 0 Then
        With outWs.Range(outWs.Cells(2, 1), outWs.Cells(lastRow, 1)).Validation
            .Delete
            .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
                 Operator:=xlBetween, _
                 Formula1:="=Lists!$A$2:$A$" & (inflightCount + 1)
            .IgnoreBlank = True
            .InCellDropdown = True
            .ShowError = False
        End With
    End If

    ' Apply range-based validation — col C: Staff Follow Up
    If staffCount > 0 Then
        With outWs.Range(outWs.Cells(2, 3), outWs.Cells(lastRow, 3)).Validation
            .Delete
            .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
                 Operator:=xlBetween, _
                 Formula1:="=Lists!$B$2:$B$" & (staffCount + 1)
            .IgnoreBlank = True
            .InCellDropdown = True
            .ShowError = False
        End With
    End If

End Sub

' Reads non-blank string values from a single column of ws starting at row 2,
' stopping at the first blank cell. Returns a 1-based String array and sets count.
' Returns an empty dummy array (no elements used) when count = 0.
Private Function ReadConfigColumn(ws As Worksheet, colIdx As Long, ByRef count As Long) As String()

    Dim items() As String
    ReDim items(1 To 1)
    count = 0

    Dim r As Long
    r = 2
    Do While Trim(CStr(ws.Cells(r, colIdx).Value)) <> ""
        count = count + 1
        ReDim Preserve items(1 To count)
        items(count) = Trim(CStr(ws.Cells(r, colIdx).Value))
        r = r + 1
    Loop

    ReadConfigColumn = items

End Function
```

- [ ] **Step 2: Import the updated module into Excel**

In the VBA editor (**Alt+F11**):
1. Select the `BuildOutput` module in the Project Explorer
2. Select all (Ctrl+A), delete, and paste the full updated `BuildOutput.bas` content
3. Verify no red underlines or compile errors (Debug → Compile VBAProject)

- [ ] **Step 3: Run the full macro and verify dropdowns**

1. Press **Alt+F8** → `GenerateMFCReport` → **Run** with your test input files
2. When the output `.xlsx` opens, click any cell in **column A** — verify the dropdown arrow appears and shows the Inflight FC Status values from the Config sheet
3. Click any cell in **column C** — verify the dropdown shows the Staff Follow Up names from the Config sheet
4. In Excel's Name Manager or by unhiding sheets, confirm a `Lists` sheet exists in the output file and is very hidden
5. Add a new item to the Config sheet (e.g., add "On Leave" in the next empty row of column B), re-run the macro, verify the new item appears in the column C dropdown

- [ ] **Step 4: Verify the error path**

1. Temporarily rename the `Config` sheet to `Config_backup` (right-click tab → Rename)
2. Run `GenerateMFCReport` — expected: message box "AddDropdowns: 'Config' sheet not found..."
3. Rename it back to `Config`

- [ ] **Step 5: Commit**

```bash
git add BuildOutput.bas
git commit -m "feat: read dropdown lists from Config sheet, write to hidden Lists sheet in output"
```
