Attribute VB_Name = "Helpers"
Option Explicit

' Validates that wb's sheet 1 looks like an eFC Task List Report export:
' has "Encounter No" (join key against Epic's CSN) and "Comment"
' (source field for the SMS-required identification logic). Fails loud
' with a specific message rather than a generic error three steps later.
' Returns True/False; errMsg is set only on failure.
Public Function ValidateEfcFile(wb As Workbook, ByRef errMsg As String) As Boolean
    Dim ws As Worksheet
    Set ws = wb.Sheets(1)

    If ws.Cells(1, 1).Value = "" And ws.Cells(2, 1).Value = "" Then
        errMsg = "eFC file appears empty -- check you exported the right report."
        ValidateEfcFile = False
        Exit Function
    End If

    Dim encHeader As String, commentHeader As String
    encHeader = GetSetting("eFC Encounter No Header", "Encounter No")
    commentHeader = GetSetting("eFC Comment Header", "Comment")

    If FindColByHeader(ws, encHeader) = 0 Then
        errMsg = "eFC file missing '" & encHeader & "' column -- check you exported the right report."
        ValidateEfcFile = False
        Exit Function
    End If

    If FindColByHeader(ws, commentHeader) = 0 Then
        errMsg = "eFC file missing '" & commentHeader & "' column -- check you exported the right report."
        ValidateEfcFile = False
        Exit Function
    End If

    ValidateEfcFile = True
End Function

' Validates that wb's sheet 1 looks like an Epic Census Snapshot Report export:
' has "CSN" (join key against eFC's Encounter No) and "Phone". No "Bed" check
' -- dropped 2026-07-21, the real SMS TEMPLATE's blank input columns don't
' include Bed (see design spec's Template Findings section).
' Returns True/False; errMsg is set only on failure.
Public Function ValidateEpicFile(wb As Workbook, ByRef errMsg As String) As Boolean
    Dim ws As Worksheet
    Set ws = wb.Sheets(1)

    If ws.Cells(1, 1).Value = "" And ws.Cells(2, 1).Value = "" Then
        errMsg = "Epic file appears empty -- check you exported the right report."
        ValidateEpicFile = False
        Exit Function
    End If

    Dim csnHeader As String, phoneHeader As String
    csnHeader = GetSetting("Epic CSN Header", "CSN")
    phoneHeader = GetSetting("Epic Phone Header", "Phone")

    If FindColByHeader(ws, csnHeader) = 0 Then
        errMsg = "Epic file missing '" & csnHeader & "' column -- check you exported the right report."
        ValidateEpicFile = False
        Exit Function
    End If

    If FindColByHeader(ws, phoneHeader) = 0 Then
        errMsg = "Epic file missing '" & phoneHeader & "' column -- add it to the export's column selection."
        ValidateEpicFile = False
        Exit Function
    End If

    ValidateEpicFile = True
End Function

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
