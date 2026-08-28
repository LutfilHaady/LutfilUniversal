Attribute VB_Name = "Helpers"
Option Explicit

' ============================================================
' Helpers.bas
'
' Shared utilities for the FC Completion Report macro:
'   - Column lookup by header (tolerant of wrapped/whitespace headers)
'   - Input file validation (FilePickerForm)
'   - Staff roster (Config sheet): Staff Name -> Team lookup
'
' Team names used throughout the macro (DeduplicateEncounters, BuildOutput):
'   ED/EDFC, Inflight, NCID AO, ICH PSO, Admin/Managers, Others
' "Others" is the default for any staff name not listed in the Config sheet,
' so the macro runs correctly even before the roster is filled in.
' ============================================================

Public Const TEAM_ED_EDFC As String = "ED/EDFC"
Public Const TEAM_INFLIGHT As String = "Inflight"
Public Const TEAM_NCID_AO As String = "NCID AO"
Public Const TEAM_ICH_PSO As String = "ICH PSO"
Public Const TEAM_ADMIN As String = "Admin/Managers"
Public Const TEAM_OTHERS As String = "Others"

' ---- Column lookup -----------------------------------------

' Searches row 1 of ws for a column whose header matches headerName.
' Matching is case-insensitive and whitespace-tolerant: line breaks
' (Alt+Enter / wrapped headers), non-breaking spaces, and runs of spaces
' are all normalised to a single space before comparison.
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

' Encounter Number column is labelled differently across the two eFC exports:
'   - FC Summary Report (File A)         -> "Encounter Number"
'   - Inflight Missed FC Report (File B) -> "Encounter No"
' Try both spellings so the rest of the macro can use one column lookup.
Public Function FindEncounterCol(ws As Worksheet) As Long
    Dim col As Long
    col = FindColByHeader(ws, "Encounter Number")
    If col = 0 Then col = FindColByHeader(ws, "Encounter No")
    FindEncounterCol = col
End Function

' ---- File validation (used by FilePickerForm) -----------------------------------------

' Validates that wb's first sheet has the critical columns for fileType.
'   "FC_SUMMARY"      -- File A, FC Summary Report
'   "INFLIGHT_MISSED" -- File B, Inflight Missed FC Report (Missed FC ticked)
Public Function ValidateFileHeaders(wb As Workbook, fileType As String) As Boolean
    Dim ws As Worksheet
    Set ws = wb.Sheets(1)

    Dim isValid As Boolean
    isValid = False

    Select Case UCase(fileType)
        Case "FC_SUMMARY"
            ' Critical columns per CLAUDE.md: FC ID, Encounter Number, FC Status, FC Mode
            If FindColByHeader(ws, "FC ID") > 0 And _
               FindEncounterCol(ws) > 0 And _
               FindColByHeader(ws, "FC Status") > 0 And _
               FindColByHeader(ws, "FC Mode") > 0 Then
                isValid = True
            End If

        Case "INFLIGHT_MISSED"
            ' Critical columns per CLAUDE.md: Encounter No, Missed FC, Admission Status
            If FindEncounterCol(ws) > 0 And _
               FindColByHeader(ws, "Missed FC") > 0 And _
               FindColByHeader(ws, "Admission Status") > 0 Then
                isValid = True
            End If
    End Select

    ValidateFileHeaders = isValid
End Function

' Returns True if File B's "Missed FC" column exists but is entirely blank --
' i.e. the export was taken without ticking the "Missed FC" indicator.
' FilePickerForm uses this to warn the user to re-export with the indicator
' ticked, or use the manual eFC dashboard workaround export (CLAUDE.md).
Public Function IsMissedFCColumnBlank(wb As Workbook) As Boolean
    Dim ws As Worksheet
    Set ws = wb.Sheets(1)

    Dim missedCol As Long
    missedCol = FindColByHeader(ws, "Missed FC")
    If missedCol = 0 Then
        IsMissedFCColumnBlank = False
        Exit Function
    End If

    Dim encCol As Long
    encCol = FindEncounterCol(ws)
    If encCol = 0 Then
        IsMissedFCColumnBlank = False
        Exit Function
    End If

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then
        IsMissedFCColumnBlank = False
        Exit Function
    End If

    Dim data As Variant
    data = ws.Range(ws.Cells(2, missedCol), ws.Cells(lastRow, missedCol)).Value

    Dim i As Long
    If lastRow = 2 Then
        ' Single-cell range comes back as a scalar, not a 2-D array
        IsMissedFCColumnBlank = (Trim(CStr(data)) = "")
        Exit Function
    End If

    For i = 1 To UBound(data, 1)
        If Trim(CStr(data(i, 1))) <> "" Then
            IsMissedFCColumnBlank = False
            Exit Function
        End If
    Next i

    IsMissedFCColumnBlank = True
End Function

' ---- Staff roster (Config sheet) -----------------------------------------

