# Config-Driven Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all hardcoded, staff-facing values (headers, ward lists, statuses, colors, fonts, labels, filenames) from VBA code into the Config sheet so non-technical staff can customize the macro without touching code.

**Architecture:** A new `ConfigReader.bas` module provides public functions that read each Config section by header name, with hardcoded fallback defaults for backward compatibility. Every consumer module calls ConfigReader instead of using its own constants. `CreateConfigSheet` in Helpers.bas is expanded to populate all new Config columns (C-J) with defaults, and handles upgrading existing 2-column Config sheets.

**Tech Stack:** Excel VBA (no build system, no test runner)

## Global Constraints

- **Dual-source sync:** Every `.bas` change MUST be mirrored in `MFC_All_Modules.txt` (handled in final task).
- **Backward compatibility:** If Config sheet is missing or a column is absent, every reader function falls back to the same hardcoded defaults that exist today. The macro must work identically with no Config sheet at all.
- **`Option Explicit`** in every module.
- **Resolve columns by header via `FindColByHeader`**, never hardcoded index.
- **No `IIf()` with array access** -- `IIf()` is NOT short-circuit in VBA.
- **Bulk read/write** -- minimize COM calls.
- **Verification:** Since there is no CLI test runner, verification = static `grep` checks + user compiles in VBA editor (`Alt+F11 > Debug > Compile`) + user runs `GenerateMFCReport` with real data.

## Config Sheet Layout (Target)

| Col | Header | Rows 2+ | Consumer |
|-----|--------|---------|----------|
| A | Inflight FC Status | 20 dropdown values | Dropdowns.bas (existing) |
| B | Staff Follow Up | Staff names | Dropdowns.bas (existing) |
| C | Output Headers | 15 header names (A-O) | OutputWriter, Backlog |
| D | Excluded Wards | Ward codes to exclude | FilterWard |
| E | Case Status | Status names (one per row) | Dropdowns |
| F | Case Status Color | RGB as `R,G,B` per row | Dropdowns |
| G | FC Status Keep Values | Draft variants to keep | FilterFCStatus |
| H | Summary Labels | 5 label names | SummaryTable |
| I | Settings | Key names | BuildOutput, OutputWriter, Dropdowns, FlagDuplicates, SummaryTable |
| J | (Settings Values) | Values for col I keys | (same consumers) |

Settings keys (col I) and their defaults (col J):

| Key | Default | Consumer |
|-----|---------|----------|
| Filename Prefix | MFC | BuildOutput |
| Sheet Name | MFC Report | BuildOutput, MainMacro, Backlog |
| Font Name | Aptos Narrow | OutputWriter, SummaryTable |
| Font Size | 11 | OutputWriter, SummaryTable |
| Header Color | 31,73,125 | OutputWriter, SummaryTable |
| Header Font Color | 255,255,255 | OutputWriter |
| Border Color | 89,89,89 | OutputWriter |
| Duplicate Color | 255,0,0 | FlagDuplicates, BuildOutput, OutputWriter |
| Date Dropdown Days | 30 | Dropdowns |

---

### Task 1: Create ConfigReader.bas

**Files:**
- Create: `ConfigReader.bas`

**Interfaces:**
- Consumes: `FindColByHeader` from Helpers.bas
- Produces: `GetConfigSheet()`, `ReadConfigList()`, `GetOutputHeaders()`, `GetExcludedWards()`, `GetCaseStatuses()`, `GetFCStatusKeepValues()`, `GetSummaryLabels()`, `GetSetting()`, `GetSettingLong()`, `GetSettingColor()`, `ParseRGB()`

- [ ] **Step 1: Create ConfigReader.bas with all reader functions**

