Attribute VB_Name = "BedCodeFilter"
Option Explicit

' ============================================================
' FilterBedCode.bas
'
' FilterBedCode -- keeps only rows whose ward code (Mid(bed,2,3)) is an NCID
' ward. Runs AFTER LookupEpicData (the Bed column comes from Epic).
'
' Load-filter-write strategy: one read + one write + one delete for ~20,000 rows.
' ============================================================

' NCID ward allowlist for the bed filter. A bed is kept when characters at
' 0-based positions 1,2,3 of the bed string -- i.e. Mid(bed, 2, 3) -- match one
' of these ward codes. Example: "T07E18N" -> "07E".
' Single-digit floors are zero-padded because bed strings carry the leading zero.
' To retarget this filter to another department, edit this one constant.
Private Const NCID_WARDS As String = "14F,12E,11E,08E,09F,08F,07F,07E,06F,11F,03E,05F"

' Keeps only rows whose bed code maps to an NCID ward.
' Ward code = Mid(bed, 2, 3) (0-based positions 1,2,3), matched against NCID_WARDS.
' Rows with a blank, short, or "none" bed code are removed.
' Must run AFTER LookupEpicData (the Bed column is populated by Epic lookup).
Public Sub FilterBedCode(ws As Worksheet)

    On Error GoTo ErrHandler

    Dim bedCol As Long
    bedCol = FindColByHeader(ws, "Bed Point Of Care")
    If bedCol = 0 Then
        MsgBox "Error: 'Bed Point Of Care' column missing." & vbNewLine & _
               "The Epic lookup may have failed.", vbExclamation, "Missing Column"
        Exit Sub
    End If

    ' Build the ward allowlist into a dictionary once (case-insensitive keys).
    Dim wardSet As Object
    Set wardSet = CreateObject("Scripting.Dictionary")
    Dim wardArr() As String
    wardArr = Split(NCID_WARDS, ",")
    Dim w As Long
    For w = LBound(wardArr) To UBound(wardArr)
        wardSet(UCase(Trim(wardArr(w)))) = True
    Next w

    ' Use "Encounter No" for lastRow: always filled for both main EFC and missed FC rows.
    ' FC ID (col 1) is blank for missed FC rows and would silently truncate the scan.
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

    ' --- Step 1: Load entire working sheet into memory (one read) ---
    Dim allData As Variant
    allData = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value

    ' --- Step 2: Count rows whose ward code is in the NCID allowlist ---
    Dim keepCount As Long
    Dim i As Long
    Dim bedVal As String
    Dim wardCode As String
    For i = 2 To lastRow
        bedVal = Trim(CStr(allData(i, bedCol)))
        wardCode = ""
        If Len(bedVal) >= 4 And LCase(bedVal) <> "none" Then wardCode = UCase(Mid(bedVal, 2, 3))
        If wardSet.Exists(wardCode) Then keepCount = keepCount + 1
    Next i

    If keepCount = 0 Then
        ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, lastCol)).ClearContents
        Application.Calculation = xlCalculationAutomatic
        Application.ScreenUpdating = True
        MsgBox "No NCID ward matches found." & vbNewLine & _
               "Check the Epic Census Report date.", vbExclamation, "No Data"
        Exit Sub
    End If

    ' --- Step 3: Build compacted array of matching rows ---
    Dim filtData() As Variant
    ReDim filtData(1 To keepCount, 1 To lastCol)

    Dim outRow As Long
    Dim j As Long
    For i = 2 To lastRow
        bedVal = Trim(CStr(allData(i, bedCol)))
        wardCode = ""
        If Len(bedVal) >= 4 And LCase(bedVal) <> "none" Then wardCode = UCase(Mid(bedVal, 2, 3))
        If wardSet.Exists(wardCode) Then
            outRow = outRow + 1
            For j = 1 To lastCol
                filtData(outRow, j) = allData(i, j)
            Next j
        End If
    Next i

    ' --- Step 4: Write filtered rows back (one write) ---
    ws.Range(ws.Cells(2, 1), ws.Cells(1 + keepCount, lastCol)).Value = filtData

    ' --- Step 5: Delete tail rows (one delete) ---
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
