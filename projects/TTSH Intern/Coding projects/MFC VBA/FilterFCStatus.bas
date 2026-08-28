Attribute VB_Name = "FCStatusFilter"
Option Explicit

' ============================================================
' FilterFCStatus.bas
'
' FilterFCStatus -- keeps only rows that are Missed FC = "Yes", OR one of the
' three allowed Draft FC statuses with Admission Status Actualised/Planned.
' Runs BEFORE LookupEpicData so the Epic lookup only processes relevant rows.
'
' Load-filter-write strategy: reads the sheet once into a Variant array,
' compacts matching rows in memory, writes back in one bulk operation.
' ============================================================

Private Const FC_DRAFT      As String = "Draft"
Private Const FC_DRAFT_ETBS As String = "Draft (ETBS Generated)"
Private Const FC_DRAFT_CCF  As String = "Draft (CCF Generated)"

Private Const ADM_ACTUALISED As String = "Actualised"
Private Const ADM_PLANNED    As String = "Planned"

' Keeps rows where:
'   - Missed FC = "Yes" (always kept regardless of Admission Status), OR
'   - FC Status is one of the three Draft values AND Admission Status is "Actualised" or "Planned"
' Draft rows with Admission Status = "Discharged" are dropped -- the patient has left the ward.
' Missed FC rows are always kept so staff can follow up even after discharge.
' Runs BEFORE LookupEpicData so the Epic lookup only processes relevant rows.
Public Function FilterFCStatus(ws As Worksheet) As Boolean

    On Error GoTo ErrHandler

    Dim fcCol As Long
    fcCol = FindColByHeader(ws, "FC Status")
    If fcCol = 0 Then
        MsgBox "Error: EFC file is missing the 'FC Status' column." & vbNewLine & _
               "Check your EFC export.", vbExclamation, "Missing Column"
        FilterFCStatus = False
        Exit Function
    End If
    FilterFCStatus = True

    ' Missed FC column -- rows marked "Yes" pass through regardless of Admission Status.
    Dim missedFCCol As Long
    missedFCCol = FindColByHeader(ws, "Missed FC")

    ' Admission Status column -- Draft rows are only kept if Actualised or Planned.
    Dim admStatCol As Long
    admStatCol = FindColByHeader(ws, "Admission Status")

    ' Use Encounter No for lastRow -- it is filled in both the main EFC and the
    ' missed-FC file, unlike FC Status which is blank in missed-FC rows.
    Dim encNoCol As Long
    encNoCol = FindColByHeader(ws, "Encounter No")

    Dim lastRow As Long
    Dim lastCol As Long
    If encNoCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encNoCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, fcCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Function
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' --- Step 1: Load entire working sheet into memory (one read) ---
    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    ' --- Step 2: Count matching rows (needed to size the output array) ---
    Dim keepCount As Long
    Dim i As Long
    Dim fcVal As String
    Dim missedVal As String
    Dim admStatVal As String
    For i = 2 To lastRow
        fcVal      = UCase(Trim(CStr(allData(i, fcCol))))
        missedVal  = ""
        admStatVal = ""
        If missedFCCol > 0 Then missedVal  = UCase(Trim(CStr(allData(i, missedFCCol))))
        If admStatCol  > 0 Then admStatVal = UCase(Trim(CStr(allData(i, admStatCol))))
        If missedVal = "YES" Then
            keepCount = keepCount + 1
        ElseIf (fcVal = UCase(FC_DRAFT) Or fcVal = UCase(FC_DRAFT_ETBS) Or fcVal = UCase(FC_DRAFT_CCF)) _
               And (admStatVal = UCase(ADM_ACTUALISED) Or admStatVal = UCase(ADM_PLANNED)) Then
            keepCount = keepCount + 1
        End If
    Next i

    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "No active cases found. All rows were filtered out" & vbNewLine & _
               "-- check your EFC date range.", vbExclamation, "No Data"
        FilterFCStatus = False
        Exit Function
    End If

    ' --- Step 3: Build a compacted array of only the matching rows ---
    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)

    Dim outRow As Long
    Dim j As Long
    For i = 2 To lastRow
        fcVal      = UCase(Trim(CStr(allData(i, fcCol))))
        missedVal  = ""
        admStatVal = ""
        If missedFCCol > 0 Then missedVal  = UCase(Trim(CStr(allData(i, missedFCCol))))
        If admStatCol  > 0 Then admStatVal = UCase(Trim(CStr(allData(i, admStatCol))))
        If missedVal = "YES" Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        ElseIf (fcVal = UCase(FC_DRAFT) Or fcVal = UCase(FC_DRAFT_ETBS) Or fcVal = UCase(FC_DRAFT_CCF)) _
               And (admStatVal = UCase(ADM_ACTUALISED) Or admStatVal = UCase(ADM_PLANNED)) Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        End If
    Next i

    ' --- Step 4: Write filtered rows back starting at row 2 (one write) ---
    ws.Range(ws.Cells(2, 1), ws.Cells(1 + keepCount, lastCol)).Value = filtData

    ' --- Step 5: Delete the now-empty tail rows below the new last data row ---
    Dim newLastRow As Long
    newLastRow = 1 + keepCount
    If newLastRow < lastRow Then
        ws.Rows((newLastRow + 1) & ":" & lastRow).Delete
    End If

    Application.StatusBar = "FC Status / Admission Status filter complete: kept " & keepCount & " rows."
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Function

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during FC Status filter:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"
    FilterFCStatus = False

End Function
