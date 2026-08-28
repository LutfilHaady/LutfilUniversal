Attribute VB_Name = "DeduplicateEncounters"
Option Explicit

' ============================================================
' DeduplicateEncounters.bas
'
' Implements Section 2 (steps 3-8) of
' docs/FC_Completion_Report_Process_Flow_for_Review.md for File A
' (FC Summary Report), after FilterFileA's mode/cancellation cleaning:
'
'   GetFCStatusPriority   -- Step 3: priority order table (1 = best)
'   AddPriorityColumn     -- writes a "PRIORITISE" column using the table above
'   MarkDuplicateEncounters -- Step 5 (visual aid): highlight duplicate
'                              Encounter Numbers in red. Call this BEFORE
'                              ResolveDuplicateEncounters if you want a
'                              before-snapshot, since resolution deletes the
'                              losing rows.
'   ResolveDuplicateEncounters -- Steps 6-8: for each Encounter Number with
'                              more than one row, automatically picks the row
'                              to keep and deletes the rest. Also counts
'                              encounters whose only row is Voided/Deleted
'                              (priority 99) for the "please double-check"
'                              report -- these single rows are NOT deleted.
'
' Q2-Q4 from the process flow doc are confirmed (2026-06-18). The Inflight
' exception (Q3) is driven by the Config "Staff Name -> Team" roster
' (Helpers.LoadStaffRoster) -- with an empty/unfilled roster everyone is
' "Others", so the exception simply never fires and the algorithm reduces to
' "lowest priority wins, tie-break by largest FC ID". Only the roster DATA
' needs to be filled in (CLAUDE.md blanks #3-#5).
' ============================================================

' ---- Step 3: FC Status priority order -----------------------------------------
'
' Lower number = better outcome = row to keep when an encounter has duplicates.
' Priority 99 covers anything not explicitly listed, including Voided/Deleted.
Public Function GetFCStatusPriority(fcStatus As String) As Long
    Select Case UCase(Trim(fcStatus))
        Case "COMPLETED"
            GetFCStatusPriority = 1
        Case "ACKNOWLEDGEMENT BY OTHER MEANS"
            GetFCStatusPriority = 2
        Case "ATTEMPTED - VIRTUAL FC COMPLETED, PENDING SIGNATURE"
            GetFCStatusPriority = 3
        Case "ATTEMPTED - PATIENT/NOK DECLINES TO SIGN"
            GetFCStatusPriority = 4
        Case "ATTEMPTED - PATIENT IS UNABLE TO SIGN"
            GetFCStatusPriority = 5
        Case "ATTEMPTED - UNABLE TO COMPLETE"
            GetFCStatusPriority = 6
        Case "DRAFT (CCF GENERATED)"
            GetFCStatusPriority = 7
        Case "DRAFT (ETBS GENERATED)"
            GetFCStatusPriority = 8
        Case "DRAFT"
            GetFCStatusPriority = 9
        Case Else
            GetFCStatusPriority = 99   ' includes Voided / Deleted / unrecognised statuses
    End Select
End Function

' Adds a "PRIORITISE" column as the last column, populated via
' GetFCStatusPriority for every data row. Lets staff see at a glance why the
' tool kept or dropped a given row.
Public Sub AddPriorityColumn(ws As Worksheet)

    Dim fcStatusCol As Long
    fcStatusCol = FindColByHeader(ws, "FC Status")
    If fcStatusCol = 0 Then Exit Sub

    Dim encCol As Long
    encCol = FindEncounterCol(ws)

    Dim lastRow As Long, lastCol As Long
    If encCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, fcStatusCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Sub
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Dim priCol As Long
    priCol = lastCol + 1
    ws.Cells(1, priCol).Value = "PRIORITISE"

    Application.ScreenUpdating = False

    Dim statusData As Variant
    statusData = ws.Range(ws.Cells(2, fcStatusCol), ws.Cells(lastRow, fcStatusCol)).Value

    Dim priData() As Variant
    ReDim priData(1 To lastRow - 1, 1 To 1)

    Dim i As Long
    For i = 1 To lastRow - 1
        If lastRow = 2 Then
            priData(i, 1) = GetFCStatusPriority(CStr(statusData))
        Else
            priData(i, 1) = GetFCStatusPriority(CStr(statusData(i, 1)))
        End If
    Next i

    ws.Range(ws.Cells(2, priCol), ws.Cells(lastRow, priCol)).Value = priData

    Application.ScreenUpdating = True

End Sub

