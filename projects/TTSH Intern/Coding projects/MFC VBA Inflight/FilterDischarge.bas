Attribute VB_Name = "FilterDischarge"
Option Explicit

' ============================================================
' FilterDischarge.bas
'
' FilterDischarged -- removes ALL rows where the patient has been discharged,
' capturing them first onto a hidden "DischargedTemp" sheet (the dischargedWs
' out-parameter) so BuildMFCOutput can turn them into a "Discharged" output tab
' instead of losing them outright.
' Runs AFTER LookupEpicData (needs Epic Admission Status column) and
' AFTER FilterByBedCode -- this way non-Inflight-ward rows are already gone
' before discharged rows get captured, so the Discharged tab only ever
' contains the same Inflight wards as the main report.
'
' Key difference from NCID: NCID's FilterFCStatus preserves Missed FC rows
' even when discharged. Inflight removes ALL discharged rows unconditionally.
'
' Checks "Epic Admission Status" first (preferred, from Epic lookup).
' Falls back to "Admission Status" (from eFC) if Epic column is absent.
'
' Load-filter-write strategy: one read + one write + one delete.
' ============================================================

Public Sub FilterDischarged(ws As Worksheet, ByRef dischargedWs As Worksheet)

    On Error GoTo ErrHandler

    Set dischargedWs = Nothing

    ' Prefer Epic Admission Status; fall back to eFC Admission Status
    Dim statCol As Long
    statCol = FindColByHeader(ws, "Epic Admission Status")
    If statCol = 0 Then statCol = FindColByHeader(ws, "Admission Status")
    If statCol = 0 Then
        MsgBox "Error: No admission status column found." & vbNewLine & _
               "The Epic lookup may have failed.", vbExclamation, "Missing Column"
        Exit Sub
    End If

    ' Use "Encounter No" for lastRow
    Dim encNoCol As Long
    encNoCol = FindColByHeader(ws, "Encounter No")

    Dim lastRow As Long
    Dim lastCol As Long
    If encNoCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encNoCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, statCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Sub
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' --- Step 1: Load entire working sheet into memory (one read) ---
    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    ' --- Step 2: Count rows that are NOT discharged, and rows that ARE ---
    Dim keepCount As Long
    Dim dischargeCount As Long
    Dim i As Long
    Dim statVal As String
    For i = 2 To lastRow
        statVal = UCase(Trim(CStr(allData(i, statCol))))
        If statVal <> "DISCHARGED" Then
            keepCount = keepCount + 1
        Else
            dischargeCount = dischargeCount + 1
        End If
    Next i

    ' --- Step 3: Capture discharged rows onto a hidden temp sheet before they're
    ' lost. BuildMFCOutput reads this sheet later to build the "Discharged" tab. ---
    If dischargeCount > 0 Then
        Dim discardData() As Variant
        ReDim discardData(1 To dischargeCount, 1 To lastCol)
        Dim dOutRow As Long
        Dim k As Long
        For i = 2 To lastRow
            statVal = UCase(Trim(CStr(allData(i, statCol))))
            If statVal = "DISCHARGED" Then
                dOutRow = dOutRow + 1
                For k = 1 To lastCol
                    discardData(dOutRow, k) = allData(i, k)
                Next k
            End If
        Next i

        Set dischargedWs = ws.Parent.Sheets.Add(After:=ws.Parent.Sheets(ws.Parent.Sheets.Count))
        dischargedWs.Name = "DischargedTemp"
        dischargedWs.Range(dischargedWs.Cells(1, 1), dischargedWs.Cells(1, lastCol)).Value = _
            ws.Range(ws.Cells(1, 1), ws.Cells(1, lastCol)).Value
        dischargedWs.Range(dischargedWs.Cells(2, 1), dischargedWs.Cells(1 + dischargeCount, lastCol)).Value = discardData
        FlagDuplicateRows dischargedWs
        dischargedWs.Visible = xlSheetVeryHidden
    End If

    ' --- Step 4: Build compacted array of kept rows ---
    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "All cases are discharged -- no active cases remain." & vbNewLine & _
               "Check your Epic Census date range.", vbExclamation, "No Data"
        Exit Sub
    End If

    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)

    Dim outRow As Long
    Dim j As Long
    For i = 2 To lastRow
        statVal = UCase(Trim(CStr(allData(i, statCol))))
        If statVal <> "DISCHARGED" Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        End If
    Next i

    ' --- Step 5: Write filtered rows back (one write) ---
    ws.Range(ws.Cells(2, 1), ws.Cells(1 + keepCount, lastCol)).Value = filtData

    ' --- Step 6: Delete tail rows (one delete) ---
    Dim newLastRow As Long
    newLastRow = 1 + keepCount
    If newLastRow < lastRow Then
        ws.Rows((newLastRow + 1) & ":" & lastRow).Delete
    End If

    Application.StatusBar = "Discharge filter complete: kept " & keepCount & _
        " rows, captured " & dischargeCount & " discharged rows."
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Sub

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during discharge filter:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"

End Sub
