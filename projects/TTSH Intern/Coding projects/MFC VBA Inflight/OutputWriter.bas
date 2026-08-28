Attribute VB_Name = "OutputWriter"
Option Explicit

' ============================================================
' OutputWriter.bas
'
' Writes and formats the output sheet cells (cols A-O). Called by
' BuildMFCOutput. For the full A-O column meaning, see the header of
' BuildOutput.bas.
'   WriteOutputHeaders -- row 1 headers
'   WriteOutputData    -- data rows from the working array
'   FormatOutputSheet  -- fonts, borders, freeze panes, autofit
' ============================================================


' Writes and formats the 15 column headers (A-O) on the output sheet.
Public Sub WriteOutputHeaders(outWs As Worksheet)
    Dim headers() As String
    headers = GetOutputHeaders()

    Dim headerRow(1 To 1, 1 To 15) As String
    Dim c As Long
    For c = 1 To 15
        headerRow(1, c) = headers(c)
    Next c

    Dim hdrColor As Long
    hdrColor = GetSettingColor("Header Color", 31, 73, 125)
    Dim hdrFontColor As Long
    hdrFontColor = GetSettingColor("Header Font Color", 255, 255, 255)

    With outWs.Range("A1:O1")
        .Value = headerRow
        .Font.Bold = True
        .Interior.Color = hdrColor
        .Font.Color = hdrFontColor
    End With
End Sub


' Copies data from wsData (working sheet in memory) into output cols F-O,
' pre-formats two columns, then applies the red duplicate-row highlight.
' colMap(1..10): each index maps an output column (F=1..O=10) to its source column in wsData.
Public Sub WriteOutputData(outWs As Worksheet, wsData As Variant, dataRows As Long, _
                            lastRow As Long, colMap() As Long, rowIsRed() As Boolean)
    ' Pre-format before writing to prevent Excel auto-conversion
    outWs.Range(outWs.Cells(2, 7),  outWs.Cells(lastRow, 7)).NumberFormat  = "0"  ' Encounter Number: no decimals
    outWs.Range(outWs.Cells(2, 10), outWs.Cells(lastRow, 10)).NumberFormat = "@"  ' Adm Date: text, prevent date reformatting

    ' Build output data array and bulk-write to cols F-O in one call
    Dim outData() As Variant
    ReDim outData(1 To dataRows, 1 To 10)
    Dim i As Long, j As Long
    For i = 1 To dataRows
        For j = 1 To 10
            outData(i, j) = wsData(i + 1, colMap(j))  ' i+1 skips header row in wsData
        Next j
    Next i
    outWs.Range(outWs.Cells(2, 6), outWs.Cells(lastRow, 15)).Value = outData

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
        redRange.Interior.Color = GetSettingColor("Duplicate Color", 255, 0, 0)
        redRange.Font.Color     = RGB(255, 255, 255)
    End If
End Sub


' Applies Aptos Narrow font, inner/outer borders, header row height,
' column autofit, and freezes panes below the header row.
Public Sub FormatOutputSheet(outWs As Worksheet, lastRow As Long)
    Dim tableRange As Range
    Set tableRange = outWs.Range(outWs.Cells(1, 1), outWs.Cells(lastRow, 15))

    Dim fontName As String
    fontName = GetSetting("Font Name", "Aptos Narrow")
    Dim fontSize As Long
    fontSize = GetSettingLong("Font Size", 11)

    tableRange.Font.Name = fontName
    tableRange.Font.Size = fontSize

    Dim borderColor As Long
    borderColor = GetSettingColor("Border Color", 89, 89, 89)

    With tableRange.Borders(xlInsideVertical)
        .LineStyle = xlContinuous
        .Weight    = xlThin
        .Color     = borderColor
    End With
    With tableRange.Borders(xlInsideHorizontal)
        .LineStyle = xlContinuous
        .Weight    = xlThin
        .Color     = borderColor
    End With
    tableRange.BorderAround LineStyle:=xlContinuous, Weight:=xlMedium, Color:=RGB(0, 0, 0)

    outWs.Rows(1).RowHeight = 30
    outWs.Columns("A:O").AutoFit
    outWs.Range("A2").Select
    ActiveWindow.FreezePanes = True
End Sub