```vba
Attribute VB_Name = "ConfigReader"
Option Explicit

' ============================================================
' ConfigReader.bas
'
' Central reader for the Config sheet. Every function falls back
' to hardcoded defaults when the Config sheet or column is absent,
' so the macro works identically with no Config sheet at all.
' ============================================================


' Returns the Config worksheet, or Nothing if it doesn't exist.
Public Function GetConfigSheet() As Worksheet
    On Error Resume Next
    Set GetConfigSheet = ThisWorkbook.Sheets("Config")
    On Error GoTo 0
End Function


' Reads non-blank values from a Config column identified by header name.
' Returns a 1-based String array; count is set to the number of values found.
' Stops at the first blank cell. Uses a single bulk range read.
Public Function ReadConfigList(headerName As String, ByRef count As Long) As String()
    Dim items() As String
    ReDim items(1 To 1)
    count = 0

    Dim ws As Worksheet
    Set ws = GetConfigSheet()
    If ws Is Nothing Then
        ReadConfigList = items
        Exit Function
    End If

    Dim colIdx As Long
    colIdx = FindColByHeader(ws, headerName)
    If colIdx = 0 Then
        ReadConfigList = items
        Exit Function
    End If

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, colIdx).End(xlUp).Row
    If lastRow < 2 Then
        ReadConfigList = items
        Exit Function
    End If

    If lastRow = 2 Then
        Dim singleVal As String
        singleVal = Trim(CStr(ws.Cells(2, colIdx).Value))
        If singleVal <> "" Then
            count = 1
            items(1) = singleVal
        End If
        ReadConfigList = items
        Exit Function
    End If

    Dim colData As Variant
    colData = ws.Range(ws.Cells(2, colIdx), ws.Cells(lastRow, colIdx)).Value

    ReDim items(1 To lastRow - 1)
    Dim r As Long
    Dim cellVal As String
    For r = 1 To UBound(colData, 1)
        cellVal = Trim(CStr(colData(r, 1)))
        If cellVal = "" Then Exit For
        count = count + 1
        items(count) = cellVal
    Next r
    If count > 0 Then ReDim Preserve items(1 To count)

    ReadConfigList = items
End Function


' Returns 15 output header names (indices 1-15 map to cols A-O).
' Reads from Config "Output Headers"; falls back to hardcoded defaults.
Public Function GetOutputHeaders() As String()
    Dim h(1 To 15) As String
    h(1) = "Inflight FC Status"
    h(2) = "Date Updated (DD/MM/YYYY)"
    h(3) = "Staff Follow Up (if any)"
    h(4) = "Remarks"
    h(5) = "Case Status"
    h(6) = "FC ID"
    h(7) = "Encounter Number"
    h(8) = "MRN"
    h(9) = "Patient Name"
    h(10) = "Adm Date for MFC"
    h(11) = "FC Status"
    h(12) = "Point of Care"
    h(13) = "Final Bed"
    h(14) = "Admission Level Of Care"
    h(15) = "Epic Admission Status"

    Dim cfgCount As Long
    Dim cfgVals() As String
    cfgVals = ReadConfigList("Output Headers", cfgCount)

    If cfgCount >= 15 Then
        Dim i As Long
        For i = 1 To 15
            If Trim(cfgVals(i)) <> "" Then h(i) = cfgVals(i)
        Next i
    End If

    GetOutputHeaders = h
End Function


' Returns excluded ward codes as a 1-based String array.
' Reads from Config "Excluded Wards"; falls back to hardcoded defaults.
Public Function GetExcludedWards() As String()
    Dim cfgCount As Long
    Dim cfgVals() As String
    cfgVals = ReadConfigList("Excluded Wards", cfgCount)

    If cfgCount > 0 Then
        GetExcludedWards = cfgVals
        Exit Function
    End If

    Dim d(1 To 11) As String
    d(1) = "AUC" : d(2) = "EDC" : d(3) = "EDTC" : d(4) = "EDX"
    d(5) = "O14" : d(6) = "O15" : d(7) = "3E/F" : d(8) = "6E/F"
    d(9) = "8E" : d(10) = "TWAS" : d(11) = "TWDS"
    GetExcludedWards = d
End Function


' Returns Case Status names and their RGB fill colors.
' Reads from Config "Case Status" + "Case Status Color" columns.
' Falls back to the 4 hardcoded statuses (Follow Up / Resolved / U-turn / Clear).
Public Sub GetCaseStatuses(ByRef statusNames() As String, ByRef statusColors() As Long, ByRef count As Long)
    count = 0

    Dim nameCount As Long
    Dim colorCount As Long
    Dim names() As String
    Dim colors() As String
    names = ReadConfigList("Case Status", nameCount)
    colors = ReadConfigList("Case Status Color", colorCount)

    If nameCount > 0 Then
        count = nameCount
        ReDim statusNames(1 To count)
        ReDim statusColors(1 To count)
        Dim i As Long
        For i = 1 To count
            statusNames(i) = names(i)
            If i <= colorCount Then
                statusColors(i) = ParseRGB(colors(i), 255, 255, 255)
            Else
                statusColors(i) = RGB(255, 255, 255)
            End If
        Next i
        Exit Sub
    End If

    count = 4
    ReDim statusNames(1 To 4)
    ReDim statusColors(1 To 4)
    statusNames(1) = "Follow Up" : statusColors(1) = RGB(255, 229, 153)
    statusNames(2) = "Resolved"  : statusColors(2) = RGB(169, 209, 142)
    statusNames(3) = "U-turn"    : statusColors(3) = RGB(255, 255, 0)
    statusNames(4) = "Clear"     : statusColors(4) = RGB(255, 255, 255)
End Sub


' Returns FC Status "keep" values (Draft variants) as a 1-based String array.
' Reads from Config "FC Status Keep Values"; falls back to 3 hardcoded defaults.
Public Function GetFCStatusKeepValues() As String()
    Dim cfgCount As Long
    Dim cfgVals() As String
    cfgVals = ReadConfigList("FC Status Keep Values", cfgCount)

    If cfgCount > 0 Then
        GetFCStatusKeepValues = cfgVals
        Exit Function
    End If

    Dim d(1 To 3) As String
    d(1) = "Draft"
    d(2) = "Draft (ETBS Generated)"
    d(3) = "Draft (CCF Generated)"
    GetFCStatusKeepValues = d
End Function


' Returns summary table labels as a 1-based String array (5 items).
' Reads from Config "Summary Labels"; falls back to hardcoded defaults.
Public Function GetSummaryLabels() As String()
    Dim cfgCount As Long
    Dim cfgVals() As String
    cfgVals = ReadConfigList("Summary Labels", cfgCount)

    If cfgCount >= 5 Then
        GetSummaryLabels = cfgVals
        Exit Function
    End If

    Dim d(1 To 5) As String
    d(1) = "Total Cases"
    d(2) = "Backlog"
    d(3) = "To Follow Up on CCF"
    d(4) = "Today's Cases"
    d(5) = "EL Admissions"
    GetSummaryLabels = d
End Function


' Reads a single key-value setting from the Config "Settings" column.
' Keys are matched case-insensitively. Returns defaultVal if not found.
Public Function GetSetting(key As String, defaultVal As String) As String
    GetSetting = defaultVal

    Dim ws As Worksheet
    Set ws = GetConfigSheet()
    If ws Is Nothing Then Exit Function

    Dim colIdx As Long
    colIdx = FindColByHeader(ws, "Settings")
    If colIdx = 0 Then Exit Function

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, colIdx).End(xlUp).Row
    If lastRow < 2 Then Exit Function

    Dim targetKey As String
    targetKey = UCase(Trim(key))

    If lastRow = 2 Then
        If UCase(Trim(CStr(ws.Cells(2, colIdx).Value))) = targetKey Then
            GetSetting = Trim(CStr(ws.Cells(2, colIdx + 1).Value))
        End If
        Exit Function
    End If

    Dim keyData As Variant
    keyData = ws.Range(ws.Cells(2, colIdx), ws.Cells(lastRow, colIdx)).Value

    Dim r As Long
    For r = 1 To UBound(keyData, 1)
        If UCase(Trim(CStr(keyData(r, 1)))) = targetKey Then
            GetSetting = Trim(CStr(ws.Cells(r + 1, colIdx + 1).Value))
            Exit Function
        End If
    Next r
End Function


' Reads a numeric setting. Returns defaultVal if missing or non-numeric.
Public Function GetSettingLong(key As String, defaultVal As Long) As Long
    Dim s As String
    s = GetSetting(key, CStr(defaultVal))
    If IsNumeric(s) Then
        GetSettingLong = CLng(s)
    Else
        GetSettingLong = defaultVal
    End If
End Function


' Reads an RGB color setting (stored as "R,G,B"). Returns RGB(defaults) if missing/invalid.
Public Function GetSettingColor(key As String, defaultR As Long, defaultG As Long, defaultB As Long) As Long
    Dim s As String
    s = GetSetting(key, defaultR & "," & defaultG & "," & defaultB)
    GetSettingColor = ParseRGB(s, defaultR, defaultG, defaultB)
End Function


' Parses an "R,G,B" string into a Long RGB value.
Public Function ParseRGB(rgbStr As String, defaultR As Long, defaultG As Long, defaultB As Long) As Long
    On Error GoTo UseDefault
    Dim parts() As String
    parts = Split(Trim(rgbStr), ",")
    If UBound(parts) < 2 Then GoTo UseDefault
    Dim r As Long, g As Long, b As Long
    r = CLng(Trim(parts(0)))
    g = CLng(Trim(parts(1)))
    b = CLng(Trim(parts(2)))
    If r < 0 Or r > 255 Or g < 0 Or g > 255 Or b < 0 Or b > 255 Then GoTo UseDefault
    ParseRGB = RGB(r, g, b)
    Exit Function
UseDefault:
    ParseRGB = RGB(defaultR, defaultG, defaultB)
End Function
```

- [ ] **Step 2: Verify no compile errors in isolation**

