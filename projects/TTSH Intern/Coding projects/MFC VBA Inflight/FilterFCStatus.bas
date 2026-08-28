Attribute VB_Name = "FilterFCStatus"
Option Explicit

' ============================================================
' FilterFCStatus.bas
'
' FilterFCStatus -- keeps only rows that are Missed FC = "Yes", OR one of the
' three allowed Draft FC statuses. Runs BEFORE LookupEpicData so the Epic
' lookup only processes relevant rows.
'
' Unlike NCID, Inflight does NOT check Admission Status here. Discharge
' filtering is handled separately in FilterDischarge.bas after Epic lookup.
'
' Load-filter-write strategy: reads the sheet once into a Variant array,
' compacts matching rows in memory, writes back in one bulk operation.
' ============================================================


' Keeps rows where:
'   - Missed FC = "Yes" (always kept), OR
'   - FC Status is one of the three Draft values
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

    ' Missed FC column -- rows marked "Yes" pass through unconditionally.
    Dim missedFCCol As Long
    missedFCCol = FindColByHeader(ws, "Missed FC")

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

    ' Load keep values from Config into a dictionary for O(1) lookup
    Dim keepVals() As String
    keepVals = GetFCStatusKeepValues()
    Dim keepSet As Object
    Set keepSet = CreateObject("Scripting.Dictionary")
    Dim k As Long
    For k = 1 To UBound(keepVals)
        keepSet(UCase(Trim(keepVals(k)))) = True
    Next k

    ' --- Step 1: Load entire working sheet into memory (one read) ---
    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    ' --- Step 2: Count matching rows (needed to size the output array) ---
    Dim keepCount As Long
    Dim i As Long
    Dim fcVal As String
    Dim missedVal As String
    For i = 2 To lastRow
        fcVal     = UCase(Trim(CStr(allData(i, fcCol))))
        missedVal = ""
        If missedFCCol > 0 Then missedVal = UCase(Trim(CStr(allData(i, missedFCCol))))
        If missedVal = "YES" Or keepSet.Exists(fcVal) Then
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
        fcVal     = UCase(Trim(CStr(allData(i, fcCol))))
        missedVal = ""
        If missedFCCol > 0 Then missedVal = UCase(Trim(CStr(allData(i, missedFCCol))))
        If missedVal = "YES" Or keepSet.Exists(fcVal) Then
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

    Application.StatusBar = "FC Status filter complete: kept " & keepCount & " rows."
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
