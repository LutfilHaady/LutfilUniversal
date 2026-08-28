Attribute VB_Name = "Helpers"
Option Explicit

' ============================================================
' Helpers.bas
'
' Shared utilities: header lookup, text cleaning, and the
' Designation -> Canonical / Employment Type lookups used by
' DesignationCleanup.bas, ReshapeBuilder.bas and PivotRepair.bas.
' ============================================================

' Searches row 1 of ws for a column whose header matches headerName.
' Matching is case-insensitive and whitespace-tolerant: line breaks,
' non-breaking spaces, and runs of spaces are normalised before comparison.
' Returns the 1-based column index, or 0 if not found.
Public Function FindColByHeader(ws As Worksheet, headerName As String) As Long
    Dim lastCol As Long
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Dim target As String
    target = NormHeader(headerName)

    Dim c As Long
    For c = 1 To lastCol
        If NormHeader(SafeStr(ws.Cells(1, c).Value)) = target Then
            FindColByHeader = c
            Exit Function
        End If
    Next c

    FindColByHeader = 0
End Function

' Normalises a header string for tolerant comparison:
'   - converts line breaks (Chr 10 / 13) and non-breaking spaces (Chr 160) to spaces
'   - collapses any run of spaces to a single space
'   - trims ends and upper-cases
Public Function NormHeader(s As String) As String
    Dim t As String
    t = CStr(s)
    t = Replace(t, Chr(10), " ")
    t = Replace(t, Chr(13), " ")
    t = Replace(t, Chr(160), " ")
    t = Replace(t, vbTab, " ")
    Do While InStr(t, "  ") > 0
        t = Replace(t, "  ", " ")
    Loop
    NormHeader = UCase(Trim(t))
End Function

' General-purpose text cleaner for data VALUES (not headers): strips
' non-breaking spaces / tabs / line breaks, collapses double spaces,
' trims a single trailing "." (common typo, e.g. "Senior Patient Service
' Associate."), and trims leading/trailing whitespace. Does NOT change case
' -- case normalisation happens separately in CanonicalizeDesignation so we
' don't accidentally mangle values that aren't designations (e.g. Names).
Public Function CleanText(ByVal s As String) As String
    Dim t As String
    t = s
    t = Replace(t, Chr(160), " ")
    t = Replace(t, Chr(10), " ")
    t = Replace(t, Chr(13), " ")
    t = Replace(t, vbTab, " ")
    Do While InStr(t, "  ") > 0
        t = Replace(t, "  ", " ")
    Loop
    t = Trim(t)
    If Right(t, 1) = "." Then t = Left(t, Len(t) - 1)
    CleanText = Trim(t)
End Function

' Key used for dictionary lookups: cleaned + upper-cased, so "Senior Nurse ll",
' "SENIOR NURSE LL", and "Senior  Nurse ll " all hit the same map entry.
Public Function MapKey(ByVal s As String) As String
    MapKey = UCase(CleanText(s))
End Function

' Null/error-safe string conversion for a cell or array-element Variant.
' Handles three distinct "not a normal value" cases without throwing:
'   - Empty/Null: blank cell -> ""
'   - Excel error value (#N/A, #REF!, #VALUE!, etc.): a bare CStr() on an
'     Error-subtype Variant does NOT raise a generic type-mismatch -- it
'     raises a runtime error whose Err.Number equals the underlying Excel
'     error code (2042 for #N/A, 2023 for #REF!, 2015 for #VALUE!, ...).
'     This is exactly what surfaced as "error 2042" -- a broken formula
'     elsewhere in this heavily-edited workbook left a real #N/A in a cell,
'     and the reshape touched it via a plain CStr(). Every module in this
'     project reads cells this way, so this check lives here once and every
'     other module calls it -- see IsErrorValue below for the raw test.
Public Function SafeStr(v As Variant) As String
    If IsEmpty(v) Or IsNull(v) Then
        SafeStr = ""
    ElseIf IsError(v) Then
        SafeStr = "#ERROR"
    Else
        SafeStr = CStr(v)
    End If
End Function

' Same idea as SafeStr but preserves the underlying type (date/number) for
' writing straight into an output cell, instead of coercing everything to
' text. Error values still collapse to "" here -- callers that need to know
' an error was present should check IsErrorValue separately and flag it.
Public Function SafeVal(v As Variant) As Variant
    If IsEmpty(v) Or IsNull(v) Or IsError(v) Then
        SafeVal = ""
    Else
        SafeVal = v
    End If
End Function