Run: `grep -c "Public Function\|Public Sub" ConfigReader.bas`
Expected: 12 (GetConfigSheet, ReadConfigList, GetOutputHeaders, GetExcludedWards, GetCaseStatuses, GetFCStatusKeepValues, GetSummaryLabels, GetSetting, GetSettingLong, GetSettingColor, ParseRGB, plus one count for the Private -- actually all Public)

- [ ] **Step 3: Commit**

```bash
git add ConfigReader.bas
git commit -m "feat: add ConfigReader.bas with all config-reading functions and fallback defaults"
```

---

### Task 2: Expand CreateConfigSheet in Helpers.bas

**Files:**
- Modify: `Helpers.bas:85-167` (the `CreateConfigSheet` sub)

**Interfaces:**
- Consumes: `FindColByHeader` (self, Helpers.bas)
- Produces: Updated `CreateConfigSheet` that populates cols A-J with defaults and handles upgrading existing 2-column Config sheets

- [ ] **Step 1: Replace the entire CreateConfigSheet sub**

Replace `Helpers.bas` lines 82-167 (from the comment above CreateConfigSheet through the `End Sub`) with:

```vba
' Creates or upgrades the Config worksheet. Run via Alt+F8.
'   - If Config does not exist: creates it with all columns (A-J).
'   - If Config exists but is missing new columns (C-J): adds them with defaults,
'     preserving existing Inflight FC Status and Staff Follow Up lists.
'   - If Config already has all columns: shows "already up to date" message.
Public Sub CreateConfigSheet()
    Dim ws As Worksheet
    Dim i  As Long
    Dim isNew As Boolean

    On Error Resume Next
    Set ws = ThisWorkbook.Sheets("Config")
    On Error GoTo 0

    If ws Is Nothing Then
        Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        ws.Name = "Config"
        isNew = True
    End If

    ' Detect whether new columns already exist
    Dim hasNewCols As Boolean
    hasNewCols = (FindColByHeader(ws, "Output Headers") > 0)

    If Not isNew And hasNewCols Then
        MsgBox "Config sheet is already up to date." & vbNewLine & _
               "Edit it directly to customize the macro.", vbInformation, "Config"
        Exit Sub
    End If

    Application.ScreenUpdating = False

    ' --- Cols A-B: only populate on fresh creation (preserve existing lists) ---
    If isNew Then
        WriteConfigHeader ws, 1, "Inflight FC Status", _
            "Edit the list below -- one item per row."
        WriteConfigHeader ws, 2, "Staff Follow Up", _
            "Edit the list below -- one item per row."

        Dim inflightDefaults(1 To 20) As String
        inflightDefaults(1) = "No Attempt"
        inflightDefaults(2) = "Attempted - Pending FC"
        inflightDefaults(3) = "FC Complete - CCF left with NOK"
        inflightDefaults(4) = "FC Complete - CCF signed"
        inflightDefaults(5) = "FC Completed @ ED"
        inflightDefaults(6) = "FC Declined @ ED"
        inflightDefaults(7) = "FC Declined @ Inflight"
        inflightDefaults(8) = "Discharged -- MCAF"
        inflightDefaults(9) = "Discharged - No MCAF"
        inflightDefaults(10) = "Uncontactable NOK with MCAF"
        inflightDefaults(11) = "Transfer to NCID/Renci"
        inflightDefaults(12) = "Planned Transfer"
        inflightDefaults(13) = "C Class with MediFund Activated"
        inflightDefaults(14) = "Nursing Home Case / No NOK"
        inflightDefaults(15) = "Deceased"
        inflightDefaults(16) = "Received unsigned CCF/FC/ReFC"
        inflightDefaults(17) = "Non-Inflight Case"
        inflightDefaults(18) = "Explained CCF but Declined FC form"
        inflightDefaults(19) = "LOG Template"
        inflightDefaults(20) = "Others (to indicate in Remarks)"
        For i = 1 To 20
            ws.Cells(i + 1, 1).Value = inflightDefaults(i)
        Next i

        ws.Cells(2, 2).Value = "Staff A"
        ws.Cells(3, 2).Value = "Staff B"
        ws.Cells(4, 2).Value = "Staff C"
    End If

    ' --- Col C: Output Headers (15 header names for cols A-O) ---
    WriteConfigHeader ws, 3, "Output Headers", _
        "The 15 output column headers (A-O)." & vbNewLine & _
        "Rename any header -- the macro uses these names."
    Dim outHdr(1 To 15) As String
    outHdr(1) = "Inflight FC Status"
    outHdr(2) = "Date Updated (DD/MM/YYYY)"
    outHdr(3) = "Staff Follow Up (if any)"
    outHdr(4) = "Remarks"
    outHdr(5) = "Case Status"
    outHdr(6) = "FC ID"
    outHdr(7) = "Encounter Number"
    outHdr(8) = "MRN"
    outHdr(9) = "Patient Name"
    outHdr(10) = "Adm Date for MFC"
    outHdr(11) = "FC Status"
    outHdr(12) = "Point of Care"
    outHdr(13) = "Final Bed"
    outHdr(14) = "Admission Level Of Care"
    outHdr(15) = "Epic Admission Status"
    For i = 1 To 15
        ws.Cells(i + 1, 3).Value = outHdr(i)
    Next i

    ' --- Col D: Excluded Wards ---
    WriteConfigHeader ws, 4, "Excluded Wards", _
        "Point of Care codes to EXCLUDE." & vbNewLine & _
        "One per row. Add/remove wards as needed."
    Dim wards(1 To 11) As String
    wards(1) = "AUC" : wards(2) = "EDC" : wards(3) = "EDTC" : wards(4) = "EDX"
    wards(5) = "O14" : wards(6) = "O15" : wards(7) = "3E/F" : wards(8) = "6E/F"
    wards(9) = "8E" : wards(10) = "TWAS" : wards(11) = "TWDS"
    For i = 1 To 11
        ws.Cells(i + 1, 4).Value = wards(i)
    Next i

    ' --- Cols E-F: Case Status + Color ---
    WriteConfigHeader ws, 5, "Case Status", _
        "Dropdown values for the Case Status column." & vbNewLine & _
        "Each row pairs with the color in column F."
    WriteConfigHeader ws, 6, "Case Status Color", _
        "Fill color for each Case Status as R,G,B." & vbNewLine & _
        "Example: 255,229,153 for pale gold."
    ws.Cells(2, 5).Value = "Follow Up" : ws.Cells(2, 6).Value = "255,229,153"
    ws.Cells(3, 5).Value = "Resolved"  : ws.Cells(3, 6).Value = "169,209,142"
    ws.Cells(4, 5).Value = "U-turn"    : ws.Cells(4, 6).Value = "255,255,0"
    ws.Cells(5, 5).Value = "Clear"     : ws.Cells(5, 6).Value = "255,255,255"

    ' --- Col G: FC Status Keep Values ---
    WriteConfigHeader ws, 7, "FC Status Keep Values", _
        "FC Status values to KEEP (Draft variants)." & vbNewLine & _
        "Rows with these statuses pass through the filter."
    ws.Cells(2, 7).Value = "Draft"
    ws.Cells(3, 7).Value = "Draft (ETBS Generated)"
    ws.Cells(4, 7).Value = "Draft (CCF Generated)"

    ' --- Col H: Summary Labels ---
    WriteConfigHeader ws, 8, "Summary Labels", _
        "Labels for the summary table at the bottom." & vbNewLine & _
        "Must have exactly 5 rows."
    ws.Cells(2, 8).Value = "Total Cases"
    ws.Cells(3, 8).Value = "Backlog"
    ws.Cells(4, 8).Value = "To Follow Up on CCF"
    ws.Cells(5, 8).Value = "Today's Cases"
    ws.Cells(6, 8).Value = "EL Admissions"

    ' --- Cols I-J: Settings (key-value pairs) ---
    WriteConfigHeader ws, 9, "Settings", _
        "Key-value settings. Edit the VALUE in column J." & vbNewLine & _
        "Do not rename the keys in column I."
    With ws.Cells(1, 10)
        .Value = "(Values)"
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With

    ws.Cells(2, 9).Value = "Filename Prefix"     : ws.Cells(2, 10).Value = "MFC"
    ws.Cells(3, 9).Value = "Sheet Name"           : ws.Cells(3, 10).Value = "MFC Report"
    ws.Cells(4, 9).Value = "Font Name"            : ws.Cells(4, 10).Value = "Aptos Narrow"
    ws.Cells(5, 9).Value = "Font Size"            : ws.Cells(5, 10).Value = 11
    ws.Cells(6, 9).Value = "Header Color"         : ws.Cells(6, 10).Value = "31,73,125"
    ws.Cells(7, 9).Value = "Header Font Color"    : ws.Cells(7, 10).Value = "255,255,255"
    ws.Cells(8, 9).Value = "Border Color"         : ws.Cells(8, 10).Value = "89,89,89"
    ws.Cells(9, 9).Value = "Duplicate Color"      : ws.Cells(9, 10).Value = "255,0,0"
    ws.Cells(10, 9).Value = "Date Dropdown Days"  : ws.Cells(10, 10).Value = 30

    ws.Columns("A:J").AutoFit
    Application.ScreenUpdating = True

    If isNew Then
        MsgBox "Config sheet created with all customizable settings." & vbNewLine & vbNewLine & _
               "Next step: review the Config tab and update as needed." & vbNewLine & _
               "Replace Staff Follow Up placeholder names with your team's actual names.", _
               vbInformation, "Config Created"
    Else
        MsgBox "Config sheet upgraded with new customizable columns (C-J)." & vbNewLine & _
               "Your existing Inflight FC Status and Staff Follow Up lists are preserved." & vbNewLine & vbNewLine & _
               "Review the new columns and adjust as needed.", _
               vbInformation, "Config Upgraded"
    End If
End Sub


' Writes a formatted column header with a tooltip comment.
Private Sub WriteConfigHeader(ws As Worksheet, col As Long, title As String, tooltip As String)
    With ws.Cells(1, col)
        .Value = title
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With
    On Error Resume Next
    ws.Cells(1, col).Comment.Delete
    ws.Cells(1, col).AddComment tooltip
    On Error GoTo 0
End Sub
```

