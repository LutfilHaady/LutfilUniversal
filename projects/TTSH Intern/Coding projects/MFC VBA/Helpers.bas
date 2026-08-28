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

' Creates the Config worksheet in this workbook if it does not already exist.
' Run this once via Alt+F8 before using GenerateMFCReport for the first time.
' After running, update the "Staff Follow Up" column with your team's actual names.
Public Sub CreateConfigSheet()
    Dim ws                      As Worksheet
    Dim inflightDefaults(1 To 5) As String
    Dim i                        As Long

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

    ' Column A header -- Inflight FC Status
    With ws.Cells(1, 1)
        .Value = "Inflight FC Status"
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With

    ' Column B header -- Staff Follow Up
    With ws.Cells(1, 2)
        .Value = "Staff Follow Up"
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With

    ' Tooltip-style comments on the headers guide users without cluttering the sheet
    On Error Resume Next
    ws.Cells(1, 1).Comment.Delete
    ws.Cells(1, 2).Comment.Delete
    ws.Cells(1, 1).AddComment "Edit the list below -- one item per row." & vbNewLine & _
                               "Do not rename or delete this header."
    ws.Cells(1, 2).AddComment "Edit the list below -- one item per row." & vbNewLine & _
                               "Do not rename or delete this header."
    On Error GoTo 0

    ' Default Inflight FC Status values
    inflightDefaults(1) = "Pending"
    inflightDefaults(2) = "In Progress"
    inflightDefaults(3) = "Completed"
    inflightDefaults(4) = "Cancelled"
    inflightDefaults(5) = "On Hold"

    For i = 1 To 5
        ws.Cells(i + 1, 1).Value = inflightDefaults(i)
    Next i

    ' Placeholder staff names -- update with real names after running this sub
    ws.Cells(2, 2).Value = "Staff A"
    ws.Cells(3, 2).Value = "Staff B"
    ws.Cells(4, 2).Value = "Staff C"

    ws.Columns("A:B").AutoFit

    MsgBox "Config sheet created." & vbNewLine & vbNewLine & _
           "Next step: go to the 'Config' tab and replace the Staff Follow Up " & _
           "placeholder names with your team's actual names.", _
           vbInformation, "Config Created"

End Sub
