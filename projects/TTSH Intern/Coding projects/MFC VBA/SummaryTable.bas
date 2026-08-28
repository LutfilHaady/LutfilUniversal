Attribute VB_Name = "SummaryTable"
Option Explicit

' ============================================================
' SummaryTable.bas
'
' WriteSummaryTable (Public) -- writes the executive summary table three rows
' below the last patient record: Total Cases, Backlog, Today's Cases, plus the
' yellow manual-entry cells (To Follow Up on CCF, EL Admissions). Called by
' BacklogSummary.
' ============================================================


' Writes a 6-row coloured summary table at startRow (cols A:B).
' Staff fill in "To Follow Up on CCF" and "EL Admissions" manually.
' Today's Cases uses a live formula: Total Cases minus Backlog.
Public Sub WriteSummaryTable(outWs As Worksheet, startRow As Long, _
                              totalCases As Long, backlogCount As Long)

    Const COL_LBL As Long = 1
    Const COL_VAL As Long = 2

    Dim r0 As Long : r0 = startRow
    Dim r1 As Long : r1 = startRow + 1
    Dim r2 As Long : r2 = startRow + 2
    Dim r3 As Long : r3 = startRow + 3
    Dim r4 As Long : r4 = startRow + 4
    Dim r5 As Long : r5 = startRow + 5

    With outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r0, COL_VAL))
        .Merge
        .Value = "MFC Report Summary"
        .Font.Bold = True
        .Font.Color = RGB(255, 255, 255)
        .Interior.Color = RGB(31, 73, 125)
        .HorizontalAlignment = xlCenter
    End With

    Dim lbls(1 To 5)     As String
    Dim dataRows(1 To 5) As Long
    Dim bgColors(1 To 5) As Long
    lbls(1) = "Total Cases"          : dataRows(1) = r1 : bgColors(1) = RGB(217, 226, 239)
    lbls(2) = "Backlog"              : dataRows(2) = r2 : bgColors(2) = RGB(255, 255, 255)
    lbls(3) = "To Follow Up on CCF"  : dataRows(3) = r3 : bgColors(3) = RGB(255, 255, 153)
    lbls(4) = "Today's Cases"        : dataRows(4) = r4 : bgColors(4) = RGB(217, 226, 239)
    lbls(5) = "EL Admissions"        : dataRows(5) = r5 : bgColors(5) = RGB(255, 255, 153)

    Dim i As Long
    For i = 1 To 5
        With outWs.Cells(dataRows(i), COL_LBL)
            .Value = lbls(i)
            .Font.Bold = True
            .Interior.Color = bgColors(i)
        End With
        outWs.Cells(dataRows(i), COL_VAL).Interior.Color = bgColors(i)
    Next i

    outWs.Cells(r1, COL_VAL).Value = totalCases
    outWs.Cells(r2, COL_VAL).Value = backlogCount
    ' r3 (To Follow Up on CCF) is left blank -- staff enter this manually.
    outWs.Cells(r4, COL_VAL).Formula = "=" & outWs.Cells(r1, COL_VAL).Address(True, True) & _
                                        "-" & outWs.Cells(r2, COL_VAL).Address(True, True)

    On Error Resume Next
    outWs.Cells(r3, COL_VAL).Comment.Delete
    outWs.Cells(r5, COL_VAL).Comment.Delete
    On Error GoTo 0
    outWs.Cells(r3, COL_VAL).AddComment "Enter the number of cases to follow up on CCF"
    outWs.Cells(r5, COL_VAL).AddComment "Enter EL Admissions count from email"

    With outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r5, COL_VAL)).Borders
        .LineStyle = xlContinuous
        .Weight = xlThin
        .Color = RGB(89, 89, 89)
    End With
    outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r5, COL_VAL)).BorderAround _
        LineStyle:=xlContinuous, Weight:=xlMedium, Color:=RGB(0, 0, 0)

    With outWs.Range(outWs.Cells(r0, COL_LBL), outWs.Cells(r5, COL_VAL)).Font
        .Name = "Aptos Narrow"
        .Size = 11
    End With
    outWs.Columns(COL_LBL).AutoFit

End Sub
