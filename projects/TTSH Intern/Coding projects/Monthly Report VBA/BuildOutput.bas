Attribute VB_Name = "BuildOutput"
Option Explicit

' ============================================================
' BuildOutput.bas
'
' Builds the FC Completion Report output workbook:
'   - EM sheet (Emergency encounters from File A)
'   - EL sheet (Elective Inpatient encounters from File A)
'   - Missed FC sheet (File B data)
'   - Summary sheet (colour-coded completion + team breakdown)
'   - Methodology sheet (plain-language rule explanation)
'   - Staff Roster Check sheet (roster coverage check)
' ============================================================

Public Const SHEET_EM As String = "EM"
Public Const SHEET_EL As String = "EL"
Public Const SHEET_MISSED_FC As String = "Missed FC"
Public Const SHEET_SUMMARY As String = "Summary"
Public Const SHEET_METHODOLOGY As String = "Methodology"
Public Const SHEET_STAFF_ROSTER_CHECK As String = "Staff Roster Check"

Private Const ADM_EMERGENCY As String = "Emergency"
Private Const ADM_ELECTIVE  As String = "Elective Inpatient"

' ---- Date parsing (eFC export format) ------------------------------------

Private Function TryParseDMYDate(dateText As String, ByRef result As Date) As Boolean
    Dim datePart As String
    Dim spacePos As Long
    spacePos = InStr(dateText, " ")
    If spacePos > 0 Then
        datePart = Trim(Left(dateText, spacePos - 1))
    Else
        datePart = Trim(dateText)
    End If

    Dim parts() As String
    parts = Split(datePart, "/")
    If UBound(parts) <> 2 Then
        TryParseDMYDate = False
        Exit Function
    End If
    If Not IsNumeric(parts(0)) Or Not IsNumeric(parts(1)) Or Not IsNumeric(parts(2)) Then
        TryParseDMYDate = False
        Exit Function
    End If

    Dim d As Long, m As Long, y As Long
    d = CLng(parts(0)): m = CLng(parts(1)): y = CLng(parts(2))
    If y < 100 Then y = y + 2000

    On Error GoTo Fail
    result = DateSerial(y, m, d)
    TryParseDMYDate = True
    Exit Function
Fail:
    TryParseDMYDate = False
End Function