- [ ] **Step 2: Verify the old CreateConfigSheet is fully replaced**

Run: `grep -n "CreateConfigSheet\|WriteConfigHeader" Helpers.bas`
Expected: See both `CreateConfigSheet` and `WriteConfigHeader` defined, no remnants of the old inline header-formatting code.

- [ ] **Step 3: Commit**

```bash
git add Helpers.bas
git commit -m "feat: expand CreateConfigSheet to populate all Config columns C-J with defaults"
```

---

### Task 3: Wire OutputWriter.bas to Config (headers + formatting)

**Files:**
- Modify: `OutputWriter.bas:17-46` (`WriteOutputHeaders`), `OutputWriter.bas:54-56` (pre-format in `WriteOutputData`), `OutputWriter.bas:80-83` (red highlight in `WriteOutputData`), `OutputWriter.bas:89-113` (`FormatOutputSheet`)

**Interfaces:**
- Consumes: `GetOutputHeaders()`, `GetSettingColor()`, `GetSetting()`, `GetSettingLong()` from ConfigReader.bas

- [ ] **Step 1: Replace WriteOutputHeaders to read from Config**

Replace the entire `WriteOutputHeaders` sub (lines 17-46) with:

```vba
Public Sub WriteOutputHeaders(outWs As Worksheet)
    Dim headers() As String
    headers = GetOutputHeaders()

    Dim headerRow(1 To 1, 1 To 15) As String
    Dim c As Long
    For c = 1 To 15
        headerRow(1, c) = headers(c)
    Next c

    Dim hdrColor As Long
    hdrColor = GetSettingColor("Header Color", 31, 73, 125)
    Dim hdrFontColor As Long
    hdrFontColor = GetSettingColor("Header Font Color", 255, 255, 255)

    With outWs.Range("A1:O1")
        .Value = headerRow
        .Font.Bold = True
        .Interior.Color = hdrColor
        .Font.Color = hdrFontColor
    End With
End Sub
```

- [ ] **Step 2: Update WriteOutputData to use configurable duplicate color**

In `WriteOutputData`, replace the red-highlight block (lines 80-83) -- change the hardcoded `RGB(255, 0, 0)` and `RGB(255, 255, 255)`:

Replace:
```vba
        redRange.Interior.Color = RGB(255, 0, 0)
        redRange.Font.Color     = RGB(255, 255, 255)
```

With:
```vba
        redRange.Interior.Color = GetSettingColor("Duplicate Color", 255, 0, 0)
        redRange.Font.Color     = RGB(255, 255, 255)
```

- [ ] **Step 3: Update FormatOutputSheet to use configurable font and border color**

Replace the entire `FormatOutputSheet` sub (lines 89-113) with:

```vba
Public Sub FormatOutputSheet(outWs As Worksheet, lastRow As Long)
    Dim tableRange As Range
    Set tableRange = outWs.Range(outWs.Cells(1, 1), outWs.Cells(lastRow, 15))

    Dim fontName As String
    fontName = GetSetting("Font Name", "Aptos Narrow")
    Dim fontSize As Long
    fontSize = GetSettingLong("Font Size", 11)

    tableRange.Font.Name = fontName
    tableRange.Font.Size = fontSize

    Dim borderColor As Long
    borderColor = GetSettingColor("Border Color", 89, 89, 89)

    With tableRange.Borders(xlInsideVertical)
        .LineStyle = xlContinuous
        .Weight    = xlThin
        .Color     = borderColor
    End With
    With tableRange.Borders(xlInsideHorizontal)
        .LineStyle = xlContinuous
        .Weight    = xlThin
        .Color     = borderColor
    End With
    tableRange.BorderAround LineStyle:=xlContinuous, Weight:=xlMedium, Color:=RGB(0, 0, 0)

    outWs.Rows(1).RowHeight = 30
    outWs.Columns("A:O").AutoFit
    outWs.Range("A2").Select
    ActiveWindow.FreezePanes = True
End Sub
```

