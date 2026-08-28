Attribute VB_Name = "FilterFileB"
Option Explicit

' ============================================================
' FilterFileB.bas
'
' File B = Inflight Missed FC Report (Missed FC indicator ticked).
' Per the process flow doc (docs/FC_Completion_Report_Process_Flow_for_Review.md):
'
'   Step 1 -- FilterFCModeIfPresent: optional FC Mode filter (CLAUDE.md notes
'                                     the Inflight FC Report may not have this
'                                     column at all -- no-op if absent)
'   Step 2 -- KeepOnlyMissedFC:       keep only rows where Missed FC = "Yes"
'   Step 3 -- DeleteCancelledOrPlanned: drop Admission Status = "Cancelled"/"Planned"
'   Step 4 -- FlagEDVWDischarges:     add an informational "EDVW Discharge" column
'                                     (does not remove rows -- everything left
'                                     after Step 3 counts toward Missed FC)
'
' Load-filter-write strategy: reads the sheet once into a Variant array,
' compacts matching rows in memory, writes back in one bulk operation.
' ============================================================

Private Const FC_MODE_AH       As String = "Financial Counselling - AH"
Private Const FC_MODE_DOWNTIME As String = "Financial Counselling - Downtime"

Private Const ADM_CANCELLED As String = "Cancelled"
Private Const ADM_PLANNED   As String = "Planned"

Private Const EDVW_POINT_OF_CARE   As String = "TTSH Virtual Ward"
Private Const EDVW_ACCOMMODATION   As String = "EDVW"

' Step 1 -- if File B has an "FC Mode" column, keep only Financial Counselling
' rows (same allowlist as File A). If the column doesn't exist, this is a no-op
' -- CLAUDE.md notes the Inflight FC Report may not include FC Mode at all.
Public Function FilterFCModeIfPresent(ws As Worksheet) As Boolean

    On Error GoTo ErrHandler

    Dim modeCol As Long
    modeCol = FindColByHeader(ws, "FC Mode")
    If modeCol = 0 Then
        FilterFCModeIfPresent = True
        Exit Function   ' no FC Mode column on this export -- nothing to filter
    End If

    Dim encCol As Long
    encCol = FindEncounterCol(ws)

    Dim lastRow As Long, lastCol As Long
    If encCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, modeCol).End(xlUp).Row
    End If
    If lastRow < 2 Then
        FilterFCModeIfPresent = True
        Exit Function
    End If
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    Dim keepCount As Long
    Dim i As Long
    Dim modeVal As String
    For i = 2 To lastRow
        modeVal = UCase(Trim(CStr(allData(i, modeCol))))
        If modeVal = UCase(FC_MODE_AH) Or modeVal = UCase(FC_MODE_DOWNTIME) Then
            keepCount = keepCount + 1
        End If
    Next i

    If keepCount = lastRow - 1 Then
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        FilterFCModeIfPresent = True
        Exit Function   ' nothing to remove
    End If

    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "No Financial Counselling rows found in File B after the FC Mode filter." & vbNewLine & _
               "Check the Inflight Missed FC Report export.", vbExclamation, "No Data"
        FilterFCModeIfPresent = False
        Exit Function
    End If

    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)

    Dim outRow As Long, j As Long
    For i = 2 To lastRow
        modeVal = UCase(Trim(CStr(allData(i, modeCol))))
        If modeVal = UCase(FC_MODE_AH) Or modeVal = UCase(FC_MODE_DOWNTIME) Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        End If
    Next i

    ws.Range(ws.Cells(2, 1), ws.Cells(1 + keepCount, lastCol)).Value = filtData

    Dim newLastRow As Long
    newLastRow = 1 + keepCount
    If newLastRow < lastRow Then
        ws.Rows((newLastRow + 1) & ":" & lastRow).Delete
    End If

    Application.StatusBar = "File B FC Mode filter complete: kept " & keepCount & " rows."
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    FilterFCModeIfPresent = True
    Exit Function

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during File B FC Mode filter:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"
    FilterFCModeIfPresent = False

End Function

' Step 2 -- keeps only rows where "Missed FC" = "Yes". The Inflight Missed FC
' Report should already be exported with this indicator ticked, but this is a
' defensive filter in case the export includes other rows too.
Public Function KeepOnlyMissedFC(ws As Worksheet) As Boolean

    On Error GoTo ErrHandler

    Dim missedCol As Long
    missedCol = FindColByHeader(ws, "Missed FC")
    If missedCol = 0 Then
        MsgBox "Error: File B is missing the 'Missed FC' column." & vbNewLine & _
               "Check the Inflight Missed FC Report export.", vbExclamation, "Missing Column"
        KeepOnlyMissedFC = False
        Exit Function
    End If
    KeepOnlyMissedFC = True

    Dim encCol As Long
    encCol = FindEncounterCol(ws)

    Dim lastRow As Long, lastCol As Long
    If encCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, missedCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Function
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    Dim keepCount As Long
    Dim i As Long
    For i = 2 To lastRow
        If UCase(Trim(CStr(allData(i, missedCol)))) = "YES" Then
            keepCount = keepCount + 1
        End If
    Next i

    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "No rows with Missed FC = 'Yes' found in File B." & vbNewLine & _
               "Re-export with the Missed FC indicator ticked, or use the manual " & _
               "eFC dashboard workaround export.", vbExclamation, "No Data"
        KeepOnlyMissedFC = False
        Exit Function
    End If

    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)

    Dim outRow As Long, j As Long
    For i = 2 To lastRow
        If UCase(Trim(CStr(allData(i, missedCol)))) = "YES" Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        End If
    Next i

    ws.Range(ws.Cells(2, 1), ws.Cells(1 + keepCount, lastCol)).Value = filtData

    Dim newLastRow As Long
    newLastRow = 1 + keepCount
    If newLastRow < lastRow Then
        ws.Rows((newLastRow + 1) & ":" & lastRow).Delete
    End If

    Application.StatusBar = "Missed FC filter complete: kept " & keepCount & " rows."
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Function

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during Missed FC filter:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"
    KeepOnlyMissedFC = False