Public Function GetReportPeriodLabel(fileAws As Worksheet) As String
    Dim admDateCol As Long
    admDateCol = FindColByHeader(fileAws, "Admission Date")
    If admDateCol = 0 Then GetReportPeriodLabel = "": Exit Function

    Dim encCol As Long
    encCol = FindEncounterCol(fileAws)
    If encCol = 0 Then GetReportPeriodLabel = "": Exit Function

    Dim lastRow As Long
    lastRow = fileAws.Cells(fileAws.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then GetReportPeriodLabel = "": Exit Function

    Dim data As Variant
    data = fileAws.Range(fileAws.Cells(2, admDateCol), fileAws.Cells(lastRow, admDateCol)).Value

    Dim counts As Object
    Set counts = CreateObject("Scripting.Dictionary")

    Dim i As Long, txt As String, parsed As Date, key As String
    For i = 1 To (lastRow - 1)
        If lastRow = 2 Then txt = CStr(data) Else txt = CStr(data(i, 1))
        If TryParseDMYDate(txt, parsed) Then
            key = Year(parsed) & "-" & Month(parsed)
            If counts.Exists(key) Then counts(key) = counts(key) + 1 Else counts(key) = 1
        End If
    Next i

    If counts.Count = 0 Then GetReportPeriodLabel = "": Exit Function

    Dim bestKey As String, bestCount As Long
    Dim k As Variant
    For Each k In counts.Keys
        If counts(k) > bestCount Then bestCount = counts(k): bestKey = CStr(k)
    Next k

    Dim pts() As String
    pts = Split(bestKey, "-")
    GetReportPeriodLabel = MonthName(CLng(pts(1)), False) & CStr(CLng(pts(0)))
End Function

' ---- Small helpers -------------------------------------------------------

Private Sub InitTeamCounts(d As Object)
    d.CompareMode = vbTextCompare
    d(TEAM_ED_EDFC) = 0
    d(TEAM_INFLIGHT) = 0
    d(TEAM_NCID_AO) = 0
    d(TEAM_ICH_PSO) = 0
    d(TEAM_ADMIN) = 0
    d(TEAM_OTHERS) = 0
End Sub

Private Function AddSheet(wb As Workbook, sheetName As String) As Worksheet
    Dim ws As Worksheet
    Set ws = wb.Sheets.Add(After:=wb.Sheets(wb.Sheets.Count))
    ws.Name = sheetName
    Set AddSheet = ws
End Function

Private Sub FormatHeaderRow(ws As Worksheet, lastCol As Long)
    With ws.Range(ws.Cells(1, 1), ws.Cells(1, lastCol))
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With
    On Error Resume Next
    ws.Rows(1).AutoFilter
    On Error GoTo 0
End Sub

Private Function SafePct(num As Long, denom As Long) As Double
    If denom > 0 Then SafePct = num / denom Else SafePct = 0
End Function

Private Function CellStr(v As Variant) As String
    CellStr = Trim(CStr(v))
End Function

' ---- Write File A rows to a sheet, filtered by Admission Type ------------

Private Function WriteFilteredFileASheet(ws As Worksheet, fullData As Variant, _
        totalRows As Long, outCols As Long, admTypeCol As Long, _
        filterValue As String) As Long

    Dim matchCount As Long, i As Long, j As Long
    For i = 2 To totalRows
        If UCase(CellStr(fullData(i, admTypeCol))) = UCase(filterValue) Then
            matchCount = matchCount + 1
        End If
    Next i

    For j = 1 To outCols
        ws.Cells(1, j).Value = fullData(1, j)
    Next j

    If matchCount = 0 Then
        FormatHeaderRow ws, outCols
        ws.UsedRange.Columns.AutoFit
        WriteFilteredFileASheet = 0
        Exit Function
    End If

    Dim outArr() As Variant
    ReDim outArr(1 To matchCount, 1 To outCols)
    Dim outRow As Long
    For i = 2 To totalRows
        If UCase(CellStr(fullData(i, admTypeCol))) = UCase(filterValue) Then
            outRow = outRow + 1
            For j = 1 To outCols
                outArr(outRow, j) = fullData(i, j)
            Next j
        End If
    Next i

    ws.Range(ws.Cells(2, 1), ws.Cells(1 + matchCount, outCols)).Value = outArr
    FormatHeaderRow ws, outCols
    ws.UsedRange.Columns.AutoFit
    WriteFilteredFileASheet = matchCount
End Function

' ---- Highlight rows where Latest CCF Creation User was blank (Q7) --------

Private Sub HighlightCCFFallbackRows(ws As Worksheet)
    Dim latestCol As Long, closerCol As Long, encCol As Long
    latestCol = FindColByHeader(ws, "Latest CCF Creation User")
    closerCol = FindColByHeader(ws, "CCF Closed By")
    encCol = FindEncounterCol(ws)
    If latestCol = 0 Or closerCol = 0 Or encCol = 0 Then Exit Sub

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then Exit Sub

    Dim rng As Range
    Dim i As Long
    For i = 2 To lastRow
        If CellStr(ws.Cells(i, latestCol).Value) = "" And _
           CellStr(ws.Cells(i, closerCol).Value) <> "" Then
            If rng Is Nothing Then
                Set rng = ws.Cells(i, closerCol)
            Else
                Set rng = Union(rng, ws.Cells(i, closerCol))
            End If
        End If
    Next i

    If Not rng Is Nothing Then rng.Interior.Color = RGB(255, 255, 153)
End Sub

' ---- Write Missed FC sheet (File B data as-is) ---------------------------

Private Sub WriteMissedFCSheet(ws As Worksheet, fileBws As Worksheet)
    Dim encCol As Long
    encCol = FindEncounterCol(fileBws)
    If encCol = 0 Then
        ws.Cells(1, 1).Value = "No encounter column found in File B."
        Exit Sub
    End If

    Dim lastRow As Long, lastCol As Long
    lastRow = fileBws.Cells(fileBws.Rows.Count, encCol).End(xlUp).Row
    lastCol = fileBws.Cells(1, fileBws.Columns.Count).End(xlToLeft).Column
    If lastRow < 1 Or lastCol < 1 Then Exit Sub

    Dim data As Variant
    data = fileBws.Range(fileBws.Cells(1, 1), fileBws.Cells(lastRow, lastCol)).Value

    ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value = data
    FormatHeaderRow ws, lastCol
    ws.UsedRange.Columns.AutoFit
End Sub

' ---- Summary sheet -------------------------------------------------------

Private Sub WriteSummaryBlock(ws As Worksheet, ByRef r As Long, _
        title As String, encCount As Long, missedCount As Long, _
        greenCt As Long, lgCt As Long, orgCt As Long, redCt As Long, _
        teamD As Object, blankCCFCt As Long, _
        edInit As Long, edFull As Long, inflFull As Long, ncidFull As Long)

    Dim denom As Long
    denom = encCount + missedCount

    ws.Cells(r, 1).Value = title
    ws.Cells(r, 1).Font.Bold = True
    ws.Cells(r, 1).Font.Size = 12
    r = r + 1

    ws.Cells(r, 1).Value = "Denominator: " & denom & " encounters"
    If missedCount > 0 Then
        ws.Cells(r, 1).Value = ws.Cells(r, 1).Value & _
            " (" & encCount & " from FC Summary + " & missedCount & " missed FC)"
    End If
    r = r + 2

    ' ---- Completion status table ----
    ws.Cells(r, 1).Value = "Completion Status"
    ws.Cells(r, 2).Value = "Count"
    ws.Cells(r, 3).Value = "%"
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 3)).Font.Bold = True
    r = r + 1

    ' Green
    ws.Cells(r, 1).Value = "FC Completed with written acknowledgement"
    ws.Cells(r, 2).Value = greenCt
    ws.Cells(r, 3).Value = SafePct(greenCt, denom)
    ws.Cells(r, 3).NumberFormat = "0.0%"
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 3)).Interior.Color = RGB(146, 208, 80)
    r = r + 1

    ' Light Green
    ws.Cells(r, 1).Value = "CCF explained but not signed"
    ws.Cells(r, 2).Value = lgCt
    ws.Cells(r, 3).Value = SafePct(lgCt, denom)
    ws.Cells(r, 3).NumberFormat = "0.0%"
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 3)).Interior.Color = RGB(198, 239, 206)
    r = r + 1

    ' Orange
    ws.Cells(r, 1).Value = "Attempted, no further follow-up"
    ws.Cells(r, 2).Value = orgCt
    ws.Cells(r, 3).Value = SafePct(orgCt, denom)
    ws.Cells(r, 3).NumberFormat = "0.0%"
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 3)).Interior.Color = RGB(255, 192, 0)
    r = r + 1

    ' Red
    Dim totalRed As Long
    totalRed = redCt + missedCount
    ws.Cells(r, 1).Value = "Not Completed / Missed FC"
    ws.Cells(r, 2).Value = totalRed
    ws.Cells(r, 3).Value = SafePct(totalRed, denom)
    ws.Cells(r, 3).NumberFormat = "0.0%"
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 3)).Interior.Color = RGB(255, 199, 206)
    r = r + 1

    ' Total
    ws.Cells(r, 1).Value = "Total"
    ws.Cells(r, 2).Value = denom
    ws.Cells(r, 3).Value = 1
    ws.Cells(r, 3).NumberFormat = "0.0%"
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 3)).Font.Bold = True
    r = r + 2

    ' ---- Who closed the CCF ----
    ws.Cells(r, 1).Value = "Who Closed the CCF"
    ws.Cells(r, 2).Value = "Count"
    ws.Cells(r, 3).Value = "%"
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 3)).Font.Bold = True
    r = r + 1

    Dim teams As Variant
    teams = Array(TEAM_ED_EDFC, TEAM_INFLIGHT, TEAM_NCID_AO, _
                  TEAM_ICH_PSO, TEAM_ADMIN, TEAM_OTHERS)
    Dim t As Long
    For t = LBound(teams) To UBound(teams)
        Dim tName As String
        tName = CStr(teams(t))
        Dim tCount As Long
        tCount = 0
        If teamD.Exists(tName) Then tCount = teamD(tName)
        ws.Cells(r, 1).Value = tName
        ws.Cells(r, 2).Value = tCount
        ws.Cells(r, 3).Value = SafePct(tCount, denom)
        ws.Cells(r, 3).NumberFormat = "0.0%"
        r = r + 1
    Next t

    ws.Cells(r, 1).Value = "CCF not generated (Missed FC)"
    ws.Cells(r, 2).Value = missedCount
    ws.Cells(r, 3).Value = SafePct(missedCount, denom)
    ws.Cells(r, 3).NumberFormat = "0.0%"
    r = r + 1

    ws.Cells(r, 1).Value = "Total"
    ws.Cells(r, 2).Value = denom
    ws.Cells(r, 3).Value = 1
    ws.Cells(r, 3).NumberFormat = "0.0%"
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 3)).Font.Bold = True

    If blankCCFCt > 0 Then
        r = r + 1
        ws.Cells(r, 1).Value = "  (" & blankCCFCt & _
            " encounter(s) had blank 'Latest CCF Creation User' -- fell back to 'FC Created By')"
        ws.Cells(r, 1).Font.Italic = True
    End If
    r = r + 2

    ' ---- FC Activity Detail ----
    ws.Cells(r, 1).Value = "FC Activity Detail"
    ws.Cells(r, 2).Value = "Count"
    ws.Range(ws.Cells(r, 1), ws.Cells(r, 2)).Font.Bold = True
    r = r + 1

    ws.Cells(r, 1).Value = "FC created by EDFC (initial -- FC Created By)"
    ws.Cells(r, 2).Value = edInit
    r = r + 1
    ws.Cells(r, 1).Value = "CCF closed by EDFC (Latest CCF Creation User)"
    ws.Cells(r, 2).Value = edFull
    r = r + 1
    ws.Cells(r, 1).Value = "CCF closed by Inflight"
    ws.Cells(r, 2).Value = inflFull
    r = r + 1
    ws.Cells(r, 1).Value = "CCF closed by NCID AO"
    ws.Cells(r, 2).Value = ncidFull
    r = r + 3
