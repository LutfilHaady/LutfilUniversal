Attribute VB_Name = "Helpers"
Option Explicit

Public GracePeriodMinutes As Long
Public HoursUnitIsMinutes As Boolean
Public RosterWarnings As Collection

' Tracks the most recent operation for diagnostic error messages -- see
' MainMacro.ErrHandler, which appends this to the error MsgBox so a crash
' points at the sheet/row being processed instead of just a line number.
Public LastAction As String

Public Function BuildScheduleKey(dept As String, wkday As String) As String
    BuildScheduleKey = UCase(Trim(dept)) & "|" & UCase(Trim(wkday))
End Function

Public Function FindColByHeader(ws As Worksheet, headerRow As Long, headerText As String) As Long
    Dim lastCol As Long, c As Long
    lastCol = ws.Cells(headerRow, ws.Columns.Count).End(xlToLeft).Column
    For c = 1 To lastCol
        If Trim(CStr(ws.Cells(headerRow, c).Value)) = headerText Then
            FindColByHeader = c
            Exit Function
        End If
    Next c
    FindColByHeader = 0
End Function

' Reads the Config sheet (tblSchedule + tblVerification + GracePeriod named range)
' schedule: Dictionary keyed "DEPT|WEEKDAY" -> Array(IsScheduled As Boolean, StartTime As Double, EndTime As Double)
Public Sub LoadConfig(cfgWs As Worksheet, ByRef schedule As Object, ByRef verifyOptions As Collection)
    Set schedule = CreateObject("Scripting.Dictionary")
    Set verifyOptions = New Collection

    LastAction = "LoadConfig: reading GracePeriod named range"
    Dim gpRange As Range
    On Error Resume Next
    Set gpRange = cfgWs.Range("GracePeriod")
    On Error GoTo 0
    If gpRange Is Nothing Then
        Err.Raise vbObjectError + 2, , "GracePeriod named range not found in Config sheet."
    End If
    GracePeriodMinutes = gpRange.Value

    Dim hoursUnitRaw As String
    On Error Resume Next
    hoursUnitRaw = CStr(cfgWs.Range("HoursUnit").Value)
    On Error GoTo 0
    HoursUnitIsMinutes = (UCase(Trim(hoursUnitRaw)) = "MINUTES")

    LastAction = "LoadConfig: locating tblSchedule"
    Dim lo As ListObject, tbl As ListObject, vtbl As ListObject
    For Each lo In cfgWs.ListObjects
        If lo.Name = "tblSchedule" Then Set tbl = lo: Exit For
    Next lo
    If tbl Is Nothing Then
        Err.Raise vbObjectError + 3, , "tblSchedule table not found in Config sheet."
    End If

    Dim i As Long, key As String
    For i = 1 To tbl.ListRows.Count
        Dim dept As String, wkday As String, sched As String
        dept = CStr(tbl.DataBodyRange(i, 1).Value)
        wkday = CStr(tbl.DataBodyRange(i, 2).Value)
        sched = CStr(tbl.DataBodyRange(i, 3).Value)
        LastAction = "LoadConfig: reading tblSchedule row " & i & " (dept=" & dept & ", weekday=" & wkday & ")"
        key = BuildScheduleKey(dept, wkday)

        Dim arr(2) As Variant
        arr(0) = (UCase(Trim(sched)) = "Y")
        If arr(0) Then
            If Not IsNumeric(tbl.DataBodyRange(i, 4).Value) Or Not IsNumeric(tbl.DataBodyRange(i, 5).Value) Then
                Err.Raise vbObjectError + 4, , "tblSchedule row for " & dept & "/" & wkday & _
                    " has a non-numeric Start Time or End Time."
            End If
            arr(1) = CDbl(tbl.DataBodyRange(i, 4).Value)
            arr(2) = CDbl(tbl.DataBodyRange(i, 5).Value)
        Else
            arr(1) = 0
            arr(2) = 0
        End If
        schedule(key) = arr
    Next i

    LastAction = "LoadConfig: locating tblVerification"
    For Each lo In cfgWs.ListObjects
        If lo.Name = "tblVerification" Then Set vtbl = lo: Exit For
    Next lo
    If vtbl Is Nothing Then
        Err.Raise vbObjectError + 5, , "tblVerification table not found in Config sheet."
    End If
    For i = 1 To vtbl.ListRows.Count
        LastAction = "LoadConfig: reading tblVerification row " & i
        verifyOptions.Add CStr(vtbl.DataBodyRange(i, 1).Value)
    Next i
