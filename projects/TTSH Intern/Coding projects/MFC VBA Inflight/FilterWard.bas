Attribute VB_Name = "FilterWard"
Option Explicit

' ============================================================
' FilterWard.bas
'
' FilterByBedCode -- removes rows whose Final Bed matches the
' Inflight excludelist. Runs AFTER LookupEpicData, BEFORE FilterDischarge
' (so the Discharged tab only ever contains Inflight-ward beds).
'
' Exclude rules:
'   1. Blank or "NONE"
'   2. Prefix match: AUC, EDC, EDTC, EDX, EDXO, O14, O15, RES, TWAS, TWDS
'   3. NCID ward code match via Mid(bed,2,3)
'
' Load-filter-write strategy: one read + one write + one delete.
' ============================================================

Public Sub FilterByBedCode(ws As Worksheet)

    On Error GoTo ErrHandler

    Dim bedCol As Long
    bedCol = FindColByHeader(ws, "Final Bed")
    If bedCol = 0 Then
        MsgBox "Error: 'Final Bed' column missing." & vbNewLine & _
               "Check that Epic lookup has run.", vbExclamation, "Missing Column"
        Exit Sub
    End If

    Dim prefixes As Variant
    prefixes = GetExcludedBedPrefixes()

    Dim ncidSet As Object
    Set ncidSet = CreateObject("Scripting.Dictionary")
    Dim ncidWards As Variant
    ncidWards = GetExcludedNCIDWards()
    Dim w As Long
    For w = LBound(ncidWards) To UBound(ncidWards)
        ncidSet(UCase(Trim(CStr(ncidWards(w))))) = True
    Next w

    Dim encNoCol As Long
    encNoCol = FindColByHeader(ws, "Encounter No")

    Dim lastRow As Long
    Dim lastCol As Long
    If encNoCol > 0 Then
        lastRow = ws.Cells(ws.Rows.Count, encNoCol).End(xlUp).Row
    Else
        lastRow = ws.Cells(ws.Rows.Count, bedCol).End(xlUp).Row
    End If
    If lastRow < 2 Then Exit Sub
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column

    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    Dim keepCount As Long
    Dim i As Long
    Dim bedVal As String
    For i = 2 To lastRow
        bedVal = UCase(Trim(CStr(allData(i, bedCol))))
        If Not ShouldExcludeBed(bedVal, prefixes, ncidSet) Then
            keepCount = keepCount + 1
        End If
    Next i

    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "No Inflight ward matches found." & vbNewLine & _
               "All rows were excluded by the bed filter.", vbExclamation, "No Data"
        Exit Sub
    End If

    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)

    Dim outRow As Long
    Dim j As Long
    For i = 2 To lastRow
        bedVal = UCase(Trim(CStr(allData(i, bedCol))))
        If Not ShouldExcludeBed(bedVal, prefixes, ncidSet) Then
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

    Application.StatusBar = "Bed code filter complete: kept " & keepCount & " rows."
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Exit Sub

ErrHandler:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Unexpected error during bed filter:" & vbNewLine & _
           Err.Description & " (code " & Err.Number & ")", vbCritical, "Error"

End Sub


Private Function ShouldExcludeBed(bedVal As String, prefixes As Variant, _
                                   ncidSet As Object) As Boolean
    ShouldExcludeBed = True

    If bedVal = "" Then Exit Function
    If bedVal = "NONE" Then Exit Function

    Dim p As Long
    For p = LBound(prefixes) To UBound(prefixes)
        If Left(bedVal, Len(prefixes(p))) = prefixes(p) Then Exit Function
    Next p

    If Len(bedVal) >= 4 Then
        If ncidSet.Exists(Mid(bedVal, 2, 3)) Then Exit Function
    End If

    ShouldExcludeBed = False
End Function