' True if v holds an Excel error value (#N/A, #REF!, #VALUE!, #DIV/0!, etc.)
' -- i.e. the source cell itself is broken, not just blank. Callers use this
' to flag a row for review rather than silently treating the error as blank.
Public Function IsErrorValue(v As Variant) As Boolean
    IsErrorValue = IsError(v)
End Function

' Ensures the "Designation Map" sheet exists in wb, creating and seeding it
' with the known variants found in FC Training & Assessment Masterlist (as of
' Jul 2026) if it doesn't. Safe to call every run -- does nothing if the sheet
' is already there, so any manual edits/additions you make are preserved.
' Columns: A = Raw variant (as found in Data Entry), B = Canonical designation,
' C = Employment Type (Nurse / FC Competency Required / Others / VAS).
Public Sub EnsureDesignationMapSheet(wb As Workbook)
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = wb.Sheets("Designation Map")
    On Error GoTo 0
    If Not ws Is Nothing Then Exit Sub

    Set ws = wb.Sheets.Add(After:=wb.Sheets(wb.Sheets.Count))
    ws.Name = "Designation Map"

    With ws
        .Cells(1, 1).Value = "Raw variant (as found in Data Entry)"
        .Cells(1, 2).Value = "Canonical designation"
        .Cells(1, 3).Value = "Employment Type"
        .Cells(1, 4).Value = "Notes"
        .Range("A1:D1").Font.Bold = True
        .Range("A1:D1").Interior.Color = RGB(31, 73, 125)
        .Range("A1:D1").Font.Color = RGB(255, 255, 255)
    End With

    ' Seed rows: Raw variant | Canonical | Employment Type | Notes
    ' Written as individual SeedRow calls (not one big Array(...) literal) --
    ' a single VBA statement can only have ~24 line continuations, and the old
    ' version here had over 50, which fails to compile with "Too many line
    ' continuations". Each call below is its own complete statement.
    Dim r As Long
    r = 2

    SeedRow ws, r, "Patient Service Associate", "Patient Service Associate", "FC Competency Required", ""
    SeedRow ws, r, "Sr Patient Service Associate", "Sr Patient Service Associate", "FC Competency Required", ""
    SeedRow ws, r, "Senior Patient Service Associate", "Sr Patient Service Associate", "FC Competency Required", ""
    SeedRow ws, r, "Senior Patient Service associate", "Sr Patient Service Associate", "FC Competency Required", "case variant"
    SeedRow ws, r, "Senior Patient Service Associate.", "Sr Patient Service Associate", "FC Competency Required", "trailing period"
    SeedRow ws, r, "Senior Patient Associate", "Sr Patient Service Associate", "FC Competency Required", "missing word 'Service' + nbsp"
    SeedRow ws, r, "Patient Service Associate Executive", "Patient Service Associate Executive", "FC Competency Required", ""
    SeedRow ws, r, "Patient Service Associate Executive", "Patient Service Associate Executive", "FC Competency Required", "nbsp variant"
    SeedRow ws, r, "Patient Service Associates Executives", "Patient Service Associate Executive", "FC Competency Required", "plural typo"
    SeedRow ws, r, "Patient Service Associate Executive", "Patient Service Associate Executive", "FC Competency Required", "all-caps variant"
    SeedRow ws, r, "Senior Patient Service Associate Executive", "Sr Patient Service Associate Executive", "FC Competency Required", ""
    SeedRow ws, r, "Patient Service Associate Asst Supervisor", "Asst Supervisor (PSA)", "FC Competency Required", ""
    SeedRow ws, r, "Assistant Supervisor", "Asst Supervisor (PSA)", "FC Competency Required", ""
    SeedRow ws, r, "Asst Supervisor (PSA)", "Asst Supervisor (PSA)", "FC Competency Required", ""
    SeedRow ws, r, "Healthcare Asst", "Healthcare Assistant", "FC Competency Required", ""
    SeedRow ws, r, "Healthcare Assistant", "Healthcare Assistant", "FC Competency Required", ""
    SeedRow ws, r, "Healthcare Assisstant", "Healthcare Assistant", "FC Competency Required", "typo in original dropdown list too"
    SeedRow ws, r, "Coordinator", "Coordinator", "Others", ""
    SeedRow ws, r, "(WH Staff)", "(WH Staff)", "FC Competency Required", "unclear designation -- REVIEW"
    SeedRow ws, r, "Temp Staff", "Temp Staff", "Others", "REVIEW -- may not need FC competency"
    SeedRow ws, r, "Enrolled Nurse", "Enrolled Nurse", "Nurse", ""
    SeedRow ws, r, "Principal Enrolled Nurse", "Principal Enrolled Nurse", "Nurse", ""
    SeedRow ws, r, "Senior Enrolled Nurse", "Sr Enrolled Nurse I", "Nurse", ""
    SeedRow ws, r, "Senior Enrolled Nurse I", "Sr Enrolled Nurse I", "Nurse", ""
    SeedRow ws, r, "Senior Enrolled Nurse II", "Sr Enrolled Nurse II", "Nurse", ""
    SeedRow ws, r, "Sr Enrolled Nurse ll", "Sr Enrolled Nurse II", "Nurse", "roman numeral typo (ll -> II)"
    SeedRow ws, r, "Senior Nurse", "Sr Staff Nurse I", "Nurse", "REVIEW -- ambiguous grade"
    SeedRow ws, r, "Senior Nurse ll", "Sr Staff Nurse II", "Nurse", "roman numeral typo (ll -> II)"
    SeedRow ws, r, "Staff Nurse", "Staff Nurse I", "Nurse", "REVIEW -- grade not specified"
    SeedRow ws, r, "Staff Nurse I", "Staff Nurse I", "Nurse", ""
    SeedRow ws, r, "Staff Nurse II", "Staff Nurse II", "Nurse", ""
    SeedRow ws, r, "Senior Staff Nurse", "Sr Staff Nurse I", "Nurse", "REVIEW -- grade not specified"
    SeedRow ws, r, "Senior Staff Nurse I", "Sr Staff Nurse I", "Nurse", ""
    SeedRow ws, r, "Senior Staff Nurse II", "Sr Staff Nurse II", "Nurse", ""
    SeedRow ws, r, "Sr Staff Nurse", "Sr Staff Nurse I", "Nurse", "REVIEW -- grade not specified"
    SeedRow ws, r, "Sr Staff Nurse I", "Sr Staff Nurse I", "Nurse", ""
    SeedRow ws, r, "Sr Staff Nurse II", "Sr Staff Nurse II", "Nurse", ""
    SeedRow ws, r, "SSN", "Sr Staff Nurse I", "Nurse", "abbreviation -- confirm grade"
    SeedRow ws, r, "SSNII", "Sr Staff Nurse II", "Nurse", "abbreviation"
    SeedRow ws, r, "Clinic Manager", "Clinic Manager", "Others", ""
    SeedRow ws, r, "Manager", "Clinic Manager", "Others", "REVIEW -- generic 'Manager'"
    SeedRow ws, r, "Senior Manager", "Senior Manager", "Others", ""
    SeedRow ws, r, "Executive", "Executive", "Others", ""
    SeedRow ws, r, "Executive ", "Executive", "Others", "trailing space"
    SeedRow ws, r, "Sr Executive", "Sr Executive", "Others", ""
    SeedRow ws, r, "Senior Executive", "Sr Executive", "Others", ""
    SeedRow ws, r, "Executive Assistant", "Executive Assistant", "Others", ""
    SeedRow ws, r, "Management Associate", "Management Associate", "Others", ""
    SeedRow ws, r, "Management Associates", "Management Associate", "Others", "plural typo"
    SeedRow ws, r, "Management  Intern", "Management Associate", "Others", "double space + REVIEW mapping"
    SeedRow ws, r, "Management Executive", "Management Executive", "Others", ""

    ws.Columns("A:D").AutoFit

    ' No canonical "VAS" designations exist anywhere in the current data or in the
    ' original Dropdown & Filter designation/nurse lists -- nothing is seeded against
    ' it. If VAS staff should be in this list, add their designation rows manually.
    ws.Cells(ws.Cells(ws.Rows.Count, 1).End(xlUp).Row + 2, 1).Value = _
        "NOTE: no 'VAS' designations found in the data as of Jul 2026 -- add rows here if that changes."