- [ ] **Step 4: Verify no remaining hardcoded RGB in OutputWriter.bas (except white font)**

Run: `grep -n "RGB(" OutputWriter.bas`
Expected: Only `RGB(255, 255, 255)` for the duplicate-row white font should remain as a direct RGB call. All other colors should go through `GetSettingColor`.

- [ ] **Step 5: Commit**

```bash
git add OutputWriter.bas
git commit -m "feat: wire OutputWriter to Config for headers, font, and color settings"
```

---

### Task 4: Wire FilterWard.bas to Config (excluded wards)

**Files:**
- Modify: `FilterWard.bas:16` (remove constant), `FilterWard.bas:32-39` (replace excludelist construction)

**Interfaces:**
- Consumes: `GetExcludedWards()` from ConfigReader.bas

- [ ] **Step 1: Remove EXCLUDED_WARDS constant and use GetExcludedWards()**

Delete line 16:
```vba
Private Const EXCLUDED_WARDS As String = "AUC,EDC,EDTC,EDX,O14,O15,3E/F,6E/F,8E,TWAS,TWDS"
```

Replace lines 32-39 (the excludelist construction block) with:

```vba
    Dim excludeSet As Object
    Set excludeSet = CreateObject("Scripting.Dictionary")
    Dim wardList() As String
    wardList = GetExcludedWards()
    Dim w As Long
    For w = 1 To UBound(wardList)
        excludeSet(UCase(Trim(wardList(w)))) = True
    Next w
```

- [ ] **Step 2: Verify no remaining reference to EXCLUDED_WARDS**

Run: `grep -n "EXCLUDED_WARDS" FilterWard.bas`
Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add FilterWard.bas
git commit -m "feat: wire FilterWard to read excluded wards from Config"
```

---

### Task 5: Wire FilterFCStatus.bas to Config (FC Status keep values)

**Files:**
- Modify: `FilterFCStatus.bas:18-20` (remove constants), `FilterFCStatus.bas:72-79` (first count loop), `FilterFCStatus.bas:98-112` (second filter loop)

**Interfaces:**
- Consumes: `GetFCStatusKeepValues()` from ConfigReader.bas

- [ ] **Step 1: Remove the three Private Const lines and add dictionary setup**

Delete lines 18-20:
```vba
Private Const FC_DRAFT      As String = "Draft"
Private Const FC_DRAFT_ETBS As String = "Draft (ETBS Generated)"
Private Const FC_DRAFT_CCF  As String = "Draft (CCF Generated)"
```

Inside `FilterFCStatus`, after the `Application.Calculation = xlCalculationManual` line and before the Step 2 counting loop, add:

```vba
    ' Load keep values from Config into a dictionary for O(1) lookup
    Dim keepVals() As String
    keepVals = GetFCStatusKeepValues()
    Dim keepSet As Object
    Set keepSet = CreateObject("Scripting.Dictionary")
    Dim k As Long
    For k = 1 To UBound(keepVals)
        keepSet(UCase(Trim(keepVals(k)))) = True
    Next k
```

- [ ] **Step 2: Replace the counting loop condition (Step 2 in the sub)**

Replace the triple `Or` check in the counting loop (around lines 77):
```vba
        ElseIf fcVal = UCase(FC_DRAFT) Or fcVal = UCase(FC_DRAFT_ETBS) Or fcVal = UCase(FC_DRAFT_CCF) Then
```

With:
```vba
        ElseIf keepSet.Exists(fcVal) Then
```

- [ ] **Step 3: Replace the filter loop condition (Step 3 in the sub)**

Replace the same triple `Or` check in the compaction loop (around lines 107):
```vba
        ElseIf fcVal = UCase(FC_DRAFT) Or fcVal = UCase(FC_DRAFT_ETBS) Or fcVal = UCase(FC_DRAFT_CCF) Then
```

With:
```vba
        ElseIf keepSet.Exists(fcVal) Then
