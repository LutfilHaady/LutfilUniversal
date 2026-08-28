Attribute VB_Name = "ReportBuilder"
Option Explicit

Public Sub WriteDetailHeader(ws As Worksheet)
    Dim hrsLbl As String, expLbl As String
    If HoursUnitIsMinutes Then
        hrsLbl = "Minutes Worked": expLbl = "Expected Minutes"
    Else
        hrsLbl = "Hours Worked": expLbl = "Expected Hours"
    End If

    Dim hdrs As Variant
    hdrs = Array("Personnel ID", "Name", "Department", "Date", "Weekday", "Raw Punch", _
                 "Clock In", "Clock Out", "Sched Start", "Sched End", _
                 "Clock-In Status", "Clock-Out Status", "Late (min)", "Early (min)", _
                 hrsLbl, expLbl, "Verification", "Notes")
    Dim i As Long
    For i = 0 To UBound(hdrs)
        With ws.Cells(1, i + 1)
            .Value = hdrs(i)
            .Font.Bold = True
            .Font.Color = RGB(255, 255, 255)
            .Interior.Color = RGB(12, 68, 124)
        End With
    Next i
    ws.Rows(1).AutoFilter
End Sub

' isAltBand alternates per employee block so consecutive employees are easy to tell
' apart at a glance; it only affects the default (no-status) row color so flagged
' statuses below keep taking visual priority.
Public Sub ApplyRowColor(ws As Worksheet, r As Long, statusIn As String, isAltBand As Boolean)
    Dim clr As Long
    If Left(statusIn, Len("NO PUNCH - ROSTER: ")) = "NO PUNCH - ROSTER: " Then
        clr = RGB(215, 235, 250)
    Else
        Select Case statusIn
            Case "NO PUNCH - VERIFY"
                clr = RGB(230, 200, 250)
            Case "Late", "Missing Clock-In"
                clr = RGB(252, 235, 235)
            Case "Within Grace"
                clr = RGB(250, 238, 218)
            Case "UNRECOGNIZED FORMAT"
                clr = RGB(255, 120, 120)
            Case Else
                If isAltBand Then
                    clr = RGB(238, 238, 238)
                Else
                    clr = RGB(255, 255, 255)
                End If
        End Select
    End If
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 18)).Interior.Color = clr
End Sub