End Sub

' Writes one Designation Map row at row r (raw | canonical | employmentType |
' notes), then increments r so the next call lands on the following row.
' Kept as a plain multi-argument call (not a big literal) so
' EnsureDesignationMapSheet never hits VBA's line-continuation limit.
Private Sub SeedRow(ws As Worksheet, ByRef r As Long, raw As String, canonical As String, _
        employmentType As String, notes As String)
    ws.Cells(r, 1).Value = raw
    ws.Cells(r, 2).Value = canonical
    ws.Cells(r, 3).Value = employmentType
    ws.Cells(r, 4).Value = notes
    r = r + 1
End Sub

' Loads the Designation Map sheet into a Scripting.Dictionary keyed by
' MapKey(raw variant) -> array(canonical, employmentType).
' Call EnsureDesignationMapSheet first so the sheet is guaranteed to exist.
Public Function LoadDesignationMap(wb As Workbook) As Object
    Dim dict As Object
    Set dict = CreateObject("Scripting.Dictionary")

    Dim ws As Worksheet
    Set ws = wb.Sheets("Designation Map")

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    Dim r As Long
    For r = 2 To lastRow
        Dim raw As String
        raw = CStr(ws.Cells(r, 1).Value)
        If Len(Trim(raw)) = 0 Then GoTo NextR
        If Left(raw, 5) = "NOTE:" Then GoTo NextR

        Dim key As String
        key = MapKey(raw)
        If Not dict.Exists(key) Then
            dict.Add key, Array(CStr(ws.Cells(r, 2).Value), CStr(ws.Cells(r, 3).Value))
        End If