End Sub

Private Sub WriteSummarySheet(ws As Worksheet, reportLabel As String, _
        emEnc As Long, elEnc As Long, missedEM As Long, missedEL As Long, _
        emGreen As Long, emLG As Long, emOrg As Long, emRed As Long, _
        elGreen As Long, elLG As Long, elOrg As Long, elRed As Long, _
        emTeams As Object, elTeams As Object, _
        emBlankCCF As Long, elBlankCCF As Long, _
        emEdInit As Long, emEdFull As Long, emInflFull As Long, emNcidFull As Long, _
        elEdInit As Long, elEdFull As Long, elInflFull As Long, elNcidFull As Long, _
        voidedTotal As Long, otherEncCount As Long, missedOther As Long)

    Dim r As Long
    r = 1

    ws.Cells(r, 1).Value = "FC Completion Report -- " & reportLabel
    ws.Cells(r, 1).Font.Bold = True
    ws.Cells(r, 1).Font.Size = 14
    r = r + 2

    ' ---- EM block ----
    WriteSummaryBlock ws, r, "EMERGENCY (EM) ADMISSIONS", _
        emEnc, missedEM, emGreen, emLG, emOrg, emRed, _
        emTeams, emBlankCCF, emEdInit, emEdFull, emInflFull, emNcidFull

    ' ---- EL block ----
    WriteSummaryBlock ws, r, "ELECTIVE INPATIENT (EL) ADMISSIONS", _
        elEnc, missedEL, elGreen, elLG, elOrg, elRed, _
        elTeams, elBlankCCF, elEdInit, elEdFull, elInflFull, elNcidFull

    ' ---- Combined block ----
    Dim combTeams As Object
    Set combTeams = CreateObject("Scripting.Dictionary")
    InitTeamCounts combTeams
    Dim tk As Variant
    For Each tk In emTeams.Keys
        combTeams(CStr(tk)) = emTeams(CStr(tk)) + elTeams(CStr(tk))
    Next tk

    WriteSummaryBlock ws, r, "COMBINED (EM + EL)", _
        emEnc + elEnc, missedEM + missedEL, _
        emGreen + elGreen, emLG + elLG, emOrg + elOrg, emRed + elRed, _
        combTeams, emBlankCCF + elBlankCCF, _
        emEdInit + elEdInit, emEdFull + elEdFull, _
        emInflFull + elInflFull, emNcidFull + elNcidFull

    ' ---- Footnotes ----
    ws.Cells(r, 1).Value = "FOOTNOTES"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1

    ws.Cells(r, 1).Value = "Voided/Deleted-only encounters excluded from denominator: " & voidedTotal
    r = r + 1

    If otherEncCount > 0 Or missedOther > 0 Then
        ws.Cells(r, 1).Value = "Encounters with unrecognised Admission Type (not EM or EL): " & _
            otherEncCount & " from File A, " & missedOther & " from File B"
        r = r + 1
    End If

    ws.Columns("A:A").ColumnWidth = 52
    ws.Columns("B:B").ColumnWidth = 10
    ws.Columns("C:C").ColumnWidth = 10
