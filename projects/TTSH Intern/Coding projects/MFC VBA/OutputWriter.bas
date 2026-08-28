Attribute VB_Name = "OutputWriter"
Option Explicit

' ============================================================
' OutputWriter.bas
'
' Writes and formats the output sheet cells (cols A-P). Called by
' BuildMFCOutput. For the full A-P column meaning, see the header of
' BuildOutput.bas.
'   WriteOutputHeaders -- row 1 headers
'   WriteOutputData    -- data rows from the working array
'   FormatOutputSheet  -- fonts, borders, freeze panes, autofit
' ============================================================


' Writes and formats the 16 column headers (A-P) on the output sheet.
Public Sub WriteOutputHeaders(outWs As Worksheet)
    Dim headers(1 To 16) As String
    headers(1)  = "Inflight FC Status"
    headers(2)  = "Date Updated (DD/MM/YYYY)"
    headers(3)  = "Staff Follow Up (if any)"
    headers(4)  = "Remarks"
    headers(5)  = "Resolution Status"
    headers(6)  = "FC ID"
    headers(7)  = "Encounter Number"
    headers(8)  = "MRN"
    headers(9)  = "Patient Name"
    headers(10) = "Adm Date for MFC"
    headers(11) = "FC Status"
    headers(12) = "Admit Status"
    headers(13) = "Point of Care"
    headers(14) = "Point of Care Final Bed"
    headers(15) = "Admission Level Of Care"
    headers(16) = "Epic Admission Status/Discharged"

    Dim headerRow(1 To 1, 1 To 16) As String
    Dim c As Long
    For c = 1 To 16
        headerRow(1, c) = headers(c)
    Next c
    With outWs.Range("A1:P1")
        .Value = headerRow
        .Font.Bold = True
        .Interior.Color = RGB(31, 73, 125)
        .Font.Color = RGB(255, 255, 255)
    End With
End Sub


' Copies data from wsData (working sheet in memory) into output cols F-P,
' pre-formats two columns, then applies the red duplicate-row highlight.
' colMap(1..11): each index maps an output column (F=1..P=11) to its source column in wsData.
Public Sub WriteOutputData(outWs As Worksheet, wsData As Variant, dataRows As Long, _
                            lastRow As Long, colMap() As Long, rowIsRed() As Boolean)
    ' Pre-format before writing to prevent Excel auto-conversion
    outWs.Range(outWs.Cells(2, 7),  outWs.Cells(lastRow, 7)).NumberFormat  = "0"  ' Encounter Number: no decimals
    outWs.Range(outWs.Cells(2, 10), outWs.Cells(lastRow, 10)).NumberFormat = "@"  ' Adm Date: text, prevent date reformatting

    ' Build output data array and bulk-write to cols F-P in one call
    Dim outData() As Variant
    ReDim outData(1 To dataRows, 1 To 11)
    Dim i As Long, j As Long
    For i = 1 To dataRows
        For j = 1 To 11
            outData(i, j) = wsData(i + 1, colMap(j))  ' i+1 skips header row in wsData
        Next j
    Next i
    outWs.Range(outWs.Cells(2, 6), outWs.Cells(lastRow, 16)).Value = outData

    ' Apply red duplicate highlight: Union all flagged rows, colour in one call
    Dim redRange As Range
    For i = 1 To dataRows
        If rowIsRed(i) Then
            If redRange Is Nothing Then
                Set redRange = outWs.Rows(i + 1)
            Else
                Set redRange = Union(redRange, outWs.Rows(i + 1))
            End If
        End If
    Next i
    If Not redRange Is Nothing Then
        redRange.Interior.Color = RGB(255, 0, 0)
        redRange.Font.Color     = RGB(255, 255, 255)
    End If
End Sub


' Applies Aptos Narrow font, inner/outer borders, header row height,
' column autofit, and freezes panes below the header row.
Public Sub FormatOutputSheet(outWs As Worksheet, lastRow As Long)
    Dim tableRange As Range
    Set tableRange = outWs.Range(outWs.Cells(1, 1), outWs.Cells(lastRow, 16))

    tableRange.Font.Name = "Aptos Narrow"
    tableRange.Font.Size = 11

    ' Inner grid lines (thin dark grey)
    With tableRange.Borders(xlInsideVertical)
        .LineStyle = xlContinuous
        .Weight    = xlThin
        .Color     = RGB(89, 89, 89)
    End With
    With tableRange.Borders(xlInsideHorizontal)
        .LineStyle = xlContinuous
        .Weight    = xlThin
        .Color     = RGB(89, 89, 89)
    End With
    tableRange.BorderAround LineStyle:=xlContinuous, Weight:=xlMedium, Color:=RGB(0, 0, 0)

    outWs.Rows(1).RowHeight = 30
    outWs.Columns("A:P").AutoFit
    outWs.Range("A2").Select
    ActiveWindow.FreezePanes = True
End Sub
