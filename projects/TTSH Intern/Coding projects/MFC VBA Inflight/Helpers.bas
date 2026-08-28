Attribute VB_Name = "Helpers"
Option Explicit

' Validates that the selected workbook sheet 1 has specific columns matching the target report type.
Public Function ValidateFileHeaders(wb As Workbook, fileType As String) As Boolean
    Dim ws As Worksheet
    Set ws = wb.Sheets(1)

    Dim isValid As Boolean
    isValid = False

    Select Case UCase(fileType)
        Case "EFC"
            ' Check for critical unique EFC columns: "FC ID", "Encounter No", "Missed FC", "FC Status"
            If FindColByHeader(ws, "FC ID") > 0 And _
               FindColByHeader(ws, "Encounter No") > 0 And _
               FindColByHeader(ws, "FC Status") > 0 And _
               FindColByHeader(ws, "Missed FC") > 0 Then
                isValid = True
            End If

        Case "EPIC"
            ' Check for critical unique Epic columns: "CSN", "Bed", "Admit Status", "Patient"
            If FindColByHeader(ws, "CSN") > 0 And _
               FindColByHeader(ws, "Bed") > 0 And _
               FindColByHeader(ws, "Admit Status") > 0 And _
               FindColByHeader(ws, "Patient") > 0 Then
                isValid = True
            End If

        Case "PREV_MFC"
            ' Allow any file for the previous MFC report since older manually-done
            ' reports have varying structures (e.g. combined EFC sheets).
            isValid = True
    End Select

    ValidateFileHeaders = isValid
End Function

' Searches row 1 of ws for a column whose header matches headerName.
' Matching is case-insensitive and whitespace-tolerant: line breaks
' (Alt+Enter / wrapped headers), non-breaking spaces, and runs of spaces
' are all normalised to a single space before comparison. This lets a header
' typed as "Date Updated" + line break + "(DD/MM/YYYY)" still match the
' search string "Date Updated (DD/MM/YYYY)".
' Returns the 1-based column index, or 0 if not found.
Public Function FindColByHeader(ws As Worksheet, headerName As String) As Long
    Dim lastCol As Long
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Dim target As String
    target = NormHeader(headerName)

    Dim c As Long
    For c = 1 To lastCol
        If NormHeader(CStr(ws.Cells(1, c).Value)) = target Then
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