End Sub

' ---- Methodology sheet ---------------------------------------------------

Private Sub WriteMethodologySheet(ws As Worksheet, reportLabel As String, _
        voidedTotal As Long)

    Dim r As Long
    r = 1

    ws.Cells(r, 1).Value = "Methodology -- FC Completion Report " & reportLabel
    ws.Cells(r, 1).Font.Bold = True
    ws.Cells(r, 1).Font.Size = 14
    r = r + 2

    ws.Cells(r, 1).Value = "1. INPUTS"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1
    ws.Cells(r, 1).Value = "File A: FC Summary Report (eFC export, full month, Emergency + Elective Inpatient)."
    r = r + 1
    ws.Cells(r, 1).Value = "File B: Inflight Missed FC Report (eFC export, Missed FC indicator ticked)."
    r = r + 2

    ws.Cells(r, 1).Value = "2. FILE A CLEANING"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1
    ws.Cells(r, 1).Value = "a) Keep only FC Mode = 'Financial Counselling - AH' or 'Financial Counselling - Downtime'."
    r = r + 1
    ws.Cells(r, 1).Value = "b) Remove Admission Status = 'Cancelled'."
    r = r + 1
    ws.Cells(r, 1).Value = "c) Rank each FC ID by status priority (1 = Completed, 2 = Acknowledgement, ..., 9 = Draft, 99 = Voided/Deleted)."
    r = r + 1
    ws.Cells(r, 1).Value = "d) For encounters with multiple FC IDs: set aside Inflight-created FCs (unless all are Inflight),"
    r = r + 1
    ws.Cells(r, 1).Value = "   then keep the row with the best (lowest) priority. Tie-break: larger (newer) FC ID wins."
    r = r + 1
    ws.Cells(r, 1).Value = "e) Encounters where the only FC ID was Voided/Deleted are excluded from the denominator entirely."
    r = r + 1
    ws.Cells(r, 1).Value = "   This month: " & voidedTotal & " encounter(s) excluded."
    r = r + 2

    ws.Cells(r, 1).Value = "3. FILE B CLEANING"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1
    ws.Cells(r, 1).Value = "a) Keep only Missed FC = 'Yes'."
    r = r + 1
    ws.Cells(r, 1).Value = "b) Remove Admission Status = 'Cancelled' or 'Planned'."
    r = r + 1
    ws.Cells(r, 1).Value = "c) EDVW discharges (Point Of Care = 'TTSH Virtual Ward', Accommodation Code = 'EDVW') are flagged but still counted."
    r = r + 2

    ws.Cells(r, 1).Value = "4. EM/EL SPLIT"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1
    ws.Cells(r, 1).Value = "Rows are split into Emergency (EM) and Elective Inpatient (EL) based on Admission Type only."
    r = r + 1
    ws.Cells(r, 1).Value = "A 'Looks Wrong' flag marks EM rows closed by NCID AO or EL rows closed by ED/EDFC or Inflight."
    r = r + 2

    ws.Cells(r, 1).Value = "5. DENOMINATOR"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1
    ws.Cells(r, 1).Value = "Denominator = (unique encounters from File A, excluding Voided/Deleted-only) + (missed FC count from File B)."
    r = r + 2

    ws.Cells(r, 1).Value = "6. COMPLETION STATUS GROUPS"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1
    ws.Cells(r, 1).Value = "Green (priority 1-2): Completed / Acknowledgement by other means."
    r = r + 1
    ws.Cells(r, 1).Value = "Light Green (priority 3): Attempted - Virtual FC Completed, pending signature."
    r = r + 1
    ws.Cells(r, 1).Value = "Orange (priority 4-5): Attempted - patient/NOK declines to sign / Patient is unable to sign."
    r = r + 1
    ws.Cells(r, 1).Value = "Red (priority 6-9 + File B missed): Attempted - unable to complete / Draft / Missed FC."
    r = r + 2

    ws.Cells(r, 1).Value = "7. WHO CLOSED THE CCF"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1
    ws.Cells(r, 1).Value = "Team is determined by 'Latest CCF Creation User' via the Config roster."
    r = r + 1
    ws.Cells(r, 1).Value = "If 'Latest CCF Creation User' is blank (pure Draft, no CCF generated), falls back to 'FC Created By'."
    r = r + 1
    ws.Cells(r, 1).Value = "These fallback rows are highlighted yellow on the EM/EL data sheets."
    r = r + 1
    ws.Cells(r, 1).Value = "File B missed FC rows are counted under 'CCF not generated'."
    r = r + 2

    ws.Cells(r, 1).Value = "8. CONSERVATIVE PRINCIPLE"
    ws.Cells(r, 1).Font.Bold = True
    r = r + 1
    ws.Cells(r, 1).Value = "When a case is ambiguous or borderline, it is counted as NOT completed / missed."
    r = r + 1
    ws.Cells(r, 1).Value = "Unrecognised FC Status values are treated as priority 99 (same as Voided/Deleted)."

    ws.Columns("A:A").ColumnWidth = 100