End Sub

Public Function DeptHasScheduleRows(schedule As Object, dept As String) As Boolean
    Dim wkdays As Variant, i As Long
    wkdays = Array("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
    For i = 0 To 6
        If schedule.Exists(BuildScheduleKey(dept, CStr(wkdays(i)))) Then
            DeptHasScheduleRows = True
            Exit Function
        End If
    Next i
    DeptHasScheduleRows = False
End Function

Public Function ClassifyInStatus(inTime As Double, schedStart As Double, graceMin As Long) As String
    Dim diffMin As Double
    diffMin = (inTime - schedStart) * 1440
    If diffMin <= 0 Then
        ClassifyInStatus = "On Time"
    ElseIf diffMin <= graceMin Then
        ClassifyInStatus = "Within Grace"
    Else
        ClassifyInStatus = "Late"
    End If
End Function

Public Function ClassifyOutStatus(outTime As Double, schedEnd As Double, graceMin As Long) As String
    Dim diffMin As Double
    diffMin = (schedEnd - outTime) * 1440
    If diffMin <= 0 Then
        ClassifyOutStatus = "On Time"
    ElseIf diffMin <= graceMin Then
        ClassifyOutStatus = "Within Grace"
    Else
        ClassifyOutStatus = "Early Leave"
    End If
End Function

' Structural validator for the raw Monthly Punch List export - there is no header
' row to scan (row 1 is a title, row 2 is dates, row 3 is weekday names), so this
' checks the same two structural facts BuildDepartmentSheets/ParseDayHeaders rely
' on: at least one valid date column in row 2, and at least one data row present.
Public Function ValidatePunchListFile(wb As Workbook) As Boolean
    Dim ws As Worksheet
    Set ws = wb.Sheets(1)

    Dim dayCols() As Long, dayDates() As Date, dayNames() As String
    On Error Resume Next
    Err.Clear
    ParseDayHeaders ws, dayCols, dayDates, dayNames
    If Err.Number <> 0 Then
        On Error GoTo 0
        ValidatePunchListFile = False
        Exit Function
    End If
    On Error GoTo 0

    ValidatePunchListFile = (Trim(CStr(ws.Cells(4, 1).Value)) <> "")
End Function

' Optional feature: reads a manager-maintained per-unit leave/duty roster. Each unit
' pastes its own roster into its own table on the "Roster" sheet (named tblRoster_<Unit>,
' e.g. tblRoster_PSO) -- LoadRoster discovers every table whose name starts with
' "tblRoster" and merges them all into one combined rosterData dictionary, so units can
' be added/removed/resized independently without any VBA change. Matching is by plain
' day-of-month (1-31), not calendar date -- the native rosters this feature reads from
' have no month/year anywhere in them, only a day-number column per day. tblRosterCodes
' (Config sheet) lists the recognized leave codes. Both are optional -- if the Roster
' sheet is absent, or has no tblRoster* tables, this leaves rosterCodes/rosterData empty
' and every [-] day behaves exactly as it does without this feature (see
' ReportBuilder.BuildDepartmentSheets, Case "NOPUNCH").
' rosterData is keyed "UCASE(TRIM(AttendanceName))|DayOfMonth" -> UCase'd code string.
Public Sub LoadRoster(wb As Workbook, ByRef rosterCodes As Object, ByRef rosterData As Object)
    Set rosterCodes = CreateObject("Scripting.Dictionary")
    Set rosterData = CreateObject("Scripting.Dictionary")
    Set RosterWarnings = New Collection

    On Error GoTo UnexpectedError

    LastAction = "LoadRoster: locating tblRosterCodes"
    Dim cfgWs As Worksheet
    Set cfgWs = wb.Sheets("Config")
    Dim lo As ListObject, codesTbl As ListObject
    For Each lo In cfgWs.ListObjects
        If lo.Name = "tblRosterCodes" Then Set codesTbl = lo: Exit For
    Next lo

    If Not codesTbl Is Nothing Then
        Dim ci As Long, codeVal As String
        For ci = 1 To codesTbl.ListRows.Count
            LastAction = "LoadRoster: reading tblRosterCodes row " & ci
            codeVal = UCase(Trim(CStr(codesTbl.DataBodyRange(ci, 1).Value)))
            If codeVal <> "" Then rosterCodes(codeVal) = True
        Next ci
    End If

    LastAction = "LoadRoster: locating Roster sheet"
    Dim sh As Worksheet, rosterWs As Worksheet
    For Each sh In wb.Sheets
        If sh.Name = "Roster" Then Set rosterWs = sh: Exit For
    Next sh
    If rosterWs Is Nothing Then Exit Sub

    Dim seenNames As Object
    Set seenNames = CreateObject("Scripting.Dictionary")

    Dim rosterTbl As ListObject
    LastAction = "LoadRoster: enumerating tblRoster* tables"
    For Each lo In rosterWs.ListObjects
        If UCase(Left(lo.Name, 9)) <> "TBLROSTER" Then GoTo NextTable
        Set rosterTbl = lo

        LastAction = "LoadRoster: locating Attendance Name column in " & rosterTbl.Name
        Dim nameCol As ListColumn, idCol As Long
        idCol = 0
        For Each nameCol In rosterTbl.ListColumns
            If nameCol.Name = "Attendance Name" Then idCol = nameCol.Index: Exit For
        Next nameCol
        If idCol = 0 Then
            RosterWarnings.Add rosterTbl.Name & " is missing an 'Attendance Name' column -- roster matching skipped for this table."
            GoTo NextTable
        End If

        LastAction = "LoadRoster: discovering day-of-month columns in " & rosterTbl.Name
        Dim dayColIdx() As Long, dayOfMonthVal() As Long, nDayCols As Long
        ReDim dayColIdx(1 To rosterTbl.ListColumns.Count)
        ReDim dayOfMonthVal(1 To rosterTbl.ListColumns.Count)
        nDayCols = 0

        Dim seenDays As Object
        Set seenDays = CreateObject("Scripting.Dictionary")

        Dim lc As ListColumn, hdrVal As Variant, dayNum As Long
        For Each lc In rosterTbl.ListColumns
            hdrVal = lc.Range.Cells(1, 1).Value
            If IsNumeric(hdrVal) Then
                dayNum = CLng(hdrVal)
                If dayNum >= 1 And dayNum <= 31 Then
                    If seenDays.Exists(dayNum) Then
                        RosterWarnings.Add rosterTbl.Name & " has a duplicate day-of-month column (" & _
                            dayNum & ") -- first occurrence used."
                    Else
                        seenDays(dayNum) = True
                        nDayCols = nDayCols + 1
                        dayColIdx(nDayCols) = lc.Index
                        dayOfMonthVal(nDayCols) = dayNum
                    End If
                End If
            End If
        Next lc

        LastAction = "LoadRoster: reading " & rosterTbl.Name & " rows"
        Dim ri As Long, empName As String
        For ri = 1 To rosterTbl.ListRows.Count
            LastAction = "LoadRoster: reading " & rosterTbl.Name & " row " & ri
            empName = UCase(Trim(CStr(rosterTbl.DataBodyRange(ri, idCol).Value)))
            If empName = "" Then GoTo NextRosterRow

            If seenNames.Exists(empName) Then
                RosterWarnings.Add rosterTbl.Name & " has a duplicate Attendance Name (" & empName & ") -- first occurrence used."
                GoTo NextRosterRow
            End If
            seenNames(empName) = True

            Dim di As Long, cellVal As String
            For di = 1 To nDayCols
                cellVal = UCase(Trim(CStr(rosterTbl.DataBodyRange(ri, dayColIdx(di)).Value)))
                If cellVal <> "" Then rosterData(empName & "|" & dayOfMonthVal(di)) = cellVal
            Next di
NextRosterRow:
        Next ri
NextTable:
    Next lo
    Exit Sub

UnexpectedError:
    RosterWarnings.Add "Unexpected error while loading Roster data (" & Err.Description & _
        ") -- roster matching skipped for this run."
    Set rosterCodes = CreateObject("Scripting.Dictionary")
    Set rosterData = CreateObject("Scripting.Dictionary")
End Sub
