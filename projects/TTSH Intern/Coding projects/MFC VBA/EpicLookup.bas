Attribute VB_Name = "EpicLookup"
Option Explicit

' Inserts two new columns into wsMainEFC, then bulk-loads Epic into
' Scripting.Dictionary objects (keyed by CSN) and resolves each EFC Encounter No
' in one pass -- avoiding per-row worksheet reads for ~20,000 Epic rows.
'
' All column positions are resolved by header name so neither report
' breaks if extra columns are added.
'
' Column inserts (run AFTER ExtractAdmissionDate):
'   "Bed Point Of Care"               -- inserted before "Point Of Care"
'   "Epic Admission Status/Discharged" -- appended after the last EFC column
Sub LookupEpicData(wsMainEFC As Worksheet, wsEpic As Worksheet)

    Dim lastRowEFC  As Long
    Dim lastRowEpic As Long
    Dim i As Long
    Dim csn As String
    Dim encounterNo As String

    Dim dictBed   As Object
    Dim dictAdmit As Object
    Set dictBed   = CreateObject("Scripting.Dictionary")
    Set dictAdmit = CreateObject("Scripting.Dictionary")

    ' --- Locate Epic columns by header ---
    Dim epicCSNCol   As Long
    Dim epicBedCol   As Long
    Dim epicAdmitCol As Long
    epicCSNCol   = FindColByHeader(wsEpic, "CSN")
    epicBedCol   = FindColByHeader(wsEpic, "Bed")
    epicAdmitCol = FindColByHeader(wsEpic, "Admit Status")

    If epicCSNCol = 0 Or epicBedCol = 0 Or epicAdmitCol = 0 Then
        MsgBox "Error: Epic file is missing required columns:" & vbNewLine & _
               IIf(epicCSNCol = 0, "  - CSN" & vbNewLine, "") & _
               IIf(epicBedCol = 0, "  - Bed" & vbNewLine, "") & _
               IIf(epicAdmitCol = 0, "  - Admit Status" & vbNewLine, "") & _
               "Check your Epic export.", _
               vbExclamation, "Missing Column"
        Exit Sub
    End If

    ' --- Locate EFC columns by header (before any insertions) ---
    Dim efcEncNoCol As Long
    Dim pocCol      As Long
    efcEncNoCol = FindColByHeader(wsMainEFC, "Encounter No")
    pocCol      = FindColByHeader(wsMainEFC, "Point Of Care")

    If efcEncNoCol = 0 Or pocCol = 0 Then
        MsgBox "Error: EFC file is missing columns needed for Epic lookup:" & vbNewLine & _
               IIf(efcEncNoCol = 0, "  - Encounter No" & vbNewLine, "") & _
               IIf(pocCol = 0, "  - Point Of Care" & vbNewLine, ""), _
               vbExclamation, "Missing Column"
        Exit Sub
    End If

    lastRowEFC  = wsMainEFC.Cells(wsMainEFC.Rows.Count, efcEncNoCol).End(xlUp).Row
    lastRowEpic = wsEpic.Cells(wsEpic.Rows.Count, 1).End(xlUp).Row

    ' --- Insert "Bed Point Of Care" immediately before "Point Of Care" ---
    ' pocCol is the insert position; "Point Of Care" shifts to pocCol + 1.
    ' efcEncNoCol is before pocCol so it is unaffected by this insert.
    Dim lastColEFC As Long
    lastColEFC = wsMainEFC.Cells(1, wsMainEFC.Columns.Count).End(xlToLeft).Column
    wsMainEFC.Columns(pocCol).Insert Shift:=xlToRight
    wsMainEFC.Cells(1, pocCol).Value = "Bed Point Of Care"
    lastColEFC = lastColEFC + 1  ' shifted by insert above

    ' --- Append "Epic Admission Status/Discharged" after the last column ---
    Dim epicStatCol As Long
    epicStatCol = lastColEFC + 1
    wsMainEFC.Cells(1, epicStatCol).Value = "Epic Admission Status/Discharged"

    ' --- Load Epic data into memory (only up to the rightmost needed column) ---
    Dim epicLastCol As Long
    epicLastCol = Application.WorksheetFunction.Max(epicCSNCol, epicBedCol, epicAdmitCol)
    Dim epicData As Variant
    epicData = wsEpic.Range(wsEpic.Cells(1, 1), wsEpic.Cells(lastRowEpic, epicLastCol)).Value

    ' --- Pre-load Epic CSN, Bed and Admit Status into dictionaries ---
    For i = 2 To lastRowEpic
        csn = CStr(epicData(i, epicCSNCol))
        dictBed(csn)   = epicData(i, epicBedCol)
        dictAdmit(csn) = epicData(i, epicAdmitCol)
    Next i

    ' --- Load EFC data into memory after both insertions ---
    Dim efcData As Variant
    efcData = wsMainEFC.Range(wsMainEFC.Cells(1, 1), wsMainEFC.Cells(lastRowEFC, epicStatCol)).Value

    ' --- Prepare output arrays -- sized to data rows only (excludes header) ---
    Dim bedOut()   As Variant
    Dim admitOut() As Variant
    ReDim bedOut(1 To lastRowEFC - 1, 1 To 1)
    ReDim admitOut(1 To lastRowEFC - 1, 1 To 1)

    ' --- Lookup and store results in output arrays ---
    ' i - 1 maps sheet row i (starting at 2) to array index starting at 1.
    ' efcEncNoCol is before pocCol so its index in efcData is unchanged.
    For i = 2 To lastRowEFC
        encounterNo = CStr(efcData(i, efcEncNoCol))
        If dictBed.exists(encounterNo) Then
            bedOut(i - 1, 1)   = dictBed(encounterNo)
            admitOut(i - 1, 1) = dictAdmit(encounterNo)
        Else
            bedOut(i - 1, 1)   = ""
            admitOut(i - 1, 1) = ""
        End If
    Next i

    ' --- Write results back to sheet in one go ---
    wsMainEFC.Range(wsMainEFC.Cells(2, pocCol), wsMainEFC.Cells(lastRowEFC, pocCol)).Value           = bedOut
    wsMainEFC.Range(wsMainEFC.Cells(2, epicStatCol), wsMainEFC.Cells(lastRowEFC, epicStatCol)).Value = admitOut

End Sub