End Sub

' ---- Staff Roster Check sheet --------------------------------------------

Private Sub BuildStaffRosterCheckSheet(ws As Worksheet, fileAws As Worksheet, _
        roster As Object)

    If roster.Count = 0 Then
        ws.Cells(1, 1).Value = "Config roster is empty -- run CreateConfigSheet " & _
            "(Alt+F8) and add staff names/teams before this check is meaningful."
        ws.Columns("A:A").ColumnWidth = 80
        Exit Sub
    End If

    Dim encCol As Long
    encCol = FindEncounterCol(fileAws)
    If encCol = 0 Then
        ws.Cells(1, 1).Value = "Cannot build roster check: Encounter column not found."
        Exit Sub
    End If

    Dim lastRow As Long
    lastRow = fileAws.Cells(fileAws.Rows.Count, encCol).End(xlUp).Row

    Dim createdByCol As Long, latestCCFCol As Long
    createdByCol = FindColByHeader(fileAws, "FC Created By")
    latestCCFCol = FindColByHeader(fileAws, "Latest CCF Creation User")

    Dim nameSet As Object
    Set nameSet = CreateObject("Scripting.Dictionary")
    nameSet.CompareMode = vbTextCompare

    If lastRow >= 2 Then
        Dim i As Long, nm As String
        If createdByCol > 0 Then
            Dim cbData As Variant
            cbData = fileAws.Range(fileAws.Cells(2, createdByCol), fileAws.Cells(lastRow, createdByCol)).Value
            For i = 1 To lastRow - 1
                If lastRow = 2 Then nm = CellStr(cbData) Else nm = CellStr(cbData(i, 1))
                If nm <> "" Then nameSet(nm) = True
            Next i
        End If
        If latestCCFCol > 0 Then
            Dim lcData As Variant
            lcData = fileAws.Range(fileAws.Cells(2, latestCCFCol), fileAws.Cells(lastRow, latestCCFCol)).Value
            For i = 1 To lastRow - 1
                If lastRow = 2 Then nm = CellStr(lcData) Else nm = CellStr(lcData(i, 1))
                If nm <> "" Then nameSet(nm) = True
            Next i
        End If
    End If

    Dim teamOrder As Variant
    teamOrder = Array(TEAM_ED_EDFC, TEAM_INFLIGHT, TEAM_NCID_AO, TEAM_ICH_PSO, TEAM_ADMIN)

    Dim r As Long
    r = 1
    Dim t As Long
    For t = LBound(teamOrder) To UBound(teamOrder)
        Dim teamName As String
        teamName = CStr(teamOrder(t))

        ws.Cells(r, 1).Value = teamName
        ws.Cells(r, 1).Font.Bold = True
        ws.Cells(r, 1).Font.Size = 11
        r = r + 1

        ws.Cells(r, 1).Value = "Staff Name"
        ws.Cells(r, 2).Value = "Matched"
        ws.Cells(r, 1).Font.Bold = True
        ws.Cells(r, 2).Font.Bold = True
        r = r + 1

        Dim k As Variant
        For Each k In roster.Keys
            If CStr(roster(k)) = teamName Then
                ws.Cells(r, 1).Value = CStr(k)
                If nameSet.Exists(CStr(k)) Then
                    ws.Cells(r, 2).Value = "Matched"
                Else
                    ws.Cells(r, 2).Value = "Not Matched"
                    ws.Range(ws.Cells(r, 1), ws.Cells(r, 2)).Interior.Color = RGB(255, 0, 0)
                    ws.Range(ws.Cells(r, 1), ws.Cells(r, 2)).Font.Color = RGB(255, 255, 255)
                End If
                r = r + 1
            End If
        Next k

        r = r + 1
    Next t

    ws.Columns("A:B").AutoFit
