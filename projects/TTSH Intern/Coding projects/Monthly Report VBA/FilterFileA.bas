Attribute VB_Name = "FilterFileA"
Option Explicit

' ============================================================
' FilterFileA.bas
'
' File A = FC Summary Report. This module covers the early cleaning
' steps that don't depend on the staff roster or any other file:
'
'   Step 1 -- FilterFCMode:     keep only Financial Counselling rows
'                                (drops Shopper mode and anything else)
'   Step 2 -- DeleteCancelledAdmissions: drop Admission Status = "Cancelled"
'
' Later steps (sort/highlight/dedup/EM-EL split) live in
' DeduplicateEncounters.bas and are orchestrated from MainMacro.
'
' Load-filter-write strategy: reads the sheet once into a Variant array,
' compacts matching rows in memory, writes back in one bulk operation.
' ============================================================

Private Const FC_MODE_AH       As String = "Financial Counselling - AH"
Private Const FC_MODE_DOWNTIME As String = "Financial Counselling - Downtime"

Private Const ADM_CANCELLED As String = "Cancelled"

' Step 1 -- keeps only rows where FC Mode is "Financial Counselling - AH" or
' "Financial Counselling - Downtime". Removes Shopper mode and any other
' non-FC mode rows.
Public Function FilterFCMode(ws As Worksheet) As Boolean

    On Error GoTo ErrHandler

    Dim modeCol As Long
    modeCol = FindColByHeader(ws, "FC Mode")
    If modeCol = 0 Then
        MsgBox "Error: File A is missing the 'FC Mode' column." & vbNewLine & _
               "Check the FC Summary Report export.", vbExclamation, "Missing Column"
        FilterFCMode = False
        Exit Function
    End If
    FilterFCMode = True

    Dim encCol As Long
    encCol = FindEncounterCol(ws)

    Dim lastRow As Long, lastCol As Long
    If encCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, modeCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Function
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' --- Step 1: Load entire working sheet into memory (one read) ---
    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    ' --- Step 2: Count rows with an allowed FC Mode ---
    Dim keepCount As Long
    Dim i As Long
    Dim modeVal As String
    For i = 2 To lastRow
        modeVal = UCase(Trim(CStr(allData(i, modeCol))))
        If modeVal = UCase(FC_MODE_AH) Or modeVal = UCase(FC_MODE_DOWNTIME) Then
            keepCount = keepCount + 1
        End If
    Next i

    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "No Financial Counselling rows found after the FC Mode filter." & vbNewLine & _
               "Check the FC Summary Report export.", vbExclamation, "No Data"
        FilterFCMode = False
        Exit Function
    End If

    ' --- Step 3: Build a compacted array of only the matching rows ---
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

    ' --- Step 4: Write filtered rows back starting at row 2 (one write) ---
    ws.Range(ws.Cells(2, 1), ws.Cells(1 + keepCount, lastCol)).Value = filtData

    ' --- Step 5: Delete the now-empty tail rows below the new last data row ---
    Dim newLastRow As Long
    newLastRow = 1 + keepCount
    If newLastRow < lastRow Then
        ws.Rows((newLastRow + 1) & ":" & lastRow).Delete
    End If

    Application.StatusBar = "FC Mode filter complete: kept " & keepCount & " rows."
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Function

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during FC Mode filter:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"
    FilterFCMode = False

End Function

' Step 2 -- deletes rows where Admission Status = "Cancelled".
Public Function DeleteCancelledAdmissions(ws As Worksheet) As Boolean

    On Error GoTo ErrHandler

    Dim admStatCol As Long
    admStatCol = FindColByHeader(ws, "Admission Status")
    If admStatCol = 0 Then
        MsgBox "Error: File A is missing the 'Admission Status' column." & vbNewLine & _
               "Check the FC Summary Report export.", vbExclamation, "Missing Column"
        DeleteCancelledAdmissions = False
        Exit Function
    End If
    DeleteCancelledAdmissions = True

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

    ' --- Step 1: Load entire working sheet into memory (one read) ---
    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    ' --- Step 2: Count rows whose Admission Status is NOT "Cancelled" ---
    Dim keepCount As Long
    Dim i As Long
    For i = 2 To lastRow
        If UCase(Trim(CStr(allData(i, admStatCol)))) <> UCase(ADM_CANCELLED) Then
            keepCount = keepCount + 1
        End If
    Next i

    If keepCount = lastRow - 1 Then
        ' Nothing to remove
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        Application.StatusBar = "Cancelled-admission filter complete: no Cancelled rows found."
        Exit Function
    End If

    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "All rows have Admission Status = 'Cancelled'." & vbNewLine & _
               "Check the FC Summary Report export.", vbExclamation, "No Data"
        DeleteCancelledAdmissions = False
        Exit Function
    End If

    ' --- Step 3: Build a compacted array of only the non-Cancelled rows ---
    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)

    Dim outRow As Long, j As Long
    For i = 2 To lastRow
        If UCase(Trim(CStr(allData(i, admStatCol)))) <> UCase(ADM_CANCELLED) Then
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

    Application.StatusBar = "Cancelled-admission filter complete: removed " & (lastRow - 1 - keepCount) & " row(s)."
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Function

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during Cancelled-admission filter:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"
    DeleteCancelledAdmissions = False

End Function