' ---- Step 5: highlight duplicate Encounter Numbers (visual aid) -----------------------------------------
'
' Applies red fill + white font to every row whose Encounter Number appears
' more than once. Purely cosmetic -- does not change row order or count.
Public Sub MarkDuplicateEncounters(ws As Worksheet)

    Dim encCol As Long
    encCol = FindEncounterCol(ws)
    If encCol = 0 Then Exit Sub

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 3 Then Exit Sub   ' need at least 2 data rows for a duplicate

    Application.ScreenUpdating = False

    Dim encData As Variant
    encData = ws.Range(ws.Cells(2, encCol), ws.Cells(lastRow, encCol)).Value

    Dim counts As Object
    Set counts = CreateObject("Scripting.Dictionary")
    counts.CompareMode = vbTextCompare

    Dim i As Long
    Dim key As String
    For i = 1 To UBound(encData, 1)
        key = Trim(CStr(encData(i, 1)))
        If counts.Exists(key) Then
            counts(key) = counts(key) + 1
        Else
            counts(key) = 1
        End If
    Next i

    Dim dupRange As Range
    For i = 1 To UBound(encData, 1)
        key = Trim(CStr(encData(i, 1)))
        If counts(key) > 1 Then
            If dupRange Is Nothing Then
                Set dupRange = ws.Rows(i + 1)
            Else
                Set dupRange = Union(dupRange, ws.Rows(i + 1))
            End If
        End If
    Next i

    If Not dupRange Is Nothing Then
        dupRange.Interior.Color = RGB(255, 0, 0)
        dupRange.Font.Color = RGB(255, 255, 255)
    End If

    Application.ScreenUpdating = True

End Sub