End Sub

' ---- Main orchestrator ---------------------------------------------------

Public Function BuildOutputWorkbook(fileAws As Worksheet, fileBws As Worksheet, _
        roster As Object, voidedOnlyCount As Long) As Boolean

    On Error GoTo ErrHandler
    BuildOutputWorkbook = True

    ' ---- Validate required File A columns ----
    Dim encCol As Long, admTypeCol As Long, fcStatusCol As Long
    Dim createdByCol As Long, latestCCFCol As Long, priCol As Long
    encCol = FindEncounterCol(fileAws)
    admTypeCol = FindColByHeader(fileAws, "Admission Type")
    fcStatusCol = FindColByHeader(fileAws, "FC Status")
    createdByCol = FindColByHeader(fileAws, "FC Created By")
    latestCCFCol = FindColByHeader(fileAws, "Latest CCF Creation User")
    priCol = FindColByHeader(fileAws, "PRIORITISE")

    If encCol = 0 Or admTypeCol = 0 Or fcStatusCol = 0 Then
        MsgBox "Error: File A is missing a required column (Encounter Number, " & _
               "Admission Type, or FC Status).", vbExclamation, "Missing Column"
        BuildOutputWorkbook = False
        Exit Function
    End If

    ' ---- Read File A data ----
    Dim aLastRow As Long, aLastCol As Long
    aLastRow = fileAws.Cells(fileAws.Rows.Count, encCol).End(xlUp).Row
    aLastCol = fileAws.Cells(1, fileAws.Columns.Count).End(xlToLeft).Column

    Dim aData As Variant
    aData = fileAws.Range(fileAws.Cells(1, 1), fileAws.Cells(aLastRow, aLastCol)).Value

    ' ---- Build expanded array with extra columns ----
    Dim outCols As Long
    outCols = aLastCol + 3
    Dim ccfCloserCol As Long, ccfTeamCol As Long, looksWrongCol As Long
    ccfCloserCol = aLastCol + 1
    ccfTeamCol = aLastCol + 2
    looksWrongCol = aLastCol + 3

    Dim fullData() As Variant
    ReDim fullData(1 To aLastRow, 1 To outCols)

    Dim i As Long, j As Long
    For i = 1 To aLastRow
        For j = 1 To aLastCol
            fullData(i, j) = aData(i, j)
        Next j
    Next i

    fullData(1, ccfCloserCol) = "CCF Closed By"
    fullData(1, ccfTeamCol) = "CCF Closer Team"
    fullData(1, looksWrongCol) = "Looks Wrong"

    ' ---- Compute extra columns + stats in one pass ----
    Dim greenCt(1 To 2) As Long, lgCt(1 To 2) As Long
    Dim orgCt(1 To 2) As Long, redCt(1 To 2) As Long
    Dim encCt(1 To 2) As Long, voidCt(1 To 2) As Long
    Dim blankCCF(1 To 2) As Long
    Dim edInit(1 To 2) As Long, edFull(1 To 2) As Long
    Dim inflFull(1 To 2) As Long, ncidFull(1 To 2) As Long
    Dim otherEncCount As Long

    Dim emTeams As Object, elTeams As Object
    Set emTeams = CreateObject("Scripting.Dictionary")
    Set elTeams = CreateObject("Scripting.Dictionary")
    InitTeamCounts emTeams
    InitTeamCounts elTeams

    For i = 2 To aLastRow
        ' Resolve CCF closer
        Dim latestCCF As String
        latestCCF = ""
        If latestCCFCol > 0 Then latestCCF = CellStr(fullData(i, latestCCFCol))

        Dim createdBy As String
        createdBy = ""
        If createdByCol > 0 Then createdBy = CellStr(fullData(i, createdByCol))

        Dim ccfCloser As String
        Dim usedFallback As Boolean
        usedFallback = False
        If latestCCF <> "" Then
            ccfCloser = latestCCF
        ElseIf createdBy <> "" Then
            ccfCloser = createdBy
            usedFallback = True
        Else
            ccfCloser = ""
            usedFallback = True
        End If

        Dim team As String
        team = GetStaffTeam(roster, ccfCloser)

        fullData(i, ccfCloserCol) = ccfCloser
        fullData(i, ccfTeamCol) = team

        ' Determine section: 1=EM, 2=EL, 0=Other
        Dim admType As String
        admType = UCase(CellStr(fullData(i, admTypeCol)))

        Dim sec As Long
        If admType = UCase(ADM_EMERGENCY) Then
            sec = 1
        ElseIf admType = UCase(ADM_ELECTIVE) Then
            sec = 2
        Else
            sec = 0
            otherEncCount = otherEncCount + 1
        End If

        ' Looks Wrong flag
        If sec = 1 And team = TEAM_NCID_AO Then
            fullData(i, looksWrongCol) = "Check"
        ElseIf sec = 2 And (team = TEAM_ED_EDFC Or team = TEAM_INFLIGHT) Then
            fullData(i, looksWrongCol) = "Check"
        End If

        ' Stats (EM and EL only)
        If sec > 0 Then
            Dim pri As Long
            If priCol > 0 Then
                If IsNumeric(fullData(i, priCol)) Then
                    pri = CLng(fullData(i, priCol))
                Else
                    pri = GetFCStatusPriority(CStr(fullData(i, fcStatusCol)))
                End If
            Else
                pri = GetFCStatusPriority(CStr(fullData(i, fcStatusCol)))
            End If

            If pri = 99 Then
                voidCt(sec) = voidCt(sec) + 1
            Else
                encCt(sec) = encCt(sec) + 1

                If pri <= 2 Then
                    greenCt(sec) = greenCt(sec) + 1
                ElseIf pri = 3 Then
                    lgCt(sec) = lgCt(sec) + 1
                ElseIf pri <= 5 Then
                    orgCt(sec) = orgCt(sec) + 1
                Else
                    redCt(sec) = redCt(sec) + 1
                End If

                Dim teamDict As Object
                If sec = 1 Then Set teamDict = emTeams Else Set teamDict = elTeams
                teamDict(team) = teamDict(team) + 1

                If usedFallback Then blankCCF(sec) = blankCCF(sec) + 1

                ' Numerator detail
                Dim cbTeam As String, lcTeam As String
                cbTeam = GetStaffTeam(roster, createdBy)
                lcTeam = GetStaffTeam(roster, latestCCF)
                If cbTeam = TEAM_ED_EDFC Then edInit(sec) = edInit(sec) + 1
                If lcTeam = TEAM_ED_EDFC Then edFull(sec) = edFull(sec) + 1
                If lcTeam = TEAM_INFLIGHT Then inflFull(sec) = inflFull(sec) + 1
                If lcTeam = TEAM_NCID_AO Then ncidFull(sec) = ncidFull(sec) + 1
            End If
        End If
    Next i

    ' ---- Read File B and count missed by Admission Type ----
    Dim missedEM As Long, missedEL As Long, missedOther As Long
    Dim bEncCol As Long
    bEncCol = FindEncounterCol(fileBws)
    If bEncCol > 0 Then
        Dim bLastRow As Long
        bLastRow = fileBws.Cells(fileBws.Rows.Count, bEncCol).End(xlUp).Row

        If bLastRow >= 2 Then
            Dim bAdmTypeCol As Long
            bAdmTypeCol = FindColByHeader(fileBws, "Admission Type")

            If bAdmTypeCol > 0 Then
                Dim bAdmData As Variant
                bAdmData = fileBws.Range(fileBws.Cells(2, bAdmTypeCol), _
                    fileBws.Cells(bLastRow, bAdmTypeCol)).Value

                Dim bi As Long
                For bi = 1 To bLastRow - 1
                    Dim bAdmVal As String
                    If bLastRow = 2 Then
                        bAdmVal = UCase(CellStr(bAdmData))
                    Else
                        bAdmVal = UCase(CellStr(bAdmData(bi, 1)))
                    End If

                    If bAdmVal = UCase(ADM_EMERGENCY) Then
                        missedEM = missedEM + 1
                    ElseIf bAdmVal = UCase(ADM_ELECTIVE) Then
                        missedEL = missedEL + 1
                    Else
                        missedOther = missedOther + 1
                    End If
                Next bi
            Else
                missedEM = bLastRow - 1
            End If
        End If
    End If

    ' ---- Get report period label ----
    Dim reportLabel As String
    reportLabel = GetReportPeriodLabel(fileAws)
    If reportLabel = "" Then reportLabel = "Unknown Period"

    Dim voidedTotal As Long
    voidedTotal = voidCt(1) + voidCt(2)

    ' ---- Create output workbook ----
    Application.ScreenUpdating = False

    Dim outWb As Workbook
    Set outWb = Workbooks.Add(xlWBATWorksheet)

    ' EM sheet
    Dim wsEM As Worksheet
    Set wsEM = outWb.Sheets(1)
    wsEM.Name = SHEET_EM
    WriteFilteredFileASheet wsEM, fullData, aLastRow, outCols, admTypeCol, ADM_EMERGENCY
    HighlightCCFFallbackRows wsEM

    ' EL sheet
    Dim wsEL As Worksheet
    Set wsEL = AddSheet(outWb, SHEET_EL)
    WriteFilteredFileASheet wsEL, fullData, aLastRow, outCols, admTypeCol, ADM_ELECTIVE
    HighlightCCFFallbackRows wsEL

    ' Missed FC sheet
    Dim wsMissed As Worksheet
    Set wsMissed = AddSheet(outWb, SHEET_MISSED_FC)
    WriteMissedFCSheet wsMissed, fileBws

    ' Summary sheet
    Dim wsSummary As Worksheet
    Set wsSummary = AddSheet(outWb, SHEET_SUMMARY)
    WriteSummarySheet wsSummary, reportLabel, _
        encCt(1), encCt(2), missedEM, missedEL, _
        greenCt(1), lgCt(1), orgCt(1), redCt(1), _
        greenCt(2), lgCt(2), orgCt(2), redCt(2), _
        emTeams, elTeams, blankCCF(1), blankCCF(2), _
        edInit(1), edFull(1), inflFull(1), ncidFull(1), _
        edInit(2), edFull(2), inflFull(2), ncidFull(2), _
        voidedTotal, otherEncCount, missedOther

    ' Methodology sheet
    Dim wsMethod As Worksheet
    Set wsMethod = AddSheet(outWb, SHEET_METHODOLOGY)
    WriteMethodologySheet wsMethod, reportLabel, voidedTotal

    ' Staff Roster Check sheet
    Dim wsRoster As Worksheet
    Set wsRoster = AddSheet(outWb, SHEET_STAFF_ROSTER_CHECK)
    BuildStaffRosterCheckSheet wsRoster, fileAws, roster

    ' Activate Summary sheet
    wsSummary.Activate

    Application.ScreenUpdating = True

    ' ---- Save via dialog ----
    Dim defaultName As String
    defaultName = "FCReportSummary_" & reportLabel & ".xlsx"

    Dim fd As FileDialog
    Set fd = Application.FileDialog(msoFileDialogSaveAs)
    fd.title = "Save FC Completion Report"
    fd.InitialFileName = defaultName

    If fd.Show = -1 Then
        Dim savePath As String
        savePath = fd.SelectedItems(1)
        Application.DisplayAlerts = False
        outWb.SaveAs savePath, xlOpenXMLWorkbook
        Application.DisplayAlerts = True
        Application.StatusBar = "Report saved: " & savePath
    Else
        MsgBox "Report was NOT saved. The output workbook is still open -- " & _
               "use File > Save As to save it manually.", vbExclamation, "Not Saved"
    End If

    Exit Function

ErrHandler:
    Application.ScreenUpdating = True
    Application.Calculation = xlCalculationAutomatic
    MsgBox "Unexpected error building output workbook:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"
    BuildOutputWorkbook = False
End Function