Public Sub FinalizeSheet(ws As Worksheet, verifyOptions As Collection, uniqueEmp As Collection)
    LastAction = "FinalizeSheet(" & ws.Name & "): computing last row"
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    Dim sumDecimals As Long
    If HoursUnitIsMinutes Then sumDecimals = 0 Else sumDecimals = 2

    Dim optList As String, v As Variant
    For Each v In verifyOptions
        optList = optList & v & ","
    Next v
    If Len(optList) > 0 Then optList = Left(optList, Len(optList) - 1)

    If lastRow >= 2 And Len(optList) > 0 Then
        LastAction = "FinalizeSheet(" & ws.Name & "): adding Verification dropdown validation"
        With ws.Range("Q2:Q" & lastRow).Validation
            On Error Resume Next
            .Delete
            .Add Type:=xlValidateList, AlertStyle:=xlValidAlertStop, Formula1:=optList
            On Error GoTo 0
        End With
    End If

    LastAction = "FinalizeSheet(" & ws.Name & "): writing summary header"
    ws.Cells(1, 21).Value = "SUMMARY"
    ws.Cells(1, 21).Font.Bold = True
    Dim sumHrsLbl As String, sumExpLbl As String
    If HoursUnitIsMinutes Then
        sumHrsLbl = "Minutes Worked": sumExpLbl = "Expected Minutes"
    Else
        sumHrsLbl = "Hours Worked": sumExpLbl = "Expected Hours"
    End If
    Dim hdrs As Variant
    hdrs = Array("Personnel ID", "Name", "Days Worked", "Late", "Within Grace", "Early Leave", _
                 "Missing Punch", "No Punch-Verify", "Roster-Resolved", sumHrsLbl, sumExpLbl)
    Dim i As Long
    For i = 0 To UBound(hdrs)
        With ws.Cells(2, 21 + i)
            .Value = hdrs(i)
            .Font.Bold = True
            .Interior.Color = RGB(230, 241, 251)
        End With
    Next i

    If lastRow >= 2 Then
        Dim r As Long
        r = 3
        Dim itm As Variant, parts() As String, empID As String, empName As String
        For Each itm In uniqueEmp
            LastAction = "FinalizeSheet(" & ws.Name & "): summary row for employee entry '" & itm & "'"
            parts = Split(itm, "|")
            empID = parts(0)
            empName = parts(1)

            ws.Cells(r, 21).Value = empID
            ws.Cells(r, 22).Value = empName
            ws.Cells(r, 23).Formula = "=COUNTIFS($A$2:$A$" & lastRow & ",$U" & r & ",$K$2:$K$" & lastRow & ",""<>"")"
            ws.Cells(r, 24).Formula = "=COUNTIFS($A$2:$A$" & lastRow & ",$U" & r & ",$K$2:$K$" & lastRow & ",""Late"")"
            ws.Cells(r, 25).Formula = "=COUNTIFS($A$2:$A$" & lastRow & ",$U" & r & ",$K$2:$K$" & lastRow & ",""Within Grace"")+COUNTIFS($A$2:$A$" & lastRow & ",$U" & r & ",$L$2:$L$" & lastRow & ",""Within Grace"")"
            ws.Cells(r, 26).Formula = "=COUNTIFS($A$2:$A$" & lastRow & ",$U" & r & ",$L$2:$L$" & lastRow & ",""Early Leave"")"
            ws.Cells(r, 27).Formula = "=COUNTIFS($A$2:$A$" & lastRow & ",$U" & r & ",$K$2:$K$" & lastRow & ",""Missing Clock-In"")+COUNTIFS($A$2:$A$" & lastRow & ",$U" & r & ",$L$2:$L$" & lastRow & ",""Missing Clock-Out"")"
            ws.Cells(r, 28).Formula = "=COUNTIFS($A$2:$A$" & lastRow & ",$U" & r & ",$K$2:$K$" & lastRow & ",""NO PUNCH - VERIFY"")"
            ' Wildcard match: roster-resolved statuses carry a variable code suffix ("NO PUNCH - ROSTER: AL")
            ws.Cells(r, 29).Formula = "=COUNTIFS($A$2:$A$" & lastRow & ",$U" & r & ",$K$2:$K$" & lastRow & ",""NO PUNCH - ROSTER: *"")"
            ws.Cells(r, 30).Formula = "=ROUND(SUMIFS($O$2:$O$" & lastRow & ",$A$2:$A$" & lastRow & ",$U" & r & ")," & sumDecimals & ")"
            ws.Cells(r, 31).Formula = "=ROUND(SUMIFS($P$2:$P$" & lastRow & ",$A$2:$A$" & lastRow & ",$U" & r & ")," & sumDecimals & ")"
            r = r + 1
        Next itm
    End If

    LastAction = "FinalizeSheet(" & ws.Name & "): autofitting columns"
    ' AutoFit measures rendered text width, so it computes wrong (too-narrow) widths
    ' while ScreenUpdating is off -- the caller runs this whole pipeline with it False.
    Dim priorScreenUpdating As Boolean
    priorScreenUpdating = Application.ScreenUpdating
    Application.ScreenUpdating = True
    ws.Columns("A:AE").AutoFit
    Application.ScreenUpdating = priorScreenUpdating

    LastAction = "FinalizeSheet(" & ws.Name & "): setting freeze panes"
    ws.Application.Goto ws.Range("A1"), True
    ActiveWindow.FreezePanes = False
    ws.Rows("2:2").Select
    ActiveWindow.FreezePanes = True
    ws.Range("A1").Select
End Sub

