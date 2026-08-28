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


' Returns bed code prefixes to exclude as a Variant array (0-based, uppercased).
' Reads from Config "Excluded Bed Prefixes"; falls back to hardcoded defaults.
Public Function GetExcludedBedPrefixes() As Variant
    Dim cfgCount As Long
    Dim cfgVals() As String
    cfgVals = ReadConfigList("Excluded Bed Prefixes", cfgCount)

    If cfgCount > 0 Then
        Dim arr() As String
        ReDim arr(0 To cfgCount - 1)
        Dim i As Long
        For i = 1 To cfgCount
            arr(i - 1) = UCase(Trim(cfgVals(i)))
        Next i
        GetExcludedBedPrefixes = arr
        Exit Function
    End If

    GetExcludedBedPrefixes = Array("AUC", "EDC", "EDTC", "EDX", "EDXO", _
                                   "O14", "O15", "RES", "TWAS", "TWDS")
End Function


' Returns Inflight-covered ward codes in the NCID building via Mid(bed,2,3).
' These wards pass through the bed filter but are NOT tagged Case Status = "NCID".
' Reads from Config "Included NCID Wards"; falls back to hardcoded default.
Public Function GetIncludedNCIDWards() As Variant
    Dim cfgCount As Long
    Dim cfgVals() As String
    cfgVals = ReadConfigList("Included NCID Wards", cfgCount)

    If cfgCount > 0 Then
        Dim arr() As String
        ReDim arr(0 To cfgCount - 1)
        Dim i As Long
        For i = 1 To cfgCount
            arr(i - 1) = UCase(Trim(cfgVals(i)))
        Next i
        GetIncludedNCIDWards = arr
        Exit Function
    End If

    GetIncludedNCIDWards = Array("08F")
End Function


' Returns every ward code in the NCID building via Mid(bed,2,3).
' All wards here pass through the bed filter. Wards here but NOT in
' GetIncludedNCIDWards are tagged Case Status = "NCID".
' Reads from Config "All NCID Wards"; falls back to hardcoded defaults.
Public Function GetAllNCIDWards() As Variant
    Dim cfgCount As Long
    Dim cfgVals() As String
    cfgVals = ReadConfigList("All NCID Wards", cfgCount)

    If cfgCount > 0 Then
        Dim arr() As String
        ReDim arr(0 To cfgCount - 1)
        Dim i As Long
        For i = 1 To cfgCount
            arr(i - 1) = UCase(Trim(cfgVals(i)))
        Next i
        GetAllNCIDWards = arr
        Exit Function
    End If

    GetAllNCIDWards = Array("03E", "05F", "06F", "07E", "07F", _
                             "08E", "08F", "09F", "11E", "11F", "12E", "14F")
End Function


' Returns Case Status names and their RGB fill colors.
' Reads from Config "Case Status" + "Case Status Color" columns.
' Falls back to the 3 hardcoded statuses (Resolved / U-turn / Clear).
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

    count = 3
    ReDim statusNames(1 To 3)
    ReDim statusColors(1 To 3)
    statusNames(1) = "Resolved"  : statusColors(1) = RGB(169, 209, 142)
    statusNames(2) = "U-turn"    : statusColors(2) = RGB(255, 255, 0)
    statusNames(3) = "Clear"     : statusColors(3) = RGB(255, 255, 255)
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
    If IsNumericStr(s) Then
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


' Private helper: checks if a string represents a numeric value.
' Named to avoid shadowing VBA.IsNumeric.
Private Function IsNumericStr(s As String) As Boolean
    On Error GoTo NotNumeric
    Dim dummy As Double
    dummy = CDbl(s)
    IsNumericStr = True
    Exit Function
NotNumeric:
    IsNumericStr = False
End Function