' Creates the Config worksheet in this workbook if it does not already exist.
' Run this once via Alt+F8 before using GenerateFCCompletionReport for the first time.
' After running, go to the Config tab and replace the placeholder staff names
' with your team's actual names and teams.
Public Sub CreateConfigSheet()
    Dim ws As Worksheet

    On Error Resume Next
    Set ws = ThisWorkbook.Sheets("Config")
    On Error GoTo 0

    If Not ws Is Nothing Then
        MsgBox "Config sheet already exists. Edit it directly to update the staff roster.", _
               vbInformation, "Config"
        Exit Sub
    End If

    Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
    ws.Name = "Config"

    ' Column A header -- Staff Name
    With ws.Cells(1, 1)
        .Value = "Staff Name"
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With

    ' Column B header -- Team
    With ws.Cells(1, 2)
        .Value = "Team"
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With

    ' Tooltip-style comments on the headers guide users without cluttering the sheet
    On Error Resume Next
    ws.Cells(1, 1).Comment.Delete
    ws.Cells(1, 2).Comment.Delete
    ws.Cells(1, 1).AddComment "Edit the list below -- one staff member per row, exactly as " & _
                               "their name appears in the eFC 'FC Created By' / " & _
                               "'Latest CCF Creation User' columns." & vbNewLine & _
                               "Do not rename or delete this header."
    ws.Cells(1, 2).AddComment "Pick a team from the dropdown for each staff member." & vbNewLine & _
                               "Anyone left off this list is treated as '" & TEAM_OTHERS & "'." & vbNewLine & _
                               "Do not rename or delete this header."
    On Error GoTo 0

    ' Placeholder roster -- update with real names/teams after running this sub
    ws.Cells(2, 1).Value = "Staff A"
    ws.Cells(2, 2).Value = TEAM_ED_EDFC
    ws.Cells(3, 1).Value = "Staff B"
    ws.Cells(3, 2).Value = TEAM_INFLIGHT
    ws.Cells(4, 1).Value = "Staff C"
    ws.Cells(4, 2).Value = TEAM_NCID_AO

    ' Dropdown validation on the Team column for the placeholder rows and a
    ' generous block below them, so staff can keep adding names.
    Dim teamList As String
    teamList = TEAM_ED_EDFC & "," & TEAM_INFLIGHT & "," & TEAM_NCID_AO & "," & _
               TEAM_ICH_PSO & "," & TEAM_ADMIN & "," & TEAM_OTHERS

    With ws.Range("B2:B500").Validation
        .Delete
        .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:=teamList
        .IgnoreBlank = True
        .InCellDropdown = True
    End With

    ws.Columns("A:B").AutoFit

    MsgBox "Config sheet created." & vbNewLine & vbNewLine & _
           "Next step: go to the 'Config' tab and replace the placeholder staff " & _
           "names with your team's actual names, and set each person's Team " & _
           "from the dropdown.", _
           vbInformation, "Config Created"

End Sub

' Loads the Staff Name -> Team roster from the Config sheet into a Dictionary
' (keys are staff names, case-insensitive). Returns an empty Dictionary if the
' Config sheet doesn't exist yet or is missing its headers -- GetStaffTeam then
' defaults everyone to "Others", so the macro still runs correctly before the
' roster is filled in.
Public Function LoadStaffRoster() As Object
    Dim roster As Object
    Set roster = CreateObject("Scripting.Dictionary")
    roster.CompareMode = vbTextCompare

    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets("Config")
    On Error GoTo 0
    If ws Is Nothing Then
        Set LoadStaffRoster = roster
        Exit Function
    End If

    Dim nameCol As Long, teamCol As Long
    nameCol = FindColByHeader(ws, "Staff Name")
    teamCol = FindColByHeader(ws, "Team")
    If nameCol = 0 Or teamCol = 0 Then
        Set LoadStaffRoster = roster
        Exit Function
    End If

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, nameCol).End(xlUp).Row

    Dim i As Long
    Dim nm As String, tm As String
    For i = 2 To lastRow
        nm = Trim(CStr(ws.Cells(i, nameCol).Value))
        tm = Trim(CStr(ws.Cells(i, teamCol).Value))
        If nm <> "" And tm <> "" Then roster(nm) = tm
    Next i

    Set LoadStaffRoster = roster
End Function

' Returns the team for a given staff name, looked up from the roster Dictionary
' returned by LoadStaffRoster. Defaults to "Others" if the name is blank, not
' found in the roster, or the roster is empty.
Public Function GetStaffTeam(roster As Object, staffName As String) As String
    Dim nm As String
    nm = Trim(CStr(staffName))

    If nm = "" Then
        GetStaffTeam = TEAM_OTHERS
    ElseIf roster.Exists(nm) Then
        GetStaffTeam = CStr(roster(nm))
    Else
        GetStaffTeam = TEAM_OTHERS
    End If
End Function