Public Sub BuildDepartmentSheets(srcWs As Worksheet, outWb As Workbook, schedule As Object, _
                                  verifyOptions As Collection, dayCols() As Long, dayDates() As Date, dayNames() As String, _
                                  rosterCodes As Object, rosterData As Object)
    Dim lastRow As Long, r As Long
    lastRow = srcWs.Cells(srcWs.Rows.Count, 1).End(xlUp).Row

    Dim deptSheetMap As Object, deptRowMap As Object, deptEmpMap As Object, deptBandMap As Object
    Set deptSheetMap = CreateObject("Scripting.Dictionary")
    Set deptRowMap = CreateObject("Scripting.Dictionary")
    Set deptEmpMap = CreateObject("Scripting.Dictionary")
    Set deptBandMap = CreateObject("Scripting.Dictionary")

    Dim unmappedWs As Worksheet, unmappedRow As Long, unmappedEmp As Collection
    Dim unmappedBand As Boolean
    Set unmappedEmp = New Collection
    unmappedRow = 2

    For r = 4 To lastRow
        Dim empID As String, fName As String, dept As String
        empID = Trim(CStr(srcWs.Cells(r, 1).Value))
        If empID = "" Then GoTo NextRow

        fName = Trim(Trim(CStr(srcWs.Cells(r, 2).Value)) & " " & Trim(CStr(srcWs.Cells(r, 3).Value)))
        dept = Trim(CStr(srcWs.Cells(r, 4).Value))
        If dept = "" Then GoTo NextRow

        Dim mapped As Boolean
        mapped = DeptHasScheduleRows(schedule, dept)

        Dim ws As Worksheet, outRow As Long, empColl As Collection

        If mapped Then
            If Not deptSheetMap.Exists(dept) Then
                LastAction = "BuildDepartmentSheets: creating sheet for dept '" & dept & "'"
                Set ws = outWb.Sheets.Add(After:=outWb.Sheets(outWb.Sheets.Count))
                ws.Name = Left(dept, 31)
                WriteDetailHeader ws
                Set deptSheetMap(dept) = ws
                deptRowMap(dept) = 2
                Set deptEmpMap(dept) = New Collection
            End If
            Set ws = deptSheetMap(dept)
            outRow = deptRowMap(dept)
            Set empColl = deptEmpMap(dept)
            deptBandMap(dept) = Not deptBandMap(dept)
        Else
            If unmappedWs Is Nothing Then
                Set unmappedWs = outWb.Sheets.Add(After:=outWb.Sheets(outWb.Sheets.Count))
                unmappedWs.Name = "Unmapped"
                WriteDetailHeader unmappedWs
            End If
            Set ws = unmappedWs
            outRow = unmappedRow
            Set empColl = unmappedEmp
            unmappedBand = Not unmappedBand
        End If

        Dim isAltBand As Boolean
        If mapped Then isAltBand = deptBandMap(dept) Else isAltBand = unmappedBand

        Dim blockStartRow As Long
        blockStartRow = outRow

        On Error Resume Next
        empColl.Add empID & "|" & fName, empID
        On Error GoTo 0

        Dim d As Long
        For d = LBound(dayCols) To UBound(dayCols)
            LastAction = "BuildDepartmentSheets: row " & r & " (empID=" & empID & ", dept=" & dept & "), day " & dayNames(d)
            Dim rawVal As String
            rawVal = CStr(srcWs.Cells(r, dayCols(d)).Value)
            If Trim(rawVal) = "" Then GoTo NextDay

            Dim patType As String, hasIn As Boolean, hasOut As Boolean, inTime As Double, outT As Double
            patType = ParsePunchCell(rawVal, hasIn, hasOut, inTime, outT)

            Dim key As String
            key = BuildScheduleKey(dept, dayNames(d))
            Dim isSched As Boolean, schedStart As Double, schedEnd As Double
            isSched = False
            If schedule.Exists(key) Then
                isSched = schedule(key)(0)
                schedStart = schedule(key)(1)
                schedEnd = schedule(key)(2)
            End If

            Dim statusIn As String, statusOut As String
            Dim lateMin As Variant, earlyMin As Variant, hrsWorked As Variant, expHrs As Variant, verifyMatch As Variant
            Dim effectiveIn As Double
            statusIn = "": statusOut = ""
            lateMin = Empty: earlyMin = Empty: hrsWorked = Empty: expHrs = Empty: verifyMatch = Empty

            Select Case patType
                Case "NOPUNCH"
                    statusIn = "NO PUNCH - VERIFY"
                    statusOut = "N/A"
                    Dim rKey As String, rCode As String
                    rKey = UCase(Trim(fName)) & "|" & Day(dayDates(d))
                    If rosterData.Exists(rKey) Then
                        rCode = CStr(rosterData(rKey))
                        If rosterCodes.Exists(rCode) Then
                            verifyMatch = rCode
                            statusIn = "NO PUNCH - ROSTER: " & rCode
                        End If
                    End If
                Case "MISSING_OUT"
                    statusOut = "Missing Clock-Out"
                    If isSched Then
                        statusIn = ClassifyInStatus(inTime, schedStart, GracePeriodMinutes)
                        lateMin = (inTime - schedStart) * 1440
                        If lateMin < 0 Then lateMin = 0
                        lateMin = Round(lateMin, 1)
                    Else
                        statusIn = "On Time"
                    End If
                Case "MISSING_IN"
                    statusIn = "Missing Clock-In"
                    If isSched Then
                        statusOut = ClassifyOutStatus(outT, schedEnd, GracePeriodMinutes)
                        earlyMin = (schedEnd - outT) * 1440
                        If earlyMin < 0 Then earlyMin = 0
                        earlyMin = Round(earlyMin, 1)
                    Else
                        statusOut = "On Time"
                    End If
                Case "NORMAL"
                    If isSched Then
                        statusIn = ClassifyInStatus(inTime, schedStart, GracePeriodMinutes)
                        statusOut = ClassifyOutStatus(outT, schedEnd, GracePeriodMinutes)
                        lateMin = (inTime - schedStart) * 1440
                        If lateMin < 0 Then lateMin = 0
                        lateMin = Round(lateMin, 1)
                        earlyMin = (schedEnd - outT) * 1440
                        If earlyMin < 0 Then earlyMin = 0
                        earlyMin = Round(earlyMin, 1)

                        effectiveIn = inTime
                        If effectiveIn < schedStart Then effectiveIn = schedStart
                        If HoursUnitIsMinutes Then
                            hrsWorked = Round((outT - effectiveIn) * 1440, 0)
                        Else
                            hrsWorked = Round((outT - effectiveIn) * 24, 2)
                        End If
                    Else
                        statusIn = "On Time (Unscheduled Day)"
                        statusOut = "On Time (Unscheduled Day)"
                    End If
                Case Else
                    statusIn = "UNRECOGNIZED FORMAT"
                    statusOut = "UNRECOGNIZED FORMAT"
            End Select

            If isSched Then
                If HoursUnitIsMinutes Then
                    expHrs = Round((schedEnd - schedStart) * 1440, 0)
                Else
                    expHrs = Round((schedEnd - schedStart) * 24, 2)
                End If
            End If

            ws.Cells(outRow, 1).Value = empID
            ws.Cells(outRow, 2).Value = fName
            ws.Cells(outRow, 3).Value = dept
            ws.Cells(outRow, 4).Value = dayDates(d)
            ws.Cells(outRow, 4).NumberFormat = "dd/mm/yyyy"
            ws.Cells(outRow, 5).Value = dayNames(d)
            ws.Cells(outRow, 6).Value = rawVal
            If hasIn Then
                ws.Cells(outRow, 7).Value = inTime
                ws.Cells(outRow, 7).NumberFormat = "hh:mm"
            End If
            If hasOut Then
                ws.Cells(outRow, 8).Value = outT
                ws.Cells(outRow, 8).NumberFormat = "hh:mm"
            End If
            If isSched Then
                ws.Cells(outRow, 9).Value = schedStart
                ws.Cells(outRow, 9).NumberFormat = "hh:mm"
                ws.Cells(outRow, 10).Value = schedEnd
                ws.Cells(outRow, 10).NumberFormat = "hh:mm"
            End If
            ws.Cells(outRow, 11).Value = statusIn
            ws.Cells(outRow, 12).Value = statusOut
            If Not IsEmpty(lateMin) Then ws.Cells(outRow, 13).Value = lateMin
            If Not IsEmpty(earlyMin) Then ws.Cells(outRow, 14).Value = earlyMin
            If Not IsEmpty(hrsWorked) Then ws.Cells(outRow, 15).Value = hrsWorked
            If Not IsEmpty(expHrs) Then ws.Cells(outRow, 16).Value = expHrs
            If Not IsEmpty(verifyMatch) Then ws.Cells(outRow, 17).Value = verifyMatch

            ApplyRowColor ws, outRow, statusIn, isAltBand

            outRow = outRow + 1
NextDay:
        Next d

        If outRow > blockStartRow Then
            With ws.Range(ws.Cells(outRow - 1, 1), ws.Cells(outRow - 1, 18)).Borders(xlEdgeBottom)
                .LineStyle = xlContinuous
                .Weight = xlThick
                .Color = RGB(80, 80, 80)
            End With
        End If

        If mapped Then
            deptRowMap(dept) = outRow
        Else
            unmappedRow = outRow
        End If
NextRow:
    Next r

    Dim dKey As Variant
    For Each dKey In deptSheetMap.Keys
        Dim finalWs As Worksheet, finalEmp As Collection
        Set finalWs = deptSheetMap(dKey)
        Set finalEmp = deptEmpMap(dKey)
        FinalizeSheet finalWs, verifyOptions, finalEmp
    Next dKey
    If Not unmappedWs Is Nothing Then
        FinalizeSheet unmappedWs, verifyOptions, unmappedEmp
    End If
End Sub
