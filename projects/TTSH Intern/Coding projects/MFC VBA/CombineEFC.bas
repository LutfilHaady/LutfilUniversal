Attribute VB_Name = "CombineEFC"
Option Explicit

' Appends all data rows from the missed-FC EFC file below the last row
' of the main EFC file, using paste-values to avoid carrying over formats or formulas.
Sub CombineEFCFiles(wsMainEFC As Worksheet, wsMissedEFC As Worksheet)

    Dim lastRowMain As Long
    Dim lastRowMissed As Long

    lastRowMain   = wsMainEFC.Cells(wsMainEFC.Rows.Count, 1).End(xlUp).Row
    lastRowMissed = wsMissedEFC.Cells(wsMissedEFC.Rows.Count, 1).End(xlUp).Row
    If lastRowMissed < 2 Then Exit Sub  ' Missed FC file has no data rows -- nothing to append

    Dim lastColMissed As Long
    lastColMissed = wsMissedEFC.Cells(1, wsMissedEFC.Columns.Count).End(xlToLeft).Column

    wsMissedEFC.Range(wsMissedEFC.Cells(2, 1), wsMissedEFC.Cells(lastRowMissed, lastColMissed)).Copy
    wsMainEFC.Range("A" & lastRowMain + 1).PasteSpecial xlPasteValues

    Application.CutCopyMode = False

End Sub