End Function

' Step 3 -- deletes rows where Admission Status = "Cancelled" or "Planned".
' Cancelled = upstream cancellation; Planned = patient never actualised in ward.
Public Function DeleteCancelledOrPlanned(ws As Worksheet) As Boolean

    On Error GoTo ErrHandler

    Dim admStatCol As Long
    admStatCol = FindColByHeader(ws, "Admission Status")
    If admStatCol = 0 Then
        MsgBox "Error: File B is missing the 'Admission Status' column." & vbNewLine & _
               "Check the Inflight Missed FC Report export.", vbExclamation, "Missing Column"
        DeleteCancelledOrPlanned = False
        Exit Function
    End If
    DeleteCancelledOrPlanned = True

    Dim encCol As Long
    encCol = FindEncounterCol(ws)

    Dim lastRow As Long, lastCol As Long
    If encCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, admStatCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Function
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    Dim keepCount As Long
    Dim i As Long
    Dim admVal As String
    For i = 2 To lastRow
        admVal = UCase(Trim(CStr(allData(i, admStatCol))))
        If admVal <> UCase(ADM_CANCELLED) And admVal <> UCase(ADM_PLANNED) Then
            keepCount = keepCount + 1
        End If
    Next i

    If keepCount = lastRow - 1 Then
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        Application.StatusBar = "Cancelled/Planned filter complete: no matching rows found."
        Exit Function
    End If

    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "All rows in File B have Admission Status = 'Cancelled' or 'Planned'." & vbNewLine & _
               "Check the Inflight Missed FC Report export.", vbExclamation, "No Data"
        DeleteCancelledOrPlanned = False
        Exit Function
    End If

    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)

    Dim outRow As Long, j As Long
    For i = 2 To lastRow
        admVal = UCase(Trim(CStr(allData(i, admStatCol))))
        If admVal <> UCase(ADM_CANCELLED) And admVal <> UCase(ADM_PLANNED) Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        End If
    Next i

    ws.Range(ws.Cells(2, 1), ws.Cells(1 + keepCount, lastCol)).Value = filtData

    Dim newLastRow As Long
    newLastRow = 1 + keepCount
    If newLastRow < lastRow Then
        ws.Rows((newLastRow + 1) & ":" & lastRow).Delete
    End If

    Application.StatusBar = "Cancelled/Planned filter complete: removed " & (lastRow - 1 - keepCount) & " row(s)."
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Function

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during Cancelled/Planned filter:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"
    DeleteCancelledOrPlanned = False

End Function

' Step 4 -- adds an informational "EDVW Discharge" column flagging rows where
' Point Of Care = "TTSH Virtual Ward" and Accommodation Code = "EDVW". This is
' label-only: matching rows are NOT removed or excluded -- everything left
' after Step 3 still counts toward the Missed FC total. Staff use this column
' to see how many missed cases were EDVW short-stay discharges.
'
' If either source column is absent from this export, the column is not added
' at all (BuildOutput must handle "EDVW Discharge" being absent via
' FindColByHeader returning 0).
Public Sub FlagEDVWDischarges(ws As Worksheet)

    Dim pocCol As Long, accomCol As Long
    pocCol = FindColByHeader(ws, "Point Of Care")
    accomCol = FindColByHeader(ws, "Accommodation Code")

    If pocCol = 0 Or accomCol = 0 Then
        Application.StatusBar = "EDVW discharge flag skipped: 'Point Of Care' / 'Accommodation Code' " & _
            "column not found on this export."
        Exit Sub
    End If

    Dim encCol As Long
    encCol = FindEncounterCol(ws)

    Dim lastRow As Long, lastCol As Long
    If encCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, pocCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Sub
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Dim flagCol As Long
    flagCol = lastCol + 1
    ws.Cells(1, flagCol).Value = "EDVW Discharge"

    Application.ScreenUpdating = False

    Dim pocData As Variant, accomData As Variant
    pocData = ws.Range(ws.Cells(2, pocCol), ws.Cells(lastRow, pocCol)).Value
    accomData = ws.Range(ws.Cells(2, accomCol), ws.Cells(lastRow, accomCol)).Value

    Dim flagData() As Variant
    ReDim flagData(1 To lastRow - 1, 1 To 1)

    Dim i As Long
    Dim pocVal As String, accomVal As String
    For i = 1 To lastRow - 1
        If lastRow = 2 Then
            pocVal = UCase(Trim(CStr(pocData)))
            accomVal = UCase(Trim(CStr(accomData)))
        Else
            pocVal = UCase(Trim(CStr(pocData(i, 1))))
            accomVal = UCase(Trim(CStr(accomData(i, 1))))
        End If

        If pocVal = UCase(EDVW_POINT_OF_CARE) And accomVal = UCase(EDVW_ACCOMMODATION) Then
            flagData(i, 1) = "Yes"
        Else
            flagData(i, 1) = ""
        End If
    Next i

    ws.Range(ws.Cells(2, flagCol), ws.Cells(lastRow, flagCol)).Value = flagData

    Application.StatusBar = "EDVW discharge flag added."
    Application.ScreenUpdating = True

End Sub
