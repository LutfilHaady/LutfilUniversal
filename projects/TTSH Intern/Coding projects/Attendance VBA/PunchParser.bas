Attribute VB_Name = "PunchParser"
Option Explicit

' Raw cell formats observed in the Monthly Punch List export:
'   "07:47-17:00"  -> normal, both punches present
'   "[-]"          -> scheduled day, zero punches at all
'   "09:27-]"      -> clock-in present, clock-out missing
'   "[-17:01"      -> clock-in missing, clock-out present
'   ""             -> not scheduled that day (blank cell, not an error)
' Returns one of: "NORMAL","NOPUNCH","MISSING_IN","MISSING_OUT","BLANK","UNKNOWN"
Public Function ParsePunchCell(raw As String, ByRef hasIn As Boolean, ByRef hasOut As Boolean, _
                                ByRef inTime As Double, ByRef outTime As Double) As String
    Dim s As String
    s = Trim(raw)
    hasIn = False
    hasOut = False
    inTime = 0
    outTime = 0

    If s = "" Then
        ParsePunchCell = "BLANK"
        Exit Function
    End If

    If s = "[-]" Then
        ParsePunchCell = "NOPUNCH"
        Exit Function
    End If

    Dim dashPos As Long
    dashPos = InStr(s, "-")
    If dashPos = 0 Then
        ParsePunchCell = "UNKNOWN"
        Exit Function
    End If

    Dim leftPart As String, rightPart As String
    leftPart = Trim(Left(s, dashPos - 1))
    rightPart = Trim(Mid(s, dashPos + 1))

    If leftPart = "[" Then
        hasIn = False
    Else
        hasIn = True
        On Error GoTo BadFormat
        inTime = TimeSerial(CInt(Left(leftPart, 2)), CInt(Mid(leftPart, 4, 2)), 0)
        On Error GoTo 0
    End If

    If rightPart = "]" Then
        hasOut = False
    Else
        hasOut = True
        On Error GoTo BadFormat
        outTime = TimeSerial(CInt(Left(rightPart, 2)), CInt(Mid(rightPart, 4, 2)), 0)
        On Error GoTo 0
    End If

    If hasIn And hasOut Then
        ParsePunchCell = "NORMAL"
    ElseIf hasIn And Not hasOut Then
        ParsePunchCell = "MISSING_OUT"
    ElseIf Not hasIn And hasOut Then
        ParsePunchCell = "MISSING_IN"
    Else
        ParsePunchCell = "NOPUNCH"
    End If
    Exit Function

BadFormat:
    ParsePunchCell = "UNKNOWN"
End Function

' Reads row 2 (dates) and row 3 (weekday names) of the raw export, starting at column E,
' and returns only the columns that actually contain a valid date - handles 28/29/30/31 day months.
Public Sub ParseDayHeaders(ws As Worksheet, ByRef dayCols() As Long, ByRef dayDates() As Date, ByRef dayNames() As String)
    Dim lastCol As Long, c As Long, n As Long
    lastCol = ws.Cells(2, ws.Columns.Count).End(xlToLeft).Column

    ReDim dayCols(1 To lastCol)
    ReDim dayDates(1 To lastCol)
    ReDim dayNames(1 To lastCol)
    n = 0

    For c = 5 To lastCol
        If IsDate(ws.Cells(2, c).Value) Then
            n = n + 1
            dayCols(n) = c
            dayDates(n) = CDate(ws.Cells(2, c).Value)
            dayNames(n) = CStr(ws.Cells(3, c).Value)
        End If
    Next c

    If n = 0 Then
        Err.Raise vbObjectError + 1, , "No valid date columns found in row 2 of the raw file. Check the export format."
    End If

    ReDim Preserve dayCols(1 To n)
    ReDim Preserve dayDates(1 To n)
    ReDim Preserve dayNames(1 To n)
End Sub
