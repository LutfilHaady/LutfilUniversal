Attribute VB_Name = "ConfigReader"
Option Explicit

' ============================================================
' ConfigReader.bas
'
' Central reader/writer for the Config sheet. See docs/superpowers/specs/
' 2026-07-21-sms-broadcast-config-sheet-design.md. Every read function
' falls back to hardcoded defaults when the Config sheet or a specific
' column/row is missing, so the macro works identically with no Config
' sheet at all. Ported from the sibling MFC macro's ConfigReader.bas.
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

' Reads a single key-value setting from the Config "Settings" column (the
' value sits in the column immediately to its right). Keys are matched
' case-insensitively. Returns defaultVal if the sheet, the "Settings"
' column, or the key isn't found.
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

' Alt+F8 setup entry point (design spec: creation is explicit, never an
' implicit side effect of a normal broadcast run). If Config already
' exists, warns and makes no changes -- never overwrites existing edits.
' Seeds both the phrase/value list columns and the Settings key/value
' pairs with today's hardcoded defaults, so the sheet is immediately
' meaningful rather than blank.
Public Sub CreateConfigSheet()
    Dim existing As Worksheet
    Set existing = GetConfigSheet()
    If Not existing Is Nothing Then
        MsgBox "Config sheet already exists -- no changes made.", vbInformation, "Config Sheet"
        Exit Sub
    End If

    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
    ws.Name = "Config"

    ' --- Block A: phrase/value lists (columns A-E) ---
    WriteListColumn ws, 1, "MCAF Reminder Phrases", Array("MCAF REMINDER")
    WriteListColumn ws, 2, "FC Done Phrases", Array("FC DONE", "PHONE FC DONE")
    WriteListColumn ws, 3, "No FC Done Phrases", Array("NO FC DONE")
    WriteListColumn ws, 4, "Ward Class Phrases", Array("WARD CLASS SELECTED")
    WriteListColumn ws, 5, "Epic Placeholder Numbers", Array("88888888", "99999999")

    ' --- Block B: Settings key/value pairs (columns G-H, leaving F blank) ---
    ws.Cells(1, 7).Value = "Settings"
    ws.Cells(1, 8).Value = "Value"
    ws.Range(ws.Cells(1, 7), ws.Cells(1, 8)).Font.Bold = True

    Dim settingsKeys As Variant, settingsVals As Variant
    settingsKeys = Array("eFC Encounter No Header", "eFC MRN Header", "eFC Patient Name Header", _
                          "eFC Comment Header", "Epic CSN Header", "Epic Phone Header", _
                          "Broadcast Upload Header")
    settingsVals = Array("Encounter No", "MRN", "Patient Name", "Comment", "CSN", "Phone", "Mobile Number")

    Dim i As Long
    For i = 0 To UBound(settingsKeys)
        ws.Cells(2 + i, 7).Value = settingsKeys(i)
        ws.Cells(2 + i, 8).Value = settingsVals(i)
    Next i

    ws.Columns("A:H").AutoFit

    MsgBox "Config sheet created with today's default phrases and settings." & vbNewLine & _
           "Edit it directly to widen matching or remap column headers.", _
           vbInformation, "Config Sheet Created"
End Sub

' Writes a bold header in row 1 of colIdx and one value per row below it.
Private Sub WriteListColumn(ws As Worksheet, colIdx As Long, headerName As String, values As Variant)
    ws.Cells(1, colIdx).Value = headerName
    ws.Cells(1, colIdx).Font.Bold = True

    Dim i As Long
    For i = 0 To UBound(values)
        ws.Cells(2 + i, colIdx).Value = values(i)
    Next i
End Sub