' ---- Steps 6-8: automatic duplicate resolution -----------------------------------------
'
' For each Encounter Number with more than one row:
'   1. If an Inflight-created row exists (per the Config roster) AND removing
'      it/them would NOT empty the group, those rows are set aside first
'      (Inflight rows are always deleted in this case, regardless of status).
'   2. Among the remaining candidates, the row with the lowest
'      GetFCStatusPriority wins.
'   3. Ties are broken by the larger FC ID (assumed to be the more recently
'      created one -- confirm FC ID format once a real export is available).
'   4. The winner is kept; every other row for that encounter is deleted.
'
' For each Encounter Number with exactly one row, that row is always kept --
' even if its priority is 99 (Voided/Deleted) -- but it is counted in
' voidedOnlyCount so MainMacro/BuildOutput can report it separately and
' exclude it from the denominator (per Q4).
'
' roster: Dictionary from Helpers.LoadStaffRoster (Staff Name -> Team).
'
' Returns False (and shows a MsgBox) if a required column is missing.
' On success, voidedOnlyCount, duplicateGroupsResolved and rowsRemoved are
' filled in for the final summary dialog.
Public Function ResolveDuplicateEncounters(ws As Worksheet, roster As Object, _
        ByRef voidedOnlyCount As Long, ByRef duplicateGroupsResolved As Long, _
        ByRef rowsRemoved As Long) As Boolean

    On Error GoTo ErrHandler

    voidedOnlyCount = 0
    duplicateGroupsResolved = 0
    rowsRemoved = 0

    Dim encCol As Long, fcIdCol As Long, fcStatusCol As Long, createdByCol As Long
    encCol = FindEncounterCol(ws)
    fcIdCol = FindColByHeader(ws, "FC ID")
    fcStatusCol = FindColByHeader(ws, "FC Status")
    createdByCol = FindColByHeader(ws, "FC Created By")

    If encCol = 0 Or fcIdCol = 0 Or fcStatusCol = 0 Then
        MsgBox "Error: File A is missing one of 'Encounter Number', 'FC ID', or 'FC Status'." & vbNewLine & _
               "Check the FC Summary Report export.", vbExclamation, "Missing Column"
        ResolveDuplicateEncounters = False
        Exit Function
    End If
    ResolveDuplicateEncounters = True

    Dim lastRow As Long, lastCol As Long
    lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    If lastRow < 2 Then Exit Function
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    ' --- Group data row indices (2..lastRow) by Encounter Number ---
    Dim groups As Object
    Set groups = CreateObject("Scripting.Dictionary")
    groups.CompareMode = vbTextCompare

    Dim i As Long
    Dim encVal As String
    For i = 2 To lastRow
        encVal = Trim(CStr(allData(i, encCol)))
        If Not groups.Exists(encVal) Then groups.Add encVal, New Collection
        groups(encVal).Add i
    Next i

    ' --- Decide which rows to keep ---
    Dim keepFlag() As Boolean
    ReDim keepFlag(1 To lastRow)
    keepFlag(1) = True   ' header row

    Dim k As Variant
    For Each k In groups.Keys
        Dim grp As Collection
        Set grp = groups(k)

        If grp.Count = 1 Then
            Dim soloIdx As Long
            soloIdx = grp(1)
            keepFlag(soloIdx) = True
            If GetFCStatusPriority(CStr(allData(soloIdx, fcStatusCol))) = 99 Then
                voidedOnlyCount = voidedOnlyCount + 1
            End If
        Else
            Dim n As Long
            n = grp.Count

            Dim candidates() As Long
            ReDim candidates(1 To n)
            Dim idx As Long
            For idx = 1 To n
                candidates(idx) = grp(idx)
            Next idx

            ' Inflight exception (Q3): set aside Inflight-created rows unless
            ' that would remove every row in the group.
            Dim isInflight() As Boolean
            ReDim isInflight(1 To n)
            Dim inflightCount As Long
            inflightCount = 0
            For idx = 1 To n
                Dim createdBy As String
                createdBy = ""
                If createdByCol > 0 Then createdBy = CStr(allData(candidates(idx), createdByCol))
                If GetStaffTeam(roster, createdBy) = TEAM_INFLIGHT Then
                    isInflight(idx) = True
                    inflightCount = inflightCount + 1
                End If
            Next idx

            Dim useInflightException As Boolean
            useInflightException = (inflightCount > 0 And inflightCount < n)

            ' Find the winner: lowest priority among eligible candidates,
            ' tie-broken by the larger FC ID.
            Dim winnerIdx As Long, winnerPriority As Long
            Dim winnerFCID As Variant
            winnerIdx = 0
            For idx = 1 To n
                If Not (useInflightException And isInflight(idx)) Then
                    Dim rowI As Long, pr As Long
                    rowI = candidates(idx)
                    pr = GetFCStatusPriority(CStr(allData(rowI, fcStatusCol)))
                    If winnerIdx = 0 Then
                        winnerIdx = rowI
                        winnerPriority = pr
                        winnerFCID = allData(rowI, fcIdCol)
                    ElseIf pr < winnerPriority Then
                        winnerIdx = rowI
                        winnerPriority = pr
                        winnerFCID = allData(rowI, fcIdCol)
                    ElseIf pr = winnerPriority Then
                        If CompareFCID(allData(rowI, fcIdCol), winnerFCID) > 0 Then
                            winnerIdx = rowI
                            winnerFCID = allData(rowI, fcIdCol)
                        End If
                    End If
                End If
            Next idx

            For idx = 1 To n
                keepFlag(candidates(idx)) = (candidates(idx) = winnerIdx)
            Next idx

            duplicateGroupsResolved = duplicateGroupsResolved + 1
            rowsRemoved = rowsRemoved + (n - 1)
        End If
    Next k

    ' --- Build the kept-rows array and write it back ---
    Dim keepCount As Long
    keepCount = 0
    For i = 1 To lastRow
        If keepFlag(i) Then keepCount = keepCount + 1
    Next i

    If keepCount < lastRow Then
        Dim outData() As Variant
        ReDim outData(1 To keepCount, 1 To lastCol)

        Dim outRow As Long, j As Long
        outRow = 0
        For i = 1 To lastRow
            If keepFlag(i) Then
                outRow = outRow + 1
                For j = 1 To lastCol
                    outData(outRow, j) = allData(i, j)
                Next j
            End If
        Next i

        ws.Range(ws.Cells(1, 1), ws.Cells(keepCount, lastCol)).Value = outData
        ws.Rows((keepCount + 1) & ":" & lastRow).Delete
    End If

    Application.StatusBar = "Duplicate resolution complete: " & duplicateGroupsResolved & _
        " encounter(s) had duplicates resolved (" & rowsRemoved & " row(s) removed); " & _
        voidedOnlyCount & " voided/deleted-only encounter(s) flagged for review."

    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Function

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during duplicate resolution:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"
    ResolveDuplicateEncounters = False

End Function

' Compares two FC ID values for the tie-break in ResolveDuplicateEncounters.
' Returns >0 if a is "later" (larger) than b, <0 if earlier, 0 if equal.
' Numeric FC IDs are compared numerically; anything else falls back to a
' text comparison (assumes same-length/zero-padded IDs sort correctly as
' strings -- confirm FC ID format once a real export is available).
Private Function CompareFCID(a As Variant, b As Variant) As Long
    Dim sa As String, sb As String
    sa = Trim(CStr(a))
    sb = Trim(CStr(b))

    If IsNumeric(sa) And IsNumeric(sb) Then
        If CDbl(sa) > CDbl(sb) Then
            CompareFCID = 1
        ElseIf CDbl(sa) < CDbl(sb) Then
            CompareFCID = -1
        Else
            CompareFCID = 0
        End If
    Else
        CompareFCID = StrComp(sa, sb, vbTextCompare)
    End If
End Function