' Creates or upgrades the Config worksheet. Run via Alt+F8.
'   - If Config does not exist: creates it with all columns (A-K).
'   - If Config exists but is missing new columns (C-K): adds them with defaults,
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
        ' Ensure color cells are text-formatted (fixes Excel auto-interpreting RGB strings)
        Dim colorCol As Long
        colorCol = FindColByHeader(ws, "Case Status Color")
        If colorCol > 0 Then
            Dim colorLastRow As Long
            colorLastRow = ws.Cells(ws.Rows.Count, colorCol).End(xlUp).Row
            If colorLastRow >= 2 Then ws.Range(ws.Cells(2, colorCol), ws.Cells(colorLastRow, colorCol)).NumberFormat = "@"
        End If
        Dim settingsCol As Long
        settingsCol = FindColByHeader(ws, "Settings")
        If settingsCol > 0 Then
            Dim settingsValCol As Long
            settingsValCol = settingsCol + 1
            ws.Range(ws.Cells(6, settingsValCol), ws.Cells(9, settingsValCol)).NumberFormat = "@"
        End If

        Dim upgraded As Boolean
        upgraded = False
        Application.ScreenUpdating = False

        ' Rename old "NCID Wards" header to "Included NCID Wards"
        Dim oldNCIDCol As Long
        oldNCIDCol = FindColByHeader(ws, "NCID Wards")
        If oldNCIDCol > 0 And FindColByHeader(ws, "Included NCID Wards") = 0 Then
            WriteConfigHeader ws, oldNCIDCol, "Included NCID Wards", _
                "Inflight-covered wards in the NCID building." & vbNewLine & _
                "These pass through the filter but are NOT tagged NCID."
            Dim oldLastRow As Long
            oldLastRow = ws.Cells(ws.Rows.Count, oldNCIDCol).End(xlUp).Row
            If oldLastRow >= 2 Then
                ws.Range(ws.Cells(2, oldNCIDCol), ws.Cells(oldLastRow, oldNCIDCol)).ClearContents
            End If
            ws.Cells(2, oldNCIDCol).Value = "08F"
            upgraded = True
        End If

        ' Add "All NCID Wards" if missing, or move it next to "Included NCID Wards"
        Dim allNCIDCol As Long
        allNCIDCol = FindColByHeader(ws, "All NCID Wards")

        Dim inclCol As Long
        inclCol = FindColByHeader(ws, "Included NCID Wards")
        If inclCol = 0 Then inclCol = 5

        If allNCIDCol = 0 Then
            ' Insert new column right after Included NCID Wards
            ws.Columns(inclCol + 1).Insert Shift:=xlToRight
            WriteConfigHeader ws, inclCol + 1, "All NCID Wards", _
                "Every ward code in the NCID building." & vbNewLine & _
                "Wards here but not in Included NCID Wards are tagged NCID."
            Dim upgradeNCID(1 To 12) As String
            upgradeNCID(1) = "03E" : upgradeNCID(2) = "05F" : upgradeNCID(3) = "06F"
            upgradeNCID(4) = "07E" : upgradeNCID(5) = "07F" : upgradeNCID(6) = "08E"
            upgradeNCID(7) = "08F" : upgradeNCID(8) = "09F" : upgradeNCID(9) = "11E"
            upgradeNCID(10) = "11F" : upgradeNCID(11) = "12E" : upgradeNCID(12) = "14F"
            Dim u As Long
            For u = 1 To 12
                ws.Cells(u + 1, inclCol + 1).Value = upgradeNCID(u)
            Next u
            upgraded = True
        ElseIf allNCIDCol <> inclCol + 1 Then
            ' Move it next to Included NCID Wards
            ws.Columns(allNCIDCol).Cut
            ws.Columns(inclCol + 1).Insert Shift:=xlToRight
            upgraded = True
        End If

        ws.Columns("A:K").AutoFit
        Application.ScreenUpdating = True

        If upgraded Then
            MsgBox "Config sheet upgraded." & vbNewLine & _
                   "Cols E-F are now Included NCID Wards / All NCID Wards." & vbNewLine & _
                   "Review the Config tab and adjust as needed.", _
                   vbInformation, "Config Upgraded"
        Else
            MsgBox "Config sheet is already up to date." & vbNewLine & _
                   "Edit it directly to customize the macro.", vbInformation, "Config"
        End If
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

    ' --- Col D: Excluded Bed Prefixes ---
    WriteConfigHeader ws, 4, "Excluded Bed Prefixes", _
        "Bed code prefixes to EXCLUDE." & vbNewLine & _
        "One per row. A bed starting with any prefix here is removed."
    Dim prefixes(1 To 10) As String
    prefixes(1) = "AUC" : prefixes(2) = "EDC" : prefixes(3) = "EDTC"
    prefixes(4) = "EDX" : prefixes(5) = "EDXO" : prefixes(6) = "O14"
    prefixes(7) = "O15" : prefixes(8) = "RES" : prefixes(9) = "TWAS"
    prefixes(10) = "TWDS"
    For i = 1 To 10
        ws.Cells(i + 1, 4).Value = prefixes(i)
    Next i

    ' --- Col E: Included NCID Wards ---
    WriteConfigHeader ws, 5, "Included NCID Wards", _
        "Inflight-covered wards in the NCID building." & vbNewLine & _
        "These pass through the filter but are NOT tagged NCID."
    ws.Cells(2, 5).Value = "08F"

    ' --- Col F: All NCID Wards (every ward in the NCID building) ---
    WriteConfigHeader ws, 6, "All NCID Wards", _
        "Every ward code in the NCID building." & vbNewLine & _
        "Wards here but not in Included NCID Wards (col E) are tagged NCID."
    Dim allNCID(1 To 12) As String
    allNCID(1) = "03E" : allNCID(2) = "05F" : allNCID(3) = "06F"
    allNCID(4) = "07E" : allNCID(5) = "07F" : allNCID(6) = "08E"
    allNCID(7) = "08F" : allNCID(8) = "09F" : allNCID(9) = "11E"
    allNCID(10) = "11F" : allNCID(11) = "12E" : allNCID(12) = "14F"
    For i = 1 To 12
        ws.Cells(i + 1, 6).Value = allNCID(i)
    Next i

    ' --- Cols G-H: Case Status + Color ---
    WriteConfigHeader ws, 7, "Case Status", _
        "Dropdown values for the Case Status column." & vbNewLine & _
        "Each row pairs with the color in column H."
    WriteConfigHeader ws, 8, "Case Status Color", _
        "Fill color for each Case Status as R,G,B." & vbNewLine & _
        "Example: 255,229,153 for pale gold."
    ws.Range(ws.Cells(2, 8), ws.Cells(10, 8)).NumberFormat = "@"
    ws.Cells(2, 7).Value = "Resolved"  : ws.Cells(2, 8).Value = "169,209,142"
    ws.Cells(3, 7).Value = "U-turn"    : ws.Cells(3, 8).Value = "255,255,0"
    ws.Cells(4, 7).Value = "Clear"     : ws.Cells(4, 8).Value = "255,255,255"

    ' --- Col I: FC Status Keep Values ---
    WriteConfigHeader ws, 9, "FC Status Keep Values", _
        "FC Status values to KEEP (Draft variants)." & vbNewLine & _
        "Rows with these statuses pass through the filter."
    ws.Cells(2, 9).Value = "Draft"
    ws.Cells(3, 9).Value = "Draft (ETBS Generated)"
    ws.Cells(4, 9).Value = "Draft (CCF Generated)"

    ' --- Cols J-K: Settings (key-value pairs) ---
    WriteConfigHeader ws, 10, "Settings", _
        "Key-value settings. Edit the VALUE in column K." & vbNewLine & _
        "Do not rename the keys in column J."
    With ws.Cells(1, 11)
        .Value = "(Values)"
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With

    ws.Cells(2, 10).Value = "Filename Prefix"     : ws.Cells(2, 11).Value = "MFC"
    ws.Cells(3, 10).Value = "Sheet Name"           : ws.Cells(3, 11).Value = "MFC Report"
    ws.Cells(4, 10).Value = "Font Name"            : ws.Cells(4, 11).Value = "Aptos Narrow"
    ws.Cells(5, 10).Value = "Font Size"            : ws.Cells(5, 11).Value = 11
    ws.Range(ws.Cells(6, 11), ws.Cells(9, 11)).NumberFormat = "@"
    ws.Cells(6, 10).Value = "Header Color"         : ws.Cells(6, 11).Value = "31,73,125"
    ws.Cells(7, 10).Value = "Header Font Color"    : ws.Cells(7, 11).Value = "255,255,255"
    ws.Cells(8, 10).Value = "Border Color"         : ws.Cells(8, 11).Value = "89,89,89"
    ws.Cells(9, 10).Value = "Duplicate Color"      : ws.Cells(9, 11).Value = "255,0,0"
    ws.Cells(10, 10).Value = "Date Dropdown Days"  : ws.Cells(10, 11).Value = 30

    ws.Columns("A:K").AutoFit
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