NextR:
    Next r

    Set LoadDesignationMap = dict
End Function

' Returns the true rightmost used column on ws -- NOT just the last column
' with a header in row 1. Confirmed against the real workbook: Data Entry has
' columns beyond "FC Certificate Number" (as of Jul 2026, columns AB/AC/AF)
' with no header text in row 1 but real data in hundreds of rows (AC alone
' has a Yes/No value in ~87% of rows -- almost certainly the old "Employment
' (Y/N)" field with its header lost, not a deleted column). Using only
' Cells(1, Columns.Count).End(xlToLeft).Column would silently exclude these
' from both the reshape and the pivot source range. Take the max of the
' header-row extent and the sheet's real UsedRange extent instead.
Public Function LastUsedColumn(ws As Worksheet) As Long
    Dim headerCol As Long
    headerCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Dim usedCol As Long
    usedCol = ws.UsedRange.Columns(ws.UsedRange.Columns.Count).Column

    If usedCol > headerCol Then
        LastUsedColumn = usedCol
    Else
        LastUsedColumn = headerCol
    End If
End Function

' Scans ws for columns that have data (in rows 2..lastRow) but no header text
' in row 1, and returns a human-readable description for the run summary --
' or "" if none found. This does NOT try to guess what the column means or
' fold it into the reshape; it only makes sure it's never silently dropped
' without Lutfil knowing it exists.
Public Function DescribeUnlabeledColumnsWithData(ws As Worksheet) As String
    Dim lastCol As Long
    lastCol = LastUsedColumn(ws)

    Dim anchorCol As Long
    anchorCol = FindColByHeader(ws, "S/N")
    If anchorCol = 0 Then anchorCol = 1
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, anchorCol).End(xlUp).Row

    Dim result As String
    result = ""
    If lastRow < 2 Then
        DescribeUnlabeledColumnsWithData = result
        Exit Function
    End If

    ' Bulk-read header row + data block once rather than per-cell .Value calls
    ' (per the load-process-write-in-bulk convention -- see CLAUDE.md).
    Dim headerRow As Variant
    headerRow = ws.Range(ws.Cells(1, 1), ws.Cells(1, lastCol)).Value

    Dim body As Variant
    body = ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).Value

    Dim c As Long
    For c = 1 To lastCol
        Dim headerVal As String
        headerVal = SafeStr(headerRow(1, c))

        If Len(Trim(headerVal)) = 0 Then
            Dim nonBlankCount As Long, sampleVal As String
            nonBlankCount = 0
            sampleVal = ""

            Dim r As Long
            For r = 1 To UBound(body, 1)
                Dim v As String
                v = SafeStr(body(r, c))
                If Len(Trim(v)) > 0 Then
                    nonBlankCount = nonBlankCount + 1
                    If Len(sampleVal) = 0 Then sampleVal = v
                End If
            Next r

            If nonBlankCount > 0 Then
                If Len(result) > 0 Then result = result & vbNewLine
                result = result & "  Column " & ws.Cells(1, c).Address(False, False) & _
                    ": no header, " & nonBlankCount & " rows with data (e.g. '" & sampleVal & "')"
            End If
        End If
    Next c

    DescribeUnlabeledColumnsWithData = result
End Function

' Looks up a raw designation string in the map. Returns True and populates
' canonical/employmentType if found; returns False (canonical = cleaned input,
' employmentType = "UNMAPPED - REVIEW") if not found in the map, so unknown
' values are never silently guessed.
Public Function CanonicalizeDesignation(ByVal raw As String, dict As Object, _
        ByRef canonical As String, ByRef employmentType As String) As Boolean
    Dim key As String
    key = MapKey(raw)

    If dict.Exists(key) Then
        canonical = dict(key)(0)
        employmentType = dict(key)(1)
        CanonicalizeDesignation = True
    Else
        canonical = CleanText(raw)
        employmentType = "UNMAPPED - REVIEW"
        CanonicalizeDesignation = False
    End If
End Function