```

- [ ] **Step 4: Verify no remaining references to FC_DRAFT constants**

Run: `grep -n "FC_DRAFT" FilterFCStatus.bas`
Expected: No matches.

- [ ] **Step 5: Commit**

```bash
git add FilterFCStatus.bas
git commit -m "feat: wire FilterFCStatus to read keep values from Config"
```

---

### Task 6: Wire Dropdowns.bas to Config (case statuses, colors, date days)

**Files:**
- Modify: `Dropdowns.bas:28-65` (`SetupResolutionDropdown`), `Dropdowns.bas:72-110` (`CreateListsSheet`), `Dropdowns.bas:116-173` (`ApplyConfigDropdowns`), `Dropdowns.bas:181-222` (delete `ReadConfigColumn`)

**Interfaces:**
- Consumes: `GetCaseStatuses()`, `GetSettingLong()`, `ReadConfigList()` from ConfigReader.bas
- Note: The private `ReadConfigColumn` function is deleted; replaced by `ReadConfigList` from ConfigReader.

- [ ] **Step 1: Replace SetupResolutionDropdown to use Config case statuses + colors**

Replace the entire `SetupResolutionDropdown` sub (lines 28-65) with:

```vba
Private Sub SetupResolutionDropdown(outWs As Worksheet, lastRow As Long)
    Const RES_COL  As Long = 5
    Const DATE_COL As Long = 2
    Const LAST_COL As Long = 15

    outWs.Range(outWs.Cells(2, DATE_COL), outWs.Cells(lastRow, DATE_COL)).NumberFormat = "DD/MM/YYYY"

    Dim statusNames() As String
    Dim statusColors() As Long
    Dim statusCount As Long
    GetCaseStatuses statusNames, statusColors, statusCount

    Dim formula As String
    Dim i As Long
    For i = 1 To statusCount
        If i > 1 Then formula = formula & ","
        formula = formula & statusNames(i)
    Next i

    With outWs.Range(outWs.Cells(2, RES_COL), outWs.Cells(lastRow, RES_COL)).Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
             Operator:=xlBetween, Formula1:=formula
        .IgnoreBlank = True
        .InCellDropdown = True
        .ShowError = False
    End With

    Dim cf As FormatCondition
    With outWs.Range(outWs.Cells(2, 1), outWs.Cells(lastRow, LAST_COL)).FormatConditions
        .Delete
        For i = 1 To statusCount
            Set cf = .Add(Type:=xlExpression, Formula1:="=$E2=""" & statusNames(i) & """")
            cf.Interior.Color = statusColors(i)
            cf.Font.Color = RGB(0, 0, 0)
            cf.StopIfTrue = True
        Next i
    End With
End Sub
```

- [ ] **Step 2: Update CreateListsSheet to use configurable date days**

In `CreateListsSheet`, replace the constant (line 73):
```vba
    Const DATE_DAYS As Long = 30
```

With:
```vba
    Dim DATE_DAYS As Long
    DATE_DAYS = GetSettingLong("Date Dropdown Days", 30)
```

- [ ] **Step 3: Replace ApplyConfigDropdowns to use ReadConfigList from ConfigReader**

Replace the entire `ApplyConfigDropdowns` sub (lines 116-173) with:

```vba
Private Sub ApplyConfigDropdowns(outWs As Worksheet, listsWs As Worksheet, lastRow As Long)
    Dim inflightCount As Long
    Dim staffCount    As Long
    Dim inflightList() As String
    Dim staffList()   As String
    inflightList = ReadConfigList("Inflight FC Status", inflightCount)
    staffList    = ReadConfigList("Staff Follow Up", staffCount)

    If inflightCount = 0 And staffCount = 0 Then
        MsgBox "Config sheet lists are empty." & vbNewLine & _
               "Add values under Config tab.", _
               vbExclamation, "Config Lists Empty"
        Exit Sub
    End If

    Dim r As Long
    For r = 1 To inflightCount
        listsWs.Cells(r + 1, 1).Value = inflightList(r)
    Next r
    For r = 1 To staffCount
        listsWs.Cells(r + 1, 2).Value = staffList(r)
    Next r

    If inflightCount > 0 Then
        With outWs.Range(outWs.Cells(2, 1), outWs.Cells(lastRow, 1)).Validation
            .Delete
            .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
                 Operator:=xlBetween, Formula1:="=Lists!$A$2:$A$" & (inflightCount + 1)
            .IgnoreBlank = True
            .InCellDropdown = True
            .ShowError = False
        End With
    End If

    If staffCount > 0 Then
        With outWs.Range(outWs.Cells(2, 3), outWs.Cells(lastRow, 3)).Validation
            .Delete
            .Add Type:=xlValidateList, AlertStyle:=xlValidAlertInformation, _
                 Operator:=xlBetween, Formula1:="=Lists!$B$2:$B$" & (staffCount + 1)
            .IgnoreBlank = True
            .InCellDropdown = True
            .ShowError = False
        End With
    End If
End Sub
```

- [ ] **Step 4: Delete the private ReadConfigColumn function**

Delete the entire `ReadConfigColumn` function (lines 181-222). It is fully replaced by `ReadConfigList` in ConfigReader.bas.

- [ ] **Step 5: Verify no remaining reference to ReadConfigColumn**

Run: `grep -n "ReadConfigColumn" Dropdowns.bas`
Expected: No matches.

- [ ] **Step 6: Commit**

```bash
git add Dropdowns.bas
git commit -m "feat: wire Dropdowns to Config for case statuses, colors, and date range"
```

---

### Task 7: Wire SummaryTable.bas to Config (labels + formatting)

**Files:**
- Modify: `SummaryTable.bas:17-85` (`WriteSummaryTable`)

**Interfaces:**
- Consumes: `GetSummaryLabels()`, `GetSettingColor()`, `GetSetting()`, `GetSettingLong()` from ConfigReader.bas

- [ ] **Step 1: Replace WriteSummaryTable to use Config labels and settings**

Replace the entire `WriteSummaryTable` sub (lines 17-85) with:

```vba
Public Sub WriteSummaryTable(outWs As Worksheet, startRow As Long, _
                              totalCases As Long, backlogCount As Long)

    Const COL_LBL As Long = 1
    Const COL_VAL As Long = 2

    Dim labels() As String
    labels = GetSummaryLabels()

    Dim hdrColor As Long
    hdrColor = GetSettingColor("Header Color", 31, 73, 125)
    Dim fontName As String
    fontName = GetSetting("Font Name", "Aptos Narrow")
    Dim fontSize As Long
    fontSize = GetSettingLong("Font Size", 11)

    Dim r0 As Long : r0 = startRow
    Dim r1 As Long : r1 = startRow + 1
    Dim r2 As Long : r2 = startRow + 2
    Dim r3 As Long : r3 = startRow + 3
    Dim r4 As Long : r4 = startRow + 4
    Dim r5 As Long : r5 = startRow + 5

    With outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r0, COL_VAL))
        .Merge
        .Value = "MFC Report Summary"
        .Font.Bold = True
        .Font.Color = RGB(255, 255, 255)
        .Interior.Color = hdrColor
        .HorizontalAlignment = xlCenter
    End With

    Dim lbls(1 To 5)     As String
    Dim dataRows(1 To 5) As Long
    Dim bgColors(1 To 5) As Long
    lbls(1) = labels(1) : dataRows(1) = r1 : bgColors(1) = RGB(217, 226, 239)
    lbls(2) = labels(2) : dataRows(2) = r2 : bgColors(2) = RGB(255, 255, 255)
    lbls(3) = labels(3) : dataRows(3) = r3 : bgColors(3) = RGB(255, 255, 153)
    lbls(4) = labels(4) : dataRows(4) = r4 : bgColors(4) = RGB(217, 226, 239)
    lbls(5) = labels(5) : dataRows(5) = r5 : bgColors(5) = RGB(255, 255, 153)

    Dim i As Long
    For i = 1 To 5
        With outWs.Cells(dataRows(i), COL_LBL)
            .Value = lbls(i)
            .Font.Bold = True
            .Interior.Color = bgColors(i)
        End With
        outWs.Cells(dataRows(i), COL_VAL).Interior.Color = bgColors(i)
    Next i

    outWs.Cells(r1, COL_VAL).Value = totalCases
    outWs.Cells(r2, COL_VAL).Value = backlogCount
    outWs.Cells(r4, COL_VAL).Formula = "=" & outWs.Cells(r1, COL_VAL).Address(True, True) & _
                                        "-" & outWs.Cells(r2, COL_VAL).Address(True, True)

    On Error Resume Next
    outWs.Cells(r3, COL_VAL).Comment.Delete
    outWs.Cells(r5, COL_VAL).Comment.Delete
    On Error GoTo 0
    outWs.Cells(r3, COL_VAL).AddComment "Enter the number of cases to follow up on CCF"
    outWs.Cells(r5, COL_VAL).AddComment "Enter EL Admissions count from email"

    Dim borderColor As Long
    borderColor = GetSettingColor("Border Color", 89, 89, 89)

    With outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r5, COL_VAL)).Borders
        .LineStyle = xlContinuous
        .Weight = xlThin
        .Color = borderColor
    End With
    outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r5, COL_VAL)).BorderAround _
        LineStyle:=xlContinuous, Weight:=xlMedium, Color:=RGB(0, 0, 0)

    With outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r5, COL_VAL)).Font
        .Name = fontName
        .Size = fontSize
    End With
    outWs.Columns(COL_LBL).AutoFit

End Sub
```

- [ ] **Step 2: Commit**

```bash
git add SummaryTable.bas
git commit -m "feat: wire SummaryTable to Config for labels and formatting settings"
```

---

### Task 8: Wire BuildOutput.bas to Config (filename, sheet name, dup color)

**Files:**
- Modify: `BuildOutput.bas:80-92` (filename construction), `BuildOutput.bas:106` (sheet name), `BuildOutput.bas:180-186` (`CaptureRedFlags`), `BuildOutput.bas:191-226` (`SaveOutputFile`)

**Interfaces:**
- Consumes: `GetSetting()`, `GetSettingColor()` from ConfigReader.bas

- [ ] **Step 1: Update BuildMFCOutput to use Config filename prefix and sheet name**

In `BuildMFCOutput`, replace the filename construction and sheet naming block (around lines 80-106).

Replace lines 80-81:
```vba
    Dim currentDateStr As String : currentDateStr = Format(Date, "DD.MM.YYYY")
    Dim oneMonthAgoStr As String : oneMonthAgoStr = Format(DateAdd("m", -1, Date), "DD.MM.YYYY")
```

With:
```vba
    Dim filePrefix As String
    filePrefix = GetSetting("Filename Prefix", "MFC")
    Dim sheetName As String
    sheetName = GetSetting("Sheet Name", "MFC Report")
    Dim currentDateStr As String : currentDateStr = Format(Date, "DD.MM.YYYY")
    Dim oneMonthAgoStr As String : oneMonthAgoStr = Format(DateAdd("m", -1, Date), "DD.MM.YYYY")
```

Replace line 92 (fullPath construction):
```vba
    fullPath = savePath & "\MFC " & currentDateStr & " TO " & oneMonthAgoStr & ".xlsx"
```

With:
```vba
    fullPath = savePath & "\" & filePrefix & " " & currentDateStr & " TO " & oneMonthAgoStr & ".xlsx"
```

Replace line 106 (sheet name):
```vba
    outWs.Name = "MFC Report"
```

With:
```vba
    outWs.Name = sheetName
```

- [ ] **Step 2: Update CaptureRedFlags to use configurable duplicate color**

Replace the `CaptureRedFlags` sub (lines 180-186) with:

```vba
Private Sub CaptureRedFlags(ws As Worksheet, dataRows As Long, ByRef rowIsRed() As Boolean)
    ReDim rowIsRed(1 To dataRows)
    Dim dupColor As Long
    dupColor = GetSettingColor("Duplicate Color", 255, 0, 0)
    Dim r As Long
    For r = 1 To dataRows
        rowIsRed(r) = (ws.Cells(r + 1, 1).Interior.Color = dupColor)
    Next r
End Sub
```

- [ ] **Step 3: Update SaveOutputFile to use Config filename prefix**

In `SaveOutputFile`, the `fileName` variable uses `"MFC "` prefix. Change the signature to accept the prefix, OR read it from Config inside the sub.

Replace lines 196-198:
```vba
    Dim baseName As String
    Dim counter  As Long
    Dim fileName As String
    fileName = "MFC " & currentDateStr & " TO " & oneMonthAgoStr & ".xlsx"
```

With:
```vba
    Dim baseName As String
    Dim counter  As Long
    Dim fileName As String
    Dim filePrefix As String
    filePrefix = GetSetting("Filename Prefix", "MFC")
    fileName = filePrefix & " " & currentDateStr & " TO " & oneMonthAgoStr & ".xlsx"
```

And replace line 217:
```vba
            baseName = savePath & "\MFC " & currentDateStr & " TO " & oneMonthAgoStr
```

With:
```vba
            baseName = savePath & "\" & filePrefix & " " & currentDateStr & " TO " & oneMonthAgoStr
```

And replace line 221:
```vba
                fileName = "MFC " & currentDateStr & " TO " & oneMonthAgoStr & " (" & counter & ").xlsx"
```

With:
```vba
                fileName = filePrefix & " " & currentDateStr & " TO " & oneMonthAgoStr & " (" & counter & ").xlsx"
```

- [ ] **Step 4: Verify no remaining hardcoded "MFC " in filename logic**

Run: `grep -n '"MFC ' BuildOutput.bas`
Expected: No matches (only `"MFC Report"` references should be gone; any remaining `MFC` should be through `filePrefix` or `sheetName`).

- [ ] **Step 5: Commit**

```bash
git add BuildOutput.bas
git commit -m "feat: wire BuildOutput to Config for filename prefix, sheet name, and dup color"
```

---

### Task 9: Wire FlagDuplicates.bas to Config (duplicate color)

**Files:**
- Modify: `FlagDuplicates.bas:83-86` (the formatting block)

**Interfaces:**
- Consumes: `GetSettingColor()` from ConfigReader.bas

- [ ] **Step 1: Replace hardcoded red with Config color**

Replace lines 83-86:
```vba
    If Not dupRange Is Nothing Then
        dupRange.Interior.Color = RGB(255, 0, 0)
        dupRange.Font.Color     = RGB(255, 255, 255)
    End If
```

With:
```vba
    If Not dupRange Is Nothing Then
        dupRange.Interior.Color = GetSettingColor("Duplicate Color", 255, 0, 0)
        dupRange.Font.Color     = RGB(255, 255, 255)
    End If
```

- [ ] **Step 2: Commit**

```bash
git add FlagDuplicates.bas
git commit -m "feat: wire FlagDuplicates to Config for duplicate highlight color"
```

---

### Task 10: Wire Backlog.bas to Config (output header matching)

**Files:**
- Modify: `Backlog.bas:17-70` (`BacklogSummary`), `Backlog.bas:76-141` (`LoadPreviousMFC`)

**Interfaces:**
- Consumes: `GetOutputHeaders()`, `GetSetting()` from ConfigReader.bas

- [ ] **Step 1: Update BacklogSummary to resolve Case Status by Config header**

In `BacklogSummary`, after the existing `Set carryFwd` line (line 27), add:

```vba
    Dim hdr() As String
    hdr = GetOutputHeaders()
```

Then replace line 32:
```vba
    resCol = FindColByHeader(outWs, "Case Status")
```

With:
```vba
    resCol = FindColByHeader(outWs, hdr(5))
    If resCol = 0 Then resCol = FindColByHeader(outWs, "Case Status")
```

- [ ] **Step 2: Update LoadPreviousMFC to try Config headers first, then legacy fallbacks**

Replace lines 85-101 (the column resolution block in `LoadPreviousMFC`) with:

```vba
    Dim hdr() As String
    hdr = GetOutputHeaders()

    prevEncCol = FindColByHeader(prevWs, hdr(7))
    If prevEncCol = 0 Then prevEncCol = FindColByHeader(prevWs, "Encounter Number")
    If prevEncCol = 0 Then prevEncCol = FindColByHeader(prevWs, "Encounter No")
    If prevEncCol = 0 Then
        MsgBox "Previous report missing 'Encounter Number'." & vbNewLine & _
               "All cases treated as new.", _
               vbExclamation, "Missing Column"
        Exit Sub
    End If

    prevStatusCol = FindColByHeader(prevWs, hdr(5))
    If prevStatusCol = 0 Then prevStatusCol = FindColByHeader(prevWs, "Case Status")
    If prevStatusCol = 0 Then prevStatusCol = FindColByHeader(prevWs, "Resolution Status")

    prevInflightCol = FindColByHeader(prevWs, hdr(1))
    If prevInflightCol = 0 Then prevInflightCol = FindColByHeader(prevWs, "Inflight FC Status")

    prevDateCol = FindColByHeader(prevWs, hdr(2))
    If prevDateCol = 0 Then prevDateCol = FindColByHeader(prevWs, "Date Updated (DD/MM/YYYY)")
    If prevDateCol = 0 Then prevDateCol = FindColByHeader(prevWs, "Date Updated")

    prevStaffCol = FindColByHeader(prevWs, hdr(3))
    If prevStaffCol = 0 Then prevStaffCol = FindColByHeader(prevWs, "Staff Follow Up (if any)")
    If prevStaffCol = 0 Then prevStaffCol = FindColByHeader(prevWs, "Staff Follow Up")

    prevRemarksCol = FindColByHeader(prevWs, hdr(4))
    If prevRemarksCol = 0 Then prevRemarksCol = FindColByHeader(prevWs, "Remarks")
```

- [ ] **Step 3: Commit**

```bash
git add Backlog.bas
git commit -m "feat: wire Backlog to Config headers with legacy fallbacks for prev-MFC matching"
```

---

### Task 11: Wire MainMacro.bas to Config (sheet name for prev MFC lookup)

**Files:**
- Modify: `MainMacro.bas:94-103` (previous MFC sheet lookup)

**Interfaces:**
- Consumes: `GetSetting()` from ConfigReader.bas

- [ ] **Step 1: Update previous MFC sheet lookup to try Config sheet name first**

Replace lines 94-103:
```vba
    On Error Resume Next
    Set wsPrev = wbPrev.Sheets("MFC Report")
    If wsPrev Is Nothing Then Set wsPrev = wbPrev.Sheets("MFC")
    If wsPrev Is Nothing Then
        If wbPrev.Sheets.Count >= 3 Then
            Set wsPrev = wbPrev.Sheets(3)
        Else
            Set wsPrev = wbPrev.Sheets(1)
        End If
    End If
    On Error GoTo 0
```

With:
```vba
    Dim prevSheetName As String
    prevSheetName = GetSetting("Sheet Name", "MFC Report")
    On Error Resume Next
    Set wsPrev = wbPrev.Sheets(prevSheetName)
    If wsPrev Is Nothing Then Set wsPrev = wbPrev.Sheets("MFC Report")
    If wsPrev Is Nothing Then Set wsPrev = wbPrev.Sheets("MFC")
    If wsPrev Is Nothing Then
        If wbPrev.Sheets.Count >= 3 Then
            Set wsPrev = wbPrev.Sheets(3)
        Else
            Set wsPrev = wbPrev.Sheets(1)
        End If
    End If
    On Error GoTo 0
```

- [ ] **Step 2: Commit**

```bash
git add MainMacro.bas
git commit -m "feat: wire MainMacro to Config for previous MFC sheet name lookup"
```

---

### Task 12: Sync MFC_All_Modules.txt and update CLAUDE.md

**Files:**
- Modify: `MFC_All_Modules.txt` (full regeneration)
- Modify: `CLAUDE.md` (update Config sheet documentation)

**Interfaces:**
- Consumes: All `.bas` files in their final state

- [ ] **Step 1: Regenerate MFC_All_Modules.txt**

Concatenate all `.bas` files in canonical order into `MFC_All_Modules.txt`. The order should be:

1. MainMacro.bas
2. Helpers.bas
3. ConfigReader.bas (NEW)
4. CombineEFC.bas
5. ExtractDate.bas
6. FilterFCStatus.bas
7. EpicLookup.bas
8. FilterDischarge.bas
9. FilterWard.bas
10. FlagDuplicates.bas
11. BuildOutput.bas
12. OutputWriter.bas
13. Backlog.bas
14. SummaryTable.bas
15. Dropdowns.bas
16. FilePickerForm.bas
17. ProgressForm.bas

Each module separated by a blank line.

- [ ] **Step 2: Verify .bas files match MFC_All_Modules.txt**

For each module, grep a unique function signature in both the `.bas` file and `MFC_All_Modules.txt` to confirm they match. Key checks:

```bash
grep "Public Function GetOutputHeaders" ConfigReader.bas MFC_All_Modules.txt
grep "Public Sub CreateConfigSheet" Helpers.bas MFC_All_Modules.txt
grep "GetSettingColor" OutputWriter.bas MFC_All_Modules.txt
grep "GetExcludedWards" FilterWard.bas MFC_All_Modules.txt
grep "GetFCStatusKeepValues" FilterFCStatus.bas MFC_All_Modules.txt
grep "GetCaseStatuses" Dropdowns.bas MFC_All_Modules.txt
grep "GetSummaryLabels" SummaryTable.bas MFC_All_Modules.txt
grep "GetSetting" BuildOutput.bas MFC_All_Modules.txt
```

- [ ] **Step 3: Verify no stray ? characters in MFC_All_Modules.txt**

Run: `grep -n "?" MFC_All_Modules.txt | grep -v "MsgBox\|Continue anyway\|Comment\|AddComment"`
Expected: No unexpected `?` characters outside of MsgBox prompt text.

- [ ] **Step 4: Update CLAUDE.md**

Update the Repository layout table to add `ConfigReader.bas`. Update the Config sheet documentation section to reflect the new cols C-J layout.

- [ ] **Step 5: Commit**

```bash
git add MFC_All_Modules.txt CLAUDE.md ConfigReader.bas
git commit -m "sync: regenerate MFC_All_Modules.txt with all Config-driven changes, update CLAUDE.md"
```

---

## Verification Checklist (after all tasks)

- [ ] `grep -rn "EXCLUDED_WARDS" *.bas` -- no matches
- [ ] `grep -rn "FC_DRAFT" *.bas` -- no matches (in FilterFCStatus.bas)
- [ ] `grep -rn "Private Function ReadConfigColumn" *.bas` -- no matches (removed from Dropdowns.bas)
- [ ] `grep -c "GetOutputHeaders\|GetExcludedWards\|GetCaseStatuses\|GetFCStatusKeepValues\|GetSummaryLabels\|GetSetting" ConfigReader.bas` -- confirms all functions exist
- [ ] No new `IIf()` calls with array access introduced
- [ ] All `.bas` files contain `Option Explicit`
- [ ] Ask user to compile: `Alt+F11 > Debug > Compile VBAProject`
- [ ] Ask user to run `CreateConfigSheet` on a fresh workbook -- verify all 10 columns (A-J) are populated with defaults
- [ ] Ask user to run `GenerateMFCReport` with real data -- verify output is identical to before
- [ ] Ask user to change one Config value (e.g. rename a header) and re-run -- verify the change takes effect
