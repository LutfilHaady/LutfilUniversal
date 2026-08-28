Attribute VB_Name = "CombineEFC"
Option Explicit

' Appends all data rows from the missed-FC EFC file below the last row
' of the main EFC file, using paste-values to avoid carrying over formats or formulas.
Sub CombineEFCFiles(wsMainEFC As Worksheet, wsMissedEFC As Worksheet)

    Dim lastRowMain As Long
    Dim lastRowMissed As Long

    ' Use Encounter No for lastRow -- FC ID (col 1) is blank in missed FC rows
    Dim encColMain As Long
    encColMain = FindColByHeader(wsMainEFC, "Encounter No")
    If encColMain > 0 Then
        lastRowMain = wsMainEFC.Cells(wsMainEFC.Rows.Count, encColMain).End(xlUp).Row
    Else
        lastRowMain = wsMainEFC.Cells(wsMainEFC.Rows.Count, 1).End(xlUp).Row
    End If

    Dim encColMissed As Long
    encColMissed = FindColByHeader(wsMissedEFC, "Encounter No")
    If encColMissed > 0 Then
        lastRowMissed = wsMissedEFC.Cells(wsMissedEFC.Rows.Count, encColMissed).End(xlUp).Row
    Else
        lastRowMissed = wsMissedEFC.Cells(wsMissedEFC.Rows.Count, 1).End(xlUp).Row
    End If
    If lastRowMissed < 2 Then Exit Sub  ' Missed FC file has no data rows -- nothing to append

    Dim lastColMissed As Long
    lastColMissed = wsMissedEFC.Cells(1, wsMissedEFC.Columns.Count).End(xlToLeft).Column

    Dim srcData As Variant
    srcData = wsMissedEFC.Range(wsMissedEFC.Cells(2, 1), wsMissedEFC.Cells(lastRowMissed, lastColMissed)).Value

    Dim missedRows As Long
    missedRows = lastRowMissed - 1
    wsMainEFC.Range(wsMainEFC.Cells(lastRowMain + 1, 1), _
        wsMainEFC.Cells(lastRowMain + missedRows, lastColMissed)).Value = srcData

End Sub
